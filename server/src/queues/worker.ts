// =============================================================================
// BullMQ Worker — Processes attack jobs
// =============================================================================

import { Worker, Job } from "bullmq";
import { performance } from "node:perf_hooks";
import { prisma } from "../lib/prisma.js";
import { wsManager } from "../websockets/ws-manager.js";
import { redisConnectionOptions, CHAOS_QUEUE_NAME } from "./chaos-queue.js";
import {
    attackJobDataSchema,
    type AttackJobData,
} from "../validators/schemas.js";
import { assertNotSSRF } from "../lib/ssrf-guard.js";
import type { AttackResult, WsServerMessage } from "../types/shared.js";
import {
    analyzeFinding,
    type BaselineComparison,
} from "../services/finding-analysis.js";
import { scoreAndPersistRun } from "../services/run-score.js";
import {
    buildAttackRequest,
    buildBenignRequest,
    type BuiltAttackRequest,
    type AttachedCredential,
} from "../services/request-builder.js";
import { isRunComplete } from "../services/run-completion.js";
import { toAttachedCredential, isDynamicType } from "../services/auth-recipe.service.js";
import { resolveDynamicCredential } from "../services/auth-runner.js";
import {
    CredentialResolver,
    executeWithAuthRefresh,
    type ResolvedCredential,
} from "../services/credential-resolver.js";
import {
    IdentityCredentialResolver,
    type IdentityRef,
} from "../services/identity-credential-resolver.js";
import { loadRecipeCredential } from "../services/recipe-credential-loader.js";
import { decideBolaVerdict, type BolaFinding } from "../services/bola-verdict.js";
import { geminiBolaJudge } from "../services/bola-judge.js";
import { decryptSecret } from "../lib/crypto.js";
import { redactSecrets, REDACTED } from "../lib/redact.js";
import { logger } from "../lib/logger.js";
import { initSentry, captureException } from "../lib/sentry.js";

// Base logger for everything in the worker process.
const log = logger.child({ component: "worker" });

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const REQUEST_TIMEOUT_MS = 10_000; // 10 seconds
const RESPONSE_SNIPPET_MAX_LENGTH = 500;

// ---------------------------------------------------------------------------
// Baseline lookup cache (T6)
// ---------------------------------------------------------------------------
//
// A run fires ~20 payloads per endpoint; each attack diffs against that
// endpoint's benign baseline (T5). Rather than a DB read per payload, memoize
// the per-(run,endpoint) baseline. Positive results are cached for the run;
// a MISS (baseline not captured, or hasn't landed yet due to the priority race)
// is cached only briefly so a late-arriving baseline is still picked up, while
// FREE-plan runs (no baselines) don't re-query on every single payload.

const BASELINE_NEG_TTL_MS = 3000; // re-check a missing baseline after 3s
const BASELINE_CACHE_MAX = 5000; // bound memory across many runs

const baselineCache = new Map<
    string,
    { value: BaselineComparison | null; at: number }
>();

async function getBaselineFor(
    testRunId: string,
    endpointId: string,
): Promise<BaselineComparison | null> {
    const key = `${testRunId}:${endpointId}`;
    const hit = baselineCache.get(key);
    if (hit) {
        // Positive verdicts are stable for the run; negatives expire so a
        // baseline that lands slightly after the first attack is still used.
        if (hit.value !== null) return hit.value;
        if (Date.now() - hit.at < BASELINE_NEG_TTL_MS) return null;
    }

    const row = await prisma.baselineResponse.findUnique({
        where: { testRunId_endpointId: { testRunId, endpointId } },
        select: { status: true, latencyMs: true, bodyLength: true, bodySnippet: true },
    });
    const value: BaselineComparison | null = row ?? null;

    if (baselineCache.size >= BASELINE_CACHE_MAX) {
        const oldest = baselineCache.keys().next().value;
        if (oldest !== undefined) baselineCache.delete(oldest);
    }
    baselineCache.set(key, { value, at: Date.now() });
    return value;
}

// ---------------------------------------------------------------------------
// Auth-recipe credential resolution (T7a static + T8a dynamic)
// ---------------------------------------------------------------------------
//
// A run attaches ONE credential to every request. STATIC recipes decrypt to a
// fixed value; DYNAMIC recipes (loginRequest / oauth2) obtain a token at scan
// time via the auth-runner. The CredentialResolver caches per (run, recipe) and
// SINGLE-FLIGHTs concurrent resolves/refreshes so a burst of jobs triggers only
// ONE login. The decrypted secret + resolved token live only in worker memory —
// never persisted, never logged, never placed in Redis.

// loadRecipeCredential moved to ../services/recipe-credential-loader.js (T13a)
// so the BOLA orchestrator can resolve credentials exactly like the scan does.
const credentialResolver = new CredentialResolver(loadRecipeCredential);

// Per-identity resolver (T12a) — resolves a credential for ANY run identity by
// its id → authRecipeId → the shared credentialResolver (anonymous → no cred).
// Used by the BOLA replay path to fire AS identity B and AS identity A.
const identityCredentialResolver = new IdentityCredentialResolver(
    credentialResolver,
    async (identityId: string): Promise<IdentityRef | null> => {
        const row = await prisma.runIdentity.findUnique({
            where: { id: identityId },
            select: { id: true, testRunId: true, authRecipeId: true },
        });
        return row;
    },
);

/** Scrub the exact credential secret from a stored/broadcast string (T7a).
 *  Runs BEFORE the generic T3 redaction so even custom header/cookie secrets
 *  (which the generic patterns wouldn't catch) never persist if echoed back. */
function scrubCredential(
    text: string | null,
    cred: AttachedCredential | null,
): string | null {
    if (text == null || !cred?.secret) return text;
    return text.split(cred.secret).join(REDACTED);
}

// ---------------------------------------------------------------------------
// Worker
// ---------------------------------------------------------------------------

export function startOnyxWorker(): Worker {
    // Ensure error tracking is live in the worker path too (idempotent — a no-op
    // when index.ts already initialized it in the same process, or when no DSN).
    initSentry("worker");

    const worker = new Worker<AttackJobData>(
        CHAOS_QUEUE_NAME,
        async (job: Job<AttackJobData>) => {
            return processAttackJob(job);
        },
        {
            connection: redisConnectionOptions,
            // Higher concurrency = a steady in-flight pipeline. With ~12 requests
            // always in flight and each finishing in ~100-400ms, jobs stream
            // out continuously instead of firing in bursts of 10 with gaps.
            concurrency: 12,
            // A smooth ceiling (not a bursty batch cap). 30/sec spread across a
            // 100ms window means at most ~3 dispatched per tick — enough to
            // protect the target without the visible "10 then pause" stutter.
            limiter: {
                max: 3,
                duration: 100, // ~30 jobs/sec, evenly paced
            },
        },
    );

    worker.on("completed", (job) => {
        log.debug(
            { jobId: job.id, testRunId: job.data?.testRunId, method: job.data.method, path: job.data.path },
            "Job completed",
        );
    });

    worker.on("failed", (job, err) => {
        const testRunId = job?.data?.testRunId;
        log.error(
            { jobId: job?.id, testRunId, err },
            "Job failed",
        );
        // Report the failure with job context (never the payload/response body).
        captureException(err, { jobId: job?.id, testRunId });

        // CRITICAL: a permanently-failed job (retries exhausted) must still
        // count toward completion, otherwise completedAttacks can never reach
        // totalAttacks and the run hangs in ATTACKING forever (burning the
        // user's active-run slot). Only act on the FINAL attempt.
        if (!job) return;
        const attemptsAllowed = job.opts.attempts ?? 1;
        const isFinalAttempt = job.attemptsMade >= attemptsAllowed;
        if (!isFinalAttempt) return;

        if (typeof testRunId !== "string") return;

        // Fire-and-forget: record the failed job (attack OR baseline) as done and
        // finalize the run if this was the last outstanding job. Route to the
        // right counter so attack/baseline progress stay independent.
        const kind = job.data?.kind === "baseline" ? "baseline" : "attack";
        const recordFailure =
            kind === "baseline" ? recordFailedBaseline : recordFailedAttempt;
        void recordFailure(testRunId).catch((e) => {
            log.error(
                { testRunId, kind, err: e },
                "Failed to record terminal failure",
            );
            captureException(e, { testRunId, kind, phase: "recordFailedJob" });
        });
    });

    worker.on("error", (err) => {
        log.error({ err }, "Worker error");
        captureException(err, { phase: "worker.error" });
    });

    log.info("Onyx worker started");
    return worker;
}

// ---------------------------------------------------------------------------
// Completion helpers (shared by success path, SSRF-block path, and the
// terminal-failure handler so the logic can never diverge).
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Throttled progress broadcasts
// ---------------------------------------------------------------------------
//
// Previously every attack emitted a TEST_RUN_STATUS on top of its ATTACK_RESULT
// — 2 WS messages + 2 JSON.stringify per job, and a client state update per row
// (30+/sec during a run). The client already receives every ATTACK_RESULT, so
// the status message only needs to refresh the completed/total denominator
// periodically. Coalesce it to at most one per run every 400ms. The terminal
// COMPLETED status is always sent by finalizeIfComplete, so the final state
// never gets swallowed by the throttle.
const PROGRESS_BROADCAST_INTERVAL_MS = 400;
const lastProgressBroadcast = new Map<string, number>();

function maybeBroadcastProgress(run: {
    id: string;
    status: string;
    completedAttacks: number;
    totalAttacks: number;
}): void {
    const now = Date.now();
    if (
        now - (lastProgressBroadcast.get(run.id) ?? 0) <
        PROGRESS_BROADCAST_INTERVAL_MS
    ) {
        return;
    }
    lastProgressBroadcast.set(run.id, now);
    wsManager.broadcast(run.id, {
        type: "TEST_RUN_STATUS",
        data: {
            testRunId: run.id,
            status: run.status as any,
            completedAttacks: run.completedAttacks,
            totalAttacks: run.totalAttacks,
        },
    });
}

/**
 * Atomically flip a run to COMPLETED iff all jobs are enqueued (enqueuedAt set)
 * and every attack has been accounted for. Uses updateMany with a status filter
 * so concurrent finishers can't double-complete. Broadcasts only if this call
 * was the one that actually set COMPLETED. Safe to call from any path.
 */
async function finalizeIfComplete(
    testRunId: string,
    // When the caller just wrote the run (the increment `update` returns the
    // fresh row), pass it here to skip a redundant SELECT — this is the hot
    // path, so avoiding one round-trip per attack is a real speedup.
    known?: {
        enqueuedAt: Date | null;
        completedAttacks: number;
        totalAttacks: number;
        totalBaselines: number;
        completedBaselines: number;
        totalReplays: number;
        completedReplays: number;
        status: string;
    },
): Promise<void> {
    const run =
        known ??
        (await prisma.testRun.findUnique({
            where: { id: testRunId },
            select: {
                enqueuedAt: true,
                completedAttacks: true,
                totalAttacks: true,
                totalBaselines: true,
                completedBaselines: true,
                totalReplays: true,
                completedReplays: true,
                status: true,
            },
        }));
    if (!run) return;
    // Complete only once BOTH attacks and baselines are done (and all enqueued,
    // and the run is still in flight). Single source of truth: isRunComplete.
    if (!isRunComplete(run)) return;

    // Only ATTACKING runs may transition to COMPLETED. This also closes the
    // race where a run is aborted (→ FAILED) between the read above and here:
    // the filter refuses to overwrite a FAILED/COMPLETED terminal state.
    const { count } = await prisma.testRun.updateMany({
        where: { id: testRunId, status: "ATTACKING" },
        data: { status: "COMPLETED", completedAt: new Date() },
    });

    if (count > 0) {
        lastProgressBroadcast.delete(testRunId); // stop tracking a finished run
        // Persist the final score so the history list needn't reload every log.
        void scoreAndPersistRun(testRunId);
        const completionMessage: WsServerMessage = {
            type: "TEST_RUN_STATUS",
            data: {
                testRunId,
                status: "COMPLETED",
                completedAttacks: run.totalAttacks,
                totalAttacks: run.totalAttacks,
            },
        };
        wsManager.broadcast(testRunId, completionMessage);
        log.info({ testRunId }, "Test run COMPLETED");
    }
}

/**
 * Record a permanently-failed job as a completed attack so the run's progress
 * can still reach 100%. Called from the worker's `failed` handler on the final
 * attempt. Guards against counting past a run that's already terminal.
 */
async function recordFailedAttempt(testRunId: string): Promise<void> {
    const run = await prisma.testRun.findUnique({
        where: { id: testRunId },
        select: { status: true, completedAttacks: true, totalAttacks: true },
    });
    // If the run is already terminal, or would exceed its total, don't inflate.
    if (!run) return;
    if (run.status === "FAILED" || run.status === "COMPLETED") return;
    if (run.completedAttacks >= run.totalAttacks && run.totalAttacks > 0) return;

    await prisma.testRun.update({
        where: { id: testRunId },
        data: { completedAttacks: { increment: 1 } },
    });
    await finalizeIfComplete(testRunId);
}

/**
 * Baseline counterpart of recordFailedAttempt: count a permanently-failed
 * baseline job so the completion gate (which now also waits on baselines) can
 * still be satisfied. Never creates a BaselineResponse for the failure.
 */
async function recordFailedBaseline(testRunId: string): Promise<void> {
    const run = await prisma.testRun.findUnique({
        where: { id: testRunId },
        select: { status: true, completedBaselines: true, totalBaselines: true },
    });
    if (!run) return;
    if (run.status === "FAILED" || run.status === "COMPLETED") return;
    if (run.completedBaselines >= run.totalBaselines && run.totalBaselines > 0) return;

    await prisma.testRun.update({
        where: { id: testRunId },
        data: { completedBaselines: { increment: 1 } },
    });
    await finalizeIfComplete(testRunId);
}

// ---------------------------------------------------------------------------
// Job Processor
// ---------------------------------------------------------------------------

async function processAttackJob(job: Job<AttackJobData>): Promise<void> {
    // Short-circuit any job whose run was aborted/deleted while it waited in the
    // queue: don't attack the target, don't write logs, don't resurrect state.
    // Also read authRecipeId here (T7a) — the recipe id rides on the run row, so
    // NO auth material ever touches Redis job data.
    const runState = await prisma.testRun.findUnique({
        where: { id: job.data?.testRunId },
        select: {
            status: true,
            authRecipeId: true,
            // T12: the PRIMARY identity — the scan runs under it, and every
            // AttackLog/BaselineResponse it writes is attributed to this id.
            identities: {
                where: { isPrimary: true },
                select: { id: true },
                take: 1,
            },
        },
    });
    if (!runState || runState.status === "FAILED" || runState.status === "COMPLETED") {
        return; // run is gone or terminal — silently drop this job
    }
    // Primary identity id (null for pre-T12 rows → logs simply carry no identity).
    const primaryIdentityId = runState.identities[0]?.id ?? null;

    // Validate job data
    const validation = attackJobDataSchema.safeParse(job.data);
    if (!validation.success) {
        log.error(
            { jobId: job.id, issues: validation.error.issues },
            "Invalid job data",
        );
        throw new Error("Invalid job data");
    }

    // Resolve the credential once per run (cached, single-flight). Static → fixed
    // value; dynamic → a token obtained via the auth-runner. `resolved.dynamic`
    // gates the mid-run 401 refresh below.
    const resolved: ResolvedCredential = runState.authRecipeId
        ? await credentialResolver.resolve(validation.data.testRunId, runState.authRecipeId)
        : { value: null, dynamic: false };
    const credential = resolved.value;

    // Branch on job kind (T5). Baseline jobs fire ONE benign control request and
    // store a BaselineResponse — no AttackLog, no finding, no attack analysis.
    if (validation.data.kind === "baseline") {
        await processBaselineJob(
            validation.data,
            resolved,
            runState.authRecipeId,
            primaryIdentityId,
        );
        return;
    }

    // Replay job (T13a) — BOLA machinery. Re-request the detail endpoint with
    // identity A's object id, once AS identity B and once AS identity A, and
    // record both AttackLogs (no verdict — that's T13b). Never touches the
    // attack/baseline counters; advances its own completedReplays.
    if (validation.data.kind === "replay") {
        await processReplayJob(validation.data);
        return;
    }

    const {
        testRunId,
        endpointId,
        method,
        path,
        baseUrl,
        payload,
        attackType,
        parameters,
        requestBodySchema,
    } = validation.data;

    let statusCode: number | null = null;
    let latencyMs: number | null = null;
    let responseSnippet: string | null = null;
    let attackBodyLength = 0; // full response body length, for baseline diffing
    let error: string | null = null;
    // True only when the request was aborted by REQUEST_TIMEOUT_MS. Feeds the
    // time-based-injection rule (a delay payload whose sleep outran our timeout).
    let timedOut = false;

    // Build the concrete request: resolve path placeholders and inject the
    // payload into the correct location(s) (path/query/header/body) based on the
    // endpoint's declared params + attack type. ONE payload => ONE request.
    const request = buildAttackRequest({
        method,
        path,
        baseUrl,
        payload,
        attackType,
        parameters,
        requestBodySchema,
        // T7a: attach the static credential (stripped for MISSING_AUTH probes).
        credential,
    });

    // SSRF guard — vet the FINAL resolved URL's host before firing.
    try {
        await assertNotSSRF(request.url);
    } catch {
        // Skip this job — target resolves to a private/internal IP.
        // One round-trip: create the log + increment the counter together.
        const [attackLog, testRun] = await prisma.$transaction([
            prisma.attackLog.create({
                data: {
                    testRunId,
                    endpointId,
                    method,
                    path,
                    payload: payload.replace(/\0/g, "\\u0000"),
                    statusCode: 0,
                    latencyMs: 0,
                    responseSnippet: null,
                    attackType,
                    identityId: primaryIdentityId, // T12: attribute to primary
                    error: "SSRF blocked: target resolves to internal/private IP",
                },
            }),
            prisma.testRun.update({
                where: { id: testRunId },
                data: { completedAttacks: { increment: 1 } },
            }),
        ]);

        const wsMsg: WsServerMessage = {
            type: "ATTACK_RESULT",
            data: {
                id: attackLog.id,
                testRunId,
                method: method as any,
                endpoint: path,
                statusCode: 0,
                responseTime: 0,
                payload,
                responseSnippet: "",
                attackType: attackType as any,
                timestamp: attackLog.createdAt.toISOString(),
                severity: "INFO",
                finding: {
                    severity: "INFO",
                    category: "Skipped (SSRF guard)",
                    title: "Payload not sent — target resolved to an internal IP",
                    cause: "Onyx's SSRF guard blocked this request because the target host resolved to a private/internal address, so the payload was never delivered.",
                    evidence: null,
                    remediation: "Expected safety behavior. If this is your own internal host, run Onyx from inside that network or allow-list it explicitly.",
                    confidence: "info",
                },
            },
        };
        wsManager.broadcast(testRunId, wsMsg);

        // Check completion — only once ALL jobs are enqueued (enqueuedAt set),
        // so an early-finishing job can't complete a run mid-enqueue. Reuse the
        // row we just wrote instead of re-reading it.
        await finalizeIfComplete(testRunId, testRun);
        return;
    }

    // A dynamic credential may expire mid-run: on a 401 we refresh ONCE and retry
    // the same request ONCE. MISSING_AUTH must NOT refresh (its 401 is the desired
    // "auth enforced" result), and static credentials never auto-refresh.
    const isMissingAuth = attackType === "MISSING_AUTH";
    const canRefresh = resolved.dynamic && !isMissingAuth && !!runState.authRecipeId;
    let usedCredential = credential;
    try {
        const { result, credentialUsed } = await executeWithAuthRefresh({
            credential,
            canRefresh,
            // Reuse the pre-built request for the first fire; rebuild on refresh
            // (only headers change — dynamic creds resolve to bearer/header).
            execute: (cred) =>
                executeAttack(
                    cred === credential
                        ? request
                        : buildAttackRequest({
                              method,
                              path,
                              baseUrl,
                              payload,
                              attackType,
                              parameters,
                              requestBodySchema,
                              credential: cred,
                          }),
                ),
            refresh: async () =>
                (await credentialResolver.resolve(testRunId, runState.authRecipeId!, {
                    forceRefresh: true,
                })).value,
        });
        usedCredential = credentialUsed;
        statusCode = result.statusCode;
        latencyMs = result.latencyMs;
        responseSnippet = result.responseSnippet;
        attackBodyLength = result.bodyLength;
    } catch (err) {
        latencyMs = 0;
        const classified = classifyNetworkError(err);
        statusCode = classified.statusCode;
        error = classified.error;
        // A timeout (vs any other transport failure) is a detection signal when
        // the payload is a delay payload — the sleep outran our timeout.
        timedOut = classified.timedOut;
    }

    // Baseline diffing (T6): look up this endpoint's benign baseline (cached).
    // null when none exists (FREE plan, or the baseline hasn't landed yet) — in
    // which case analyzeFinding falls back to the pre-T6 single-request rules.
    const baseline = await getBaselineFor(testRunId, endpointId);

    // Analyze the RAW response FIRST — detection must see the unredacted bytes
    // so SECRET_LEAK / FILE_LEAK / SQL_ERROR / XSS / STACK_TRACE fire exactly as
    // before. This is pure + microsecond-cheap, so running it before the DB
    // write costs nothing and lets us redact based on the classified finding.
    const finding = analyzeFinding(
        {
            attackType,
            method,
            statusCode: statusCode ?? 0,
            latencyMs: latencyMs ?? 0,
            payload,
            responseSnippet: responseSnippet ?? "", // RAW — never persisted as-is
            bodyLength: attackBodyLength,
            timedOut,
        },
        baseline,
    );

    // Redact ONLY what leaves the process (DB row + WS payload). The in-memory
    // `finding` above (severity/category/confidence) is untouched; we build a
    // redacted copy so no secret/PII from the target reaches storage or the
    // browser. On read, re-detection runs on the stored (redacted) snippet — the
    // key names survive redaction, so classification stays identical.
    // Scrub the exact credential secret FIRST (T7a — catches custom header/cookie
    // secrets the generic patterns miss), then run the generic T3 redaction.
    // Scrub BOTH the original and any refreshed token so neither can leak.
    const scrub = (t: string | null) =>
        scrubCredential(scrubCredential(t, credential), usedCredential);
    const storedSnippet =
        responseSnippet != null
            ? redactSecrets(scrub(responseSnippet)!).replace(/\0/g, "\\u0000")
            : null;
    const safeFinding = {
        ...finding,
        evidence: finding.evidence != null ? redactSecrets(scrub(finding.evidence)!) : null,
    };

    // Persist the result + advance progress in a single round-trip. This runs
    // once per payload (the hottest path in the app), so collapsing two
    // sequential awaits into one batched transaction meaningfully cuts the
    // per-attack DB latency against a remote Postgres.
    const [attackLog, testRun] = await prisma.$transaction([
        prisma.attackLog.create({
            data: {
                testRunId,
                endpointId,
                method,
                path,
                payload: payload.replace(/\0/g, "\\u0000"),
                statusCode,
                latencyMs,
                responseSnippet: storedSnippet,
                attackType,
                owaspCategory: finding.owaspCategory ?? null, // T9
                identityId: primaryIdentityId, // T12: attribute to primary
                error: error?.replace(/\0/g, "\\u0000") ?? null,
            },
        }),
        prisma.testRun.update({
            where: { id: testRunId },
            data: {
                completedAttacks: { increment: 1 },
            },
        }),
    ]);

    // Build attack result for WebSocket broadcast — using the REDACTED snippet
    // and evidence so secrets never reach the client either.
    const attackResult: AttackResult = {
        id: attackLog.id,
        testRunId,
        method: method as AttackResult["method"],
        endpoint: path,
        statusCode: statusCode ?? 0,
        responseTime: latencyMs ?? 0,
        payload,
        responseSnippet: storedSnippet ?? "",
        attackType: attackType as AttackResult["attackType"],
        timestamp: attackLog.createdAt.toISOString(),
        severity: finding.severity,
        finding: safeFinding,
    };

    // Broadcast the result for THIS payload (the client needs every one).
    const wsMessage: WsServerMessage = {
        type: "ATTACK_RESULT",
        data: attackResult,
    };
    wsManager.broadcast(testRunId, wsMessage);

    // Refresh the progress denominator — throttled to ~1 per 400ms per run so a
    // 30/sec stream doesn't emit a redundant status message (and client render)
    // per row. The final COMPLETED status is still sent by finalizeIfComplete.
    maybeBroadcastProgress(testRun);

    // Check if all attacks are complete. Reuse the row we just wrote (fresh
    // counts + status + enqueuedAt) so we skip a redundant SELECT; the helper
    // still guards on enqueuedAt + terminal status and broadcasts COMPLETED
    // exactly once via an atomic status-filtered update.
    await finalizeIfComplete(testRunId, testRun);
}

// ---------------------------------------------------------------------------
// HTTP Attack Executor
// ---------------------------------------------------------------------------

interface AttackExecutionResult {
    statusCode: number;
    latencyMs: number;
    responseSnippet: string;
    bodyLength: number;
}

async function executeAttack(
    request: BuiltAttackRequest,
): Promise<AttackExecutionResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    const startTime = performance.now();

    try {
        const response = await fetch(request.url, {
            method: request.method,
            headers: request.headers,
            body: request.body,
            signal: controller.signal,
            redirect: "follow",
        });

        const latencyMs = Math.round(performance.now() - startTime);

        // Read response text (capped)
        let responseText: string;
        try {
            responseText = await response.text();
        } catch {
            responseText = "[Failed to read response body]";
        }

        const responseSnippet =
            responseText.length > RESPONSE_SNIPPET_MAX_LENGTH
                ? responseText.slice(0, RESPONSE_SNIPPET_MAX_LENGTH) + "…"
                : responseText;

        return {
            statusCode: response.status,
            latencyMs,
            responseSnippet,
            bodyLength: responseText.length,
        };
    } finally {
        clearTimeout(timeout);
    }
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/** Map a fetch/network error to the status code + message the app records.
 *  Shared by the attack path and baseline fires so both classify identically. */
function classifyNetworkError(err: unknown): {
    statusCode: number;
    error: string;
    /** True ONLY for the request-timeout abort — never for other transport errors.
     *  A timeout on a delay payload is evidence of time-based injection (see
     *  finding-analysis), so it must be distinguishable from ECONNREFUSED/DNS. */
    timedOut: boolean;
} {
    const raw = err instanceof Error ? err.message : String(err);
    if (raw.includes("AbortError") || raw.includes("timeout")) {
        return {
            statusCode: 408,
            error: `Request timed out after ${REQUEST_TIMEOUT_MS}ms`,
            timedOut: true,
        };
    }
    if (raw.includes("ECONNREFUSED")) {
        return {
            statusCode: 503,
            error: "Connection refused — target API is unreachable",
            timedOut: false,
        };
    }
    if (raw.includes("ENOTFOUND")) {
        return {
            statusCode: 502,
            error: "DNS resolution failed — target host not found",
            timedOut: false,
        };
    }
    return { statusCode: 0, error: raw, timedOut: false };
}

/** Median of a non-empty number list (even length → rounded mean of the two middles). */
function median(nums: number[]): number {
    const sorted = [...nums].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0
        ? sorted[mid]!
        : Math.round((sorted[mid - 1]! + sorted[mid]!) / 2);
}

// ---------------------------------------------------------------------------
// Baseline job processor (T5)
// ---------------------------------------------------------------------------

const BASELINE_FIRES = 3;

/**
 * Fire ONE benign control request per endpoint (2-3 times for a median latency)
 * and upsert a BaselineResponse. No AttackLog, no finding, no attack analysis —
 * this only records the "normal" response so T6 can diff attacks against it.
 * Respects the SSRF guard, 10s timeout, and T3 redaction.
 */
async function processBaselineJob(
    data: AttackJobData,
    resolved: ResolvedCredential,
    recipeId: string | null,
    identityId: string | null, // T12: the primary identity this baseline is captured as
): Promise<void> {
    const { testRunId, endpointId, method, path, baseUrl, parameters, requestBodySchema } = data;

    let cred = resolved.value;
    const buildReq = (c: AttachedCredential | null) =>
        buildBenignRequest({
            method,
            path,
            baseUrl,
            parameters,
            requestBodySchema,
            // T7a: baselines are authenticated like real traffic.
            credential: c,
        });
    let request = buildReq(cred);

    // SSRF guard on the resolved URL. If blocked, still count the baseline as
    // done (so the run can complete) but store no BaselineResponse.
    try {
        await assertNotSSRF(request.url);
    } catch {
        await incrementCompletedBaseline(testRunId);
        return;
    }

    // Fire 2-3 times; take the MEDIAN latency to reduce noise. Use the last
    // observed response for status/body; tolerate per-fire network failures.
    // A dynamic credential that 401s triggers ONE refresh + retry (once total).
    const latencies: number[] = [];
    let lastStatus: number | null = null;
    let lastSnippet = "";
    let lastBodyLength = 0;
    let refreshed = false;
    for (let i = 0; i < BASELINE_FIRES; i++) {
        try {
            let r = await executeAttack(request);
            if (r.statusCode === 401 && resolved.dynamic && recipeId && !refreshed) {
                refreshed = true;
                const fresh = (
                    await credentialResolver.resolve(testRunId, recipeId, { forceRefresh: true })
                ).value;
                if (fresh) {
                    cred = fresh;
                    request = buildReq(cred);
                    r = await executeAttack(request);
                }
            }
            latencies.push(r.latencyMs);
            lastStatus = r.statusCode;
            lastSnippet = r.responseSnippet;
            lastBodyLength = r.bodyLength;
        } catch (err) {
            lastStatus = classifyNetworkError(err).statusCode;
        }
    }

    const medianLatency = latencies.length > 0 ? median(latencies) : null;
    // Scrub BOTH the initial and refreshed token (T7a/T8a) then redact (T3).
    const bodySnippet = lastSnippet
        ? redactSecrets(scrubCredential(scrubCredential(lastSnippet, resolved.value), cred)!)
              .replace(/\0/g, "\\u0000")
              .slice(0, RESPONSE_SNIPPET_MAX_LENGTH)
        : null;

    // Upsert so a retry can't duplicate the row (unique testRunId+endpointId).
    await prisma.baselineResponse.upsert({
        where: { testRunId_endpointId: { testRunId, endpointId } },
        create: {
            testRunId,
            endpointId,
            status: lastStatus,
            latencyMs: medianLatency,
            bodyLength: lastBodyLength || null,
            bodySnippet,
            identityId, // T12: attribute to the primary identity
        },
        update: {
            status: lastStatus,
            latencyMs: medianLatency,
            bodyLength: lastBodyLength || null,
            bodySnippet,
            identityId, // T12
        },
    });

    await incrementCompletedBaseline(testRunId);
}

/** Advance the baseline counter and check run completion. */
async function incrementCompletedBaseline(testRunId: string): Promise<void> {
    const testRun = await prisma.testRun.update({
        where: { id: testRunId },
        data: { completedBaselines: { increment: 1 } },
    });
    await finalizeIfComplete(testRunId, testRun);
}

/** Advance the replay counter (T13a) and check run completion. */
async function incrementCompletedReplay(testRunId: string): Promise<void> {
    const testRun = await prisma.testRun.update({
        where: { id: testRunId },
        data: { completedReplays: { increment: 1 } },
    });
    await finalizeIfComplete(testRunId, testRun);
}

// ---------------------------------------------------------------------------
// Replay job (T13a) — BOLA machinery. Re-request the detail endpoint with
// identity A's object id, once AS identity B (the potential cross-tenant
// accessor) and once AS identity A (the owner's own baseline for that id), and
// record both as AttackLogs so T13b can diff them. NO verdict/finding here.
// ---------------------------------------------------------------------------
async function processReplayJob(data: AttackJobData): Promise<void> {
    const {
        testRunId,
        endpointId,
        method,
        path,
        baseUrl,
        parameters,
        requestBodySchema,
        objectId,
        idParamName,
        sourceIdentityId, // A
        targetIdentityId, // B
    } = data;

    // Replay fields must be present (schema keeps them optional for the union).
    if (!objectId || !idParamName || !sourceIdentityId || !targetIdentityId) {
        await incrementCompletedReplay(testRunId);
        return;
    }

    // Inject A's object id into the detail path (URL-encoded), leaving other
    // placeholders to the builder's benign dummies. Drop the id param from the
    // list so the builder doesn't overwrite the now-literal segment.
    const injectedPath = path.replace(/\{([^}]+)\}/g, (_m, raw) =>
        String(raw).trim() === idParamName ? encodeURIComponent(objectId) : `{${String(raw).trim()}}`,
    );
    const otherParams = (parameters ?? []).filter((p) => p.name !== idParamName);

    // Fire the injected detail request AS one identity; return a redacted result.
    const fireAs = async (identityId: string) => {
        const resolved = await identityCredentialResolver.resolveForIdentity(identityId);
        const request = buildBenignRequest({
            method,
            path: injectedPath,
            baseUrl,
            parameters: otherParams,
            requestBodySchema,
            credential: resolved.value,
        });
        try {
            await assertNotSSRF(request.url);
        } catch {
            return null; // SSRF-blocked → record nothing for this side
        }
        let res: AttackExecutionResult;
        try {
            res = await executeAttack(request);
        } catch (err) {
            return { statusCode: classifyNetworkError(err).statusCode, latencyMs: 0, snippet: null as string | null, bodyLength: 0 };
        }
        // Scrub this identity's credential, then T3-redact, then cap.
        const snippet = res.responseSnippet
            ? redactSecrets(scrubCredential(res.responseSnippet, resolved.value)!)
                  .replace(/\0/g, "\\u0000")
                  .slice(0, RESPONSE_SNIPPET_MAX_LENGTH)
            : null;
        return { statusCode: res.statusCode, latencyMs: res.latencyMs, snippet, bodyLength: res.bodyLength };
    };

    // B first (the actual cross-identity probe), then A (owner baseline for the id).
    const bResult = await fireAs(targetIdentityId);
    const aResult = await fireAs(sourceIdentityId);

    // Record A's row first (the owner's own result for this id — context for the
    // verdict + the report). identityId = who fired it; bolaSourceIdentityId = A.
    if (aResult) {
        await prisma.attackLog.create({
            data: {
                testRunId,
                endpointId,
                method,
                path: injectedPath,
                payload: "",
                statusCode: aResult.statusCode,
                latencyMs: aResult.latencyMs,
                responseSnippet: aResult.snippet,
                attackType: "BOLA_REPLAY",
                identityId: sourceIdentityId,
                bolaObjectId: objectId,
                bolaSourceIdentityId: sourceIdentityId,
            },
        });
    }

    if (!bResult) {
        await incrementCompletedReplay(testRunId);
        return;
    }

    // ── BOLA verdict (T13b) ── Both responses are in memory here, so decide now
    // and PERSIST the finding on B's row (it can't be recomputed from one row).
    // Labels make the explanation human-readable ("userB requested userA's …").
    const labels = await prisma.runIdentity.findMany({
        where: { id: { in: [sourceIdentityId, targetIdentityId] } },
        select: { id: true, label: true },
    });
    const labelOf = (id: string) => labels.find((l) => l.id === id)?.label ?? id;

    let finding: BolaFinding | null = null;
    try {
        finding = await decideBolaVerdict(
            {
                endpoint: `${method} ${path}`,
                objectId,
                aLabel: labelOf(sourceIdentityId),
                bLabel: labelOf(targetIdentityId),
                aStatus: aResult?.statusCode ?? 0,
                aBody: aResult?.snippet ?? "",
                bStatus: bResult.statusCode,
                bBody: bResult.snippet ?? "",
            },
            geminiBolaJudge,
        );
    } catch (err) {
        // A verdict failure must never fail the replay job.
        log.error({ testRunId, err: err instanceof Error ? err.message : String(err) }, "BOLA verdict failed");
    }

    const bLog = await prisma.attackLog.create({
        data: {
            testRunId,
            endpointId,
            method,
            path: injectedPath,
            payload: "",
            statusCode: bResult.statusCode,
            latencyMs: bResult.latencyMs,
            responseSnippet: bResult.snippet,
            attackType: "BOLA_REPLAY",
            identityId: targetIdentityId,
            bolaObjectId: objectId,
            bolaSourceIdentityId: sourceIdentityId,
            // Confirmed/firm BOLA → persist the finding + light up API1 coverage.
            ...(finding
                ? { findingJson: finding as unknown as object, owaspCategory: "API1_BOLA" }
                : {}),
        },
    });

    // Broadcast so a confirmed BOLA shows live in the console like any result.
    if (finding) {
        const wsMessage: WsServerMessage = {
            type: "ATTACK_RESULT",
            data: {
                id: bLog.id,
                testRunId,
                method: method as AttackResult["method"],
                endpoint: injectedPath,
                statusCode: bResult.statusCode,
                responseTime: bResult.latencyMs,
                payload: "",
                responseSnippet: bResult.snippet ?? "",
                attackType: "BOLA_REPLAY" as AttackResult["attackType"],
                timestamp: bLog.createdAt.toISOString(),
                severity: finding.severity,
                finding,
            },
        };
        wsManager.broadcast(testRunId, wsMessage);
    }

    await incrementCompletedReplay(testRunId);
}

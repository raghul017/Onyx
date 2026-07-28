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
import { analyzeFinding } from "../services/finding-analysis.js";
import { scoreAndPersistRun } from "../services/run-score.js";
import {
    buildAttackRequest,
    buildBenignRequest,
    type BuiltAttackRequest,
} from "../services/request-builder.js";
import { isRunComplete } from "../services/run-completion.js";
import { redactSecrets } from "../lib/redact.js";
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
    const runState = await prisma.testRun.findUnique({
        where: { id: job.data?.testRunId },
        select: { status: true },
    });
    if (!runState || runState.status === "FAILED" || runState.status === "COMPLETED") {
        return; // run is gone or terminal — silently drop this job
    }

    // Validate job data
    const validation = attackJobDataSchema.safeParse(job.data);
    if (!validation.success) {
        log.error(
            { jobId: job.id, issues: validation.error.issues },
            "Invalid job data",
        );
        throw new Error("Invalid job data");
    }

    // Branch on job kind (T5). Baseline jobs fire ONE benign control request and
    // store a BaselineResponse — no AttackLog, no finding, no attack analysis.
    if (validation.data.kind === "baseline") {
        await processBaselineJob(validation.data);
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
    let error: string | null = null;

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

    try {
        // Execute the HTTP request built above (method/url/headers/body).
        const result = await executeAttack(request);
        statusCode = result.statusCode;
        latencyMs = result.latencyMs;
        responseSnippet = result.responseSnippet;
    } catch (err) {
        latencyMs = 0;
        const classified = classifyNetworkError(err);
        statusCode = classified.statusCode;
        error = classified.error;
    }

    // Analyze the RAW response FIRST — detection must see the unredacted bytes
    // so SECRET_LEAK / FILE_LEAK / SQL_ERROR / XSS / STACK_TRACE fire exactly as
    // before. This is pure + microsecond-cheap, so running it before the DB
    // write costs nothing and lets us redact based on the classified finding.
    const finding = analyzeFinding({
        attackType,
        method,
        statusCode: statusCode ?? 0,
        latencyMs: latencyMs ?? 0,
        payload,
        responseSnippet: responseSnippet ?? "", // RAW — never persisted as-is
    });

    // Redact ONLY what leaves the process (DB row + WS payload). The in-memory
    // `finding` above (severity/category/confidence) is untouched; we build a
    // redacted copy so no secret/PII from the target reaches storage or the
    // browser. On read, re-detection runs on the stored (redacted) snippet — the
    // key names survive redaction, so classification stays identical.
    const storedSnippet =
        responseSnippet != null
            ? redactSecrets(responseSnippet).replace(/\0/g, "\\u0000")
            : null;
    const safeFinding = {
        ...finding,
        evidence: finding.evidence != null ? redactSecrets(finding.evidence) : null,
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
function classifyNetworkError(err: unknown): { statusCode: number; error: string } {
    const raw = err instanceof Error ? err.message : String(err);
    if (raw.includes("AbortError") || raw.includes("timeout")) {
        return { statusCode: 408, error: `Request timed out after ${REQUEST_TIMEOUT_MS}ms` };
    }
    if (raw.includes("ECONNREFUSED")) {
        return { statusCode: 503, error: "Connection refused — target API is unreachable" };
    }
    if (raw.includes("ENOTFOUND")) {
        return { statusCode: 502, error: "DNS resolution failed — target host not found" };
    }
    return { statusCode: 0, error: raw };
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
async function processBaselineJob(data: AttackJobData): Promise<void> {
    const { testRunId, endpointId, method, path, baseUrl, parameters, requestBodySchema } = data;

    const request = buildBenignRequest({
        method,
        path,
        baseUrl,
        parameters,
        requestBodySchema,
    });

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
    const latencies: number[] = [];
    let lastStatus: number | null = null;
    let lastSnippet = "";
    let lastBodyLength = 0;
    for (let i = 0; i < BASELINE_FIRES; i++) {
        try {
            const r = await executeAttack(request);
            latencies.push(r.latencyMs);
            lastStatus = r.statusCode;
            lastSnippet = r.responseSnippet;
            lastBodyLength = r.bodyLength;
        } catch (err) {
            lastStatus = classifyNetworkError(err).statusCode;
        }
    }

    const medianLatency = latencies.length > 0 ? median(latencies) : null;
    // Redact before persisting (T3) and cap at the snippet length.
    const bodySnippet = lastSnippet
        ? redactSecrets(lastSnippet).replace(/\0/g, "\\u0000").slice(0, RESPONSE_SNIPPET_MAX_LENGTH)
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
        },
        update: {
            status: lastStatus,
            latencyMs: medianLatency,
            bodyLength: lastBodyLength || null,
            bodySnippet,
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

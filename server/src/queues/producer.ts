// =============================================================================
// BullMQ Producer — Enqueues attack jobs
// =============================================================================

import { chaosQueue } from "./chaos-queue.js";
import type {
    GeneratedPayload,
    ParsedParameterInput,
} from "../validators/schemas.js";
import { logger } from "../lib/logger.js";

const log = logger.child({ component: "producer" });

interface EnqueueOptions {
    testRunId: string;
    endpointId: string;
    method: string;
    path: string;
    baseUrl: string;
    // Parameter definitions + body schema so the worker's request-builder can
    // inject the payload into the right location (path/query/header/body).
    parameters?: ParsedParameterInput[];
    requestBodySchema?: Record<string, unknown> | null;
}

/**
 * Enqueues AI-generated payloads as individual BullMQ jobs.
 * Each payload becomes a separate job so the worker can process
 * them concurrently with rate limiting.
 *
 * @returns The number of jobs enqueued.
 */
export async function enqueueAttackJobs(
    payloads: GeneratedPayload[],
    options: EnqueueOptions,
): Promise<number> {
    const {
        testRunId,
        endpointId,
        method,
        path,
        baseUrl,
        parameters = [],
        requestBodySchema = null,
    } = options;

    const jobs = payloads.map((p, index) => ({
        name: `attack-${testRunId}-${index}`,
        data: {
            testRunId,
            endpointId,
            method,
            path,
            baseUrl,
            payload:
                typeof p.payload === "string"
                    ? p.payload
                    : JSON.stringify(p.payload),
            attackType: p.attackType,
            parameters,
            requestBodySchema,
        },
        opts: {
            // Stable, unique job id so re-enqueues are idempotent per (run, endpoint, payload).
            jobId: `${testRunId}:${endpointId}:${index}`,
            // Lower-priority than baseline jobs (priority 1) so an endpoint's
            // baseline tends to run before its attacks. Pacing is still handled
            // solely by the worker (concurrency + limiter).
            priority: ATTACK_PRIORITY,
        },
    }));

    // Use addBulk for efficiency
    await chaosQueue.addBulk(jobs);

    log.info(
        { testRunId, endpointId, method, path, jobCount: jobs.length },
        "Enqueued attack jobs",
    );

    return jobs.length;
}

// ---------------------------------------------------------------------------
// Baseline jobs (T5) — one benign control request per endpoint.
// ---------------------------------------------------------------------------

// BullMQ priority: 1 = highest. Baselines outrank attacks so each endpoint's
// control request tends to fire before its attack payloads. (Priority only — not
// a hard barrier; T6 falls back gracefully when a baseline is missing.)
const BASELINE_PRIORITY = 1;
const ATTACK_PRIORITY = 2;

interface BaselineEndpoint {
    endpointId: string;
    method: string;
    path: string;
    parameters?: ParsedParameterInput[];
    requestBodySchema?: Record<string, unknown> | null;
}

/**
 * Enqueue ONE baseline (kind: "baseline") job per endpoint. Higher priority than
 * attack jobs so baselines run first. Returns the number of baseline jobs.
 */
export async function enqueueBaselineJobs(
    testRunId: string,
    baseUrl: string,
    endpoints: BaselineEndpoint[],
): Promise<number> {
    if (endpoints.length === 0) return 0;

    const jobs = endpoints.map((ep) => ({
        name: `baseline-${testRunId}`,
        data: {
            testRunId,
            endpointId: ep.endpointId,
            method: ep.method,
            path: ep.path,
            baseUrl,
            payload: "", // baseline carries no attack payload
            attackType: "UNKNOWN", // ignored on the baseline branch
            parameters: ep.parameters ?? [],
            requestBodySchema: ep.requestBodySchema ?? null,
            kind: "baseline",
        },
        opts: {
            // One baseline per (run, endpoint) — idempotent re-enqueue.
            jobId: `${testRunId}:${ep.endpointId}:baseline`,
            priority: BASELINE_PRIORITY,
        },
    }));

    await chaosQueue.addBulk(jobs);

    log.info({ testRunId, count: jobs.length }, "Enqueued baseline jobs");

    return jobs.length;
}

// ---------------------------------------------------------------------------
// Replay jobs (T13a) — BOLA machinery. Each replay re-requests a detail endpoint
// with identity A's object id while attached to identity B, so T13b can judge
// whether B reached A's data. Lower priority than attacks so the primary scan
// isn't delayed. Pre-computed specs are passed in (id acquisition happens in the
// BOLA orchestrator); this function only enqueues.
// ---------------------------------------------------------------------------
const REPLAY_PRIORITY = 3;

export interface ReplayJobSpec {
    endpointId: string;
    method: string;
    path: string; // detail path, e.g. "/users/{id}"
    parameters?: ParsedParameterInput[];
    requestBodySchema?: Record<string, unknown> | null;
    objectId: string; // A's acquired id ("" for BFLA — no object needed)
    idParamName: string; // path param that carries the id ("" for BFLA)
    sourceIdentityId: string; // A
    targetIdentityId: string; // B
    /** T14a: which cross-identity check this is. Defaults to "bola". */
    checkType?: "bola" | "bfla";
    /** T14a (BFLA only): why the endpoint was flagged privileged. */
    privilegedReason?: string;
}

/**
 * Enqueue replay (kind: "replay") jobs. Returns the number enqueued. Callers
 * only invoke this when the run has >=2 identities and has resolvable ids, so
 * an empty array here is a clean no-op (normal scans enqueue none).
 */
export async function enqueueReplayJobs(
    testRunId: string,
    baseUrl: string,
    specs: ReplayJobSpec[],
): Promise<number> {
    if (specs.length === 0) return 0;

    const jobs = specs.map((s) => ({
        name: `replay-${testRunId}`,
        data: {
            testRunId,
            endpointId: s.endpointId,
            method: s.method,
            path: s.path,
            baseUrl,
            payload: "", // replay carries no attack payload
            attackType: (s.checkType ?? "bola") === "bfla" ? "BFLA_PROBE" : "BOLA_REPLAY",
            parameters: s.parameters ?? [],
            requestBodySchema: s.requestBodySchema ?? null,
            kind: "replay",
            objectId: s.objectId,
            idParamName: s.idParamName,
            sourceIdentityId: s.sourceIdentityId,
            targetIdentityId: s.targetIdentityId,
            checkType: s.checkType ?? "bola",
            privilegedReason: s.privilegedReason,
        },
        opts: {
            // One check per (run, endpoint, A-id|checkType, B) — idempotent.
            jobId: `${testRunId}:${s.endpointId}:${s.objectId || (s.checkType ?? "bola")}:${s.targetIdentityId}:replay`,
            priority: REPLAY_PRIORITY,
        },
    }));

    await chaosQueue.addBulk(jobs);

    log.info({ testRunId, count: jobs.length }, "Enqueued replay jobs");

    return jobs.length;
}

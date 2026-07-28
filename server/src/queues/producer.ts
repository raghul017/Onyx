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

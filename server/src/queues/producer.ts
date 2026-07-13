// =============================================================================
// BullMQ Producer — Enqueues attack jobs
// =============================================================================

import { chaosQueue } from "./chaos-queue.js";
import type { GeneratedPayload } from "../validators/schemas.js";
import { logger } from "../lib/logger.js";

const log = logger.child({ component: "producer" });

interface EnqueueOptions {
    testRunId: string;
    endpointId: string;
    method: string;
    path: string;
    baseUrl: string;
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
    const { testRunId, endpointId, method, path, baseUrl } = options;

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
        },
        opts: {
            // Stable, unique job id so re-enqueues are idempotent per (run, endpoint, payload).
            jobId: `${testRunId}:${endpointId}:${index}`,
            // NOTE: pacing is handled solely by the worker (concurrency + limiter).
            // The previous per-run `group` throttle was a second, redundant rate
            // limit that made firing bursty ("10 then a gap"). Removed for a
            // smooth continuous stream.
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

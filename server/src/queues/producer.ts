// =============================================================================
// BullMQ Producer — Enqueues attack jobs
// =============================================================================

import { chaosQueue } from "./chaos-queue.js";
import type { GeneratedPayload } from "../validators/schemas.js";

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
            // Group jobs by testRunId so we can track progress
            jobId: `${testRunId}:${endpointId}:${index}`,
            // Rate limit: max 10 jobs per second per test run
            group: {
                id: testRunId,
                maxSize: 10,
                duration: 1000,
            },
        },
    }));

    // Use addBulk for efficiency
    await chaosQueue.addBulk(jobs);

    console.log(
        `[Producer] Enqueued ${jobs.length} attack jobs for ${method} ${path} (testRun: ${testRunId.slice(0, 8)}...)`,
    );

    return jobs.length;
}

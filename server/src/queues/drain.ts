// =============================================================================
// Drain a run's queued jobs on abort / delete. Every job id is prefixed with
// `${testRunId}:` (attack, baseline, replay, mass-assign — see producer.ts), so
// we list ids only (getRanges) and remove the matching ones, instead of
// loading every job's data in the whole queue. Jobs a worker already picked up
// are skipped by the worker itself (it re-checks run status).
// =============================================================================

export interface DrainableQueue {
    getRanges(types: Array<"waiting" | "prioritized" | "delayed">, start?: number, end?: number): Promise<string[]>;
    remove(jobId: string): Promise<number>;
}

export async function drainRunJobs(queue: DrainableQueue, testRunId: string): Promise<number> {
    const prefix = `${testRunId}:`;
    const ids = await queue.getRanges(["waiting", "prioritized", "delayed"], 0, -1);
    let removed = 0;
    for (const id of new Set(ids)) {
        if (!id.startsWith(prefix)) continue;
        try {
            // remove() returns 0 when the job is locked (a worker has it).
            removed += (await queue.remove(id)) > 0 ? 1 : 0;
        } catch {
            // Picked up by the worker in the meantime.
        }
    }
    return removed;
}

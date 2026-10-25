// =============================================================================
// Plan limits — the single source of truth for per-plan quotas. Mirrored by the
// client's pricing copy (client/src/components/plans.ts); change both together.
// =============================================================================

import type { Plan } from "@prisma/client";

/** Hard ceiling on endpoints per run, whatever the plan. Each endpoint costs a
 *  Gemini call plus up to ~20 requests, so this bounds a run's size and time. */
export const MAX_ENDPOINTS_PER_RUN = 200;

export const PLAN_LIMITS: Record<Plan, { testRunsPerMonth: number; endpointsPerRun: number }> = {
    FREE:       { testRunsPerMonth: 5,      endpointsPerRun: 10 },
    PRO:        { testRunsPerMonth: 100,    endpointsPerRun: 50 },
    TEAM:       { testRunsPerMonth: 500,    endpointsPerRun: MAX_ENDPOINTS_PER_RUN },
    ENTERPRISE: { testRunsPerMonth: 999999, endpointsPerRun: MAX_ENDPOINTS_PER_RUN },
};

/** How many of a spec's endpoints a run on this plan may scan. */
export function endpointCapFor(plan: Plan): number {
    return Math.min(PLAN_LIMITS[plan].endpointsPerRun, MAX_ENDPOINTS_PER_RUN);
}

/** Gemini calls in flight at once while generating a run's payloads. The free
 *  tier rate-limits bursts, and a rate-limited call silently falls back. */
export const PAYLOAD_GENERATION_CONCURRENCY = 4;

/**
 * Map over items with at most `limit` promises in flight, preserving order.
 * Small and dependency-free; used to pace per-endpoint Gemini calls.
 */
export async function mapWithConcurrency<T, R>(
    items: readonly T[],
    limit: number,
    fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
    const results = new Array<R>(items.length);
    let next = 0;
    const lanes = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
        while (next < items.length) {
            const i = next++;
            results[i] = await fn(items[i]!, i);
        }
    });
    await Promise.all(lanes);
    return results;
}

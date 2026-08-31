// =============================================================================
// BFLA planner (T14a) — pure planning for function-level authorization probes.
// Given the run's identities and its endpoints, produce the list of probes: each
// SECONDARY identity B calling each PRIVILEGED endpoint. Bounded, deduped, and
// skipped cleanly when preconditions aren't met.
//
// Pure (no DB / no HTTP) so it's unit-testable — the orchestrator does the IO.
// Mirrors bola-planner.ts, and reuses the same replay job spec + cap so BFLA
// needs no new queue, counters, or migration.
// =============================================================================

import type { ReplayJobSpec } from "../queues/producer.js";
import type { PlannerIdentity } from "./bola-planner.js";
import { MAX_REPLAY_JOBS } from "./bola-planner.js";
import { classifyPrivilegedEndpoint } from "./privileged-endpoint.js";

/** An endpoint as persisted, with the fields the probe needs. */
export interface BflaCandidateEndpoint {
    endpointId: string;
    method: string;
    path: string;
    operationId?: string | undefined;
    parameters?: ReplayJobSpec["parameters"];
    requestBodySchema?: Record<string, unknown> | null;
}

export interface PlanBflaResult {
    specs: ReplayJobSpec[];
    /** Why planning produced nothing (for logging); null when specs is non-empty. */
    skipReason: string | null;
}

/**
 * Plan BFLA probes for a run.
 *   - A (source) = the PRIMARY identity — the higher-privilege context, fired for
 *     comparison so we can tell "B was wrongly allowed" from "this route 404s".
 *   - B (targets) = every OTHER identity. A CREDENTIALED B is the real BFLA case
 *     (an authenticated but lower-privileged user). Anonymous B is skipped here:
 *     "no auth at all reaches an admin route" is the MISSING_AUTH attack's job,
 *     and including it would double-report.
 * Skips cleanly when <2 identities, no primary, or no privileged endpoints.
 */
export function planBflaProbes(
    identities: PlannerIdentity[],
    endpoints: BflaCandidateEndpoint[],
): PlanBflaResult {
    if (identities.length < 2) return { specs: [], skipReason: "fewer than 2 identities" };

    const primary = identities.find((i) => i.isPrimary);
    if (!primary) return { specs: [], skipReason: "no primary identity" };

    // Only credentialed secondaries — see the note above.
    const targets = identities.filter((i) => !i.isPrimary && i.authRecipeId != null);
    if (targets.length === 0) {
        return { specs: [], skipReason: "no credentialed secondary identity" };
    }

    const privileged = endpoints
        .map((e) => ({ e, verdict: classifyPrivilegedEndpoint(e) }))
        .filter((x) => x.verdict.privileged);
    if (privileged.length === 0) {
        return { specs: [], skipReason: "no privileged endpoints" };
    }

    const specs: ReplayJobSpec[] = [];
    outer: for (const { e, verdict } of privileged) {
        for (const b of targets) {
            if (specs.length >= MAX_REPLAY_JOBS) break outer;
            specs.push({
                endpointId: e.endpointId,
                method: e.method,
                path: e.path,
                parameters: e.parameters ?? [],
                requestBodySchema: e.requestBodySchema ?? null,
                objectId: "", // BFLA needs no object id
                idParamName: "",
                sourceIdentityId: primary.id,
                targetIdentityId: b.id,
                checkType: "bfla",
                privilegedReason: verdict.reason ?? "privileged endpoint",
            });
        }
    }

    return { specs, skipReason: specs.length === 0 ? "no probes planned" : null };
}

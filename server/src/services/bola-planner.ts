// =============================================================================
// BOLA planner (T13a) — pure planning for cross-identity replays. Given the run's
// identities and the endpoint pairs with A's acquired ids, produce the list of
// replay specs (each non-primary identity B replaying against the PRIMARY A's id)
// — bounded, deduped, and skipped cleanly when preconditions aren't met.
//
// Pure (no DB / no HTTP) so it's unit-testable. The controller does the IO: it
// resolves identities, runs id acquisition (as A), then calls planReplays and
// enqueueReplayJobs.
// =============================================================================

import type { EndpointPair } from "./object-id.js";
import type { ReplayJobSpec } from "../queues/producer.js";

/** A run identity as persisted (T12 RunIdentity), minimal shape for planning. */
export interface PlannerIdentity {
    id: string;
    authRecipeId: string | null; // null = anonymous
    isPrimary: boolean;
}

/** A pair whose A-id was successfully acquired (unresolved pairs are excluded). */
export interface ResolvedPair {
    pair: EndpointPair;
    /** The persisted endpoint (DB) id for the detail endpoint. */
    endpointId: string;
    objectId: string; // acquired as identity A (the primary)
}

/** Hard cap on total replay jobs so a big spec can't explode the queue. */
export const MAX_REPLAY_JOBS = 60;

export interface PlanReplaysResult {
    specs: ReplayJobSpec[];
    /** Why planning produced nothing (for logging); null when specs is non-empty. */
    skipReason: string | null;
}

/**
 * Plan the replay jobs for a run. Strategy (T13a foundation):
 *   - A (source) = the PRIMARY identity (the scan already ran as it, and ids were
 *     acquired as it). A must have a credential (anonymous A can't own objects).
 *   - B (targets) = every OTHER identity (secondaries). Each B replays A's id on
 *     each resolved detail endpoint. Anonymous B is allowed (tests "no-auth reads
 *     A's object" — a valid BOLA case).
 * Skips cleanly (empty specs + reason) when <2 identities, no primary-with-cred,
 * or no resolved pairs. Bounded by MAX_REPLAY_JOBS.
 */
export function planReplays(
    identities: PlannerIdentity[],
    resolved: ResolvedPair[],
): PlanReplaysResult {
    if (identities.length < 2) return { specs: [], skipReason: "fewer than 2 identities" };

    const primary = identities.find((i) => i.isPrimary);
    if (!primary) return { specs: [], skipReason: "no primary identity" };
    // A must be able to own objects — an anonymous primary has no data to protect.
    if (primary.authRecipeId == null) {
        return { specs: [], skipReason: "primary identity is anonymous (no owned objects)" };
    }

    const targets = identities.filter((i) => i.id !== primary.id);
    if (targets.length === 0) return { specs: [], skipReason: "no secondary identities" };

    if (resolved.length === 0) return { specs: [], skipReason: "no resolvable object ids" };

    const specs: ReplayJobSpec[] = [];
    outer: for (const { pair, endpointId, objectId } of resolved) {
        for (const b of targets) {
            if (specs.length >= MAX_REPLAY_JOBS) break outer;
            specs.push({
                endpointId,
                method: pair.detail.method,
                path: pair.detail.path,
                parameters: pair.detail.parameters as ReplayJobSpec["parameters"],
                requestBodySchema: null,
                objectId,
                idParamName: pair.idParam.name,
                sourceIdentityId: primary.id,
                targetIdentityId: b.id,
            });
        }
    }

    return { specs, skipReason: specs.length === 0 ? "no specs produced" : null };
}

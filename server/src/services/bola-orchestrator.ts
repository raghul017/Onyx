// =============================================================================
// BOLA orchestrator (T13a) — the IO glue that turns a multi-identity run into
// replay jobs. Runs AFTER the primary scan enqueues, ONLY when the run has >=2
// identities. Flow:
//   1. Pair GET-by-id DETAIL endpoints with their COLLECTION endpoints.
//   2. As identity A (the primary), fetch each collection and extract a real
//      object id (fallback: the detail endpoint's spec example).
//   3. Plan replays (each secondary B vs primary A) and enqueue them, recording
//      totalReplays so the completion gate waits for them.
// If any precondition fails (<2 identities, no detail endpoints, no ids), it
// enqueues nothing — a normal scan is byte-for-byte unaffected.
//
// The credential resolver + HTTP fire are INJECTED so this is testable and reuses
// the SSRF guard / timeout / redaction of the real request path.
// =============================================================================

import { logger } from "../lib/logger.js";
import type { ParsedParameterInput } from "../validators/schemas.js";
import {
    pairEndpoints,
    type EndpointLike,
    type EndpointPair,
} from "./object-id.js";
import {
    acquireIdForPair,
    type CollectionFetcher,
} from "./id-acquisition.js";
import {
    planReplays,
    type PlannerIdentity,
    type ResolvedPair,
} from "./bola-planner.js";
import { enqueueReplayJobs, type ReplayJobSpec } from "../queues/producer.js";

const log = logger.child({ component: "bola-orchestrator" });

/** A saved endpoint (DB row) enriched with its parsed parameters. */
export interface OrchestratorEndpoint extends EndpointLike {
    endpointId: string; // DB id
    parameters: Array<ParsedParameterInput & { in: "query" | "header" | "path" | "cookie" }>;
}

export interface OrchestrateReplaysInput {
    testRunId: string;
    baseUrl: string;
    identities: PlannerIdentity[];
    endpoints: OrchestratorEndpoint[];
    /** Fires the collection GET as identity A; returns parsed JSON + status. */
    fetchCollectionAsPrimary: CollectionFetcher;
    /** Enqueue fn (injected for tests; defaults to the real producer). */
    enqueue?: (testRunId: string, baseUrl: string, specs: ReplayJobSpec[]) => Promise<number>;
    /** Set totalReplays on the run (injected for tests). */
    setTotalReplays: (testRunId: string, n: number) => Promise<void>;
}

/**
 * Orchestrate BOLA replay enqueue for a run. Returns the number of replay jobs
 * enqueued (0 = skipped cleanly). Never throws for the "no work" cases.
 */
export async function orchestrateReplays(input: OrchestrateReplaysInput): Promise<number> {
    const { testRunId, baseUrl, identities, endpoints } = input;
    const enqueue = input.enqueue ?? enqueueReplayJobs;

    // Fast pre-check: need >=2 identities with a primary that can own objects.
    if (identities.length < 2) return 0;

    // Pair endpoints, keeping a map back to the persisted endpointId.
    const byKey = new Map<string, OrchestratorEndpoint>();
    for (const ep of endpoints) byKey.set(`${ep.method} ${ep.path}`, ep);
    const pairs = pairEndpoints(endpoints);
    if (pairs.length === 0) return 0;

    // Acquire A's object id per pair; keep only resolved ones.
    const resolved: ResolvedPair[] = [];
    for (const pair of pairs as Array<EndpointPair<OrchestratorEndpoint>>) {
        const acquired = await acquireIdForPair(pair, input.fetchCollectionAsPrimary);
        if (!acquired) continue;
        const detail = byKey.get(`${pair.detail.method} ${pair.detail.path}`);
        if (!detail) continue;
        resolved.push({ pair, endpointId: detail.endpointId, objectId: acquired.objectId });
    }

    const { specs, skipReason } = planReplays(identities, resolved);
    if (specs.length === 0) {
        log.info({ testRunId, skipReason }, "No BOLA replays enqueued");
        return 0;
    }

    await input.setTotalReplays(testRunId, specs.length);
    const count = await enqueue(testRunId, baseUrl, specs);
    log.info({ testRunId, count }, "Enqueued BOLA replays");
    return count;
}

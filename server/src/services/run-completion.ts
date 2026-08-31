// =============================================================================
// Run completion gate (pure) — decides when a TestRun may flip to COMPLETED.
//
// A run has TWO independent job populations after T5:
//   - attack jobs   → tracked by completedAttacks / totalAttacks (UI-facing)
//   - baseline jobs → tracked by completedBaselines / totalBaselines (internal)
//
// The run is only done once BOTH populations are fully accounted for AND all
// jobs have been enqueued (enqueuedAt set, so an early finisher can't complete
// a run mid-enqueue) AND the run is still in flight (not already terminal).
//
// Kept as a pure function so it's unit-testable without a DB/queue and so the
// worker and the controller's inline finalize can share ONE source of truth.
// =============================================================================

export interface RunCompletionCounts {
    status: string;
    enqueuedAt: Date | null;
    totalAttacks: number;
    completedAttacks: number;
    // Optional so callers reading pre-T5 rows (columns absent / undefined) treat
    // baselines as "none outstanding" and behave exactly as before.
    totalBaselines?: number | null;
    completedBaselines?: number | null;
    // Replay (BOLA) jobs (T13a) — optional so pre-T13 rows behave as before.
    totalReplays?: number | null;
    completedReplays?: number | null;
}

export function isRunComplete(c: RunCompletionCounts): boolean {
    // Never resurrect a run the user aborted or that already completed.
    if (c.status === "FAILED" || c.status === "COMPLETED") return false;
    // All jobs must have been enqueued first.
    if (c.enqueuedAt === null) return false;
    // Every attack must be accounted for...
    if (c.completedAttacks < c.totalAttacks) return false;
    // ...and every baseline too (defaults treat missing counts as 0/0).
    const totalBaselines = c.totalBaselines ?? 0;
    const completedBaselines = c.completedBaselines ?? 0;
    if (completedBaselines < totalBaselines) return false;
    // ...and every replay too (T13a; defaults treat missing counts as 0/0, so a
    // run with no replays — single-identity/normal — is unaffected).
    const totalReplays = c.totalReplays ?? 0;
    const completedReplays = c.completedReplays ?? 0;
    if (completedReplays < totalReplays) return false;
    return true;
}

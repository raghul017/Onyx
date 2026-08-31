// =============================================================================
// Tests for isRunComplete — the pure completion gate. Proves a run with N attack
// jobs + M baseline jobs only completes when ALL N+M finish, and that attack and
// baseline progress are tracked independently.
// =============================================================================

import { describe, it, expect } from "vitest";
import { isRunComplete } from "../run-completion.js";

const ENQUEUED = new Date("2026-07-28T00:00:00Z");

// Base: a fully-enqueued, in-flight ATTACKING run.
const run = (over: Partial<Parameters<typeof isRunComplete>[0]> = {}) => ({
    status: "ATTACKING",
    enqueuedAt: ENQUEUED,
    totalAttacks: 0,
    completedAttacks: 0,
    totalBaselines: 0,
    completedBaselines: 0,
    ...over,
});

describe("isRunComplete — attacks + baselines both gate completion", () => {
    it("N attacks + M baselines: NOT complete until all attacks done", () => {
        expect(
            isRunComplete(run({ totalAttacks: 5, completedAttacks: 4, totalBaselines: 2, completedBaselines: 2 })),
        ).toBe(false);
    });

    it("N attacks + M baselines: NOT complete until all baselines done", () => {
        expect(
            isRunComplete(run({ totalAttacks: 5, completedAttacks: 5, totalBaselines: 2, completedBaselines: 1 })),
        ).toBe(false);
    });

    it("complete only when BOTH populations are fully done", () => {
        expect(
            isRunComplete(run({ totalAttacks: 5, completedAttacks: 5, totalBaselines: 2, completedBaselines: 2 })),
        ).toBe(true);
    });

    it("attacks all done but baselines not even started → NOT complete", () => {
        expect(
            isRunComplete(run({ totalAttacks: 3, completedAttacks: 3, totalBaselines: 3, completedBaselines: 0 })),
        ).toBe(false);
    });

    it("attack-only run (no baselines) completes on attacks alone", () => {
        expect(
            isRunComplete(run({ totalAttacks: 10, completedAttacks: 10 })),
        ).toBe(true);
    });

    it("pre-T5 row (baseline counts undefined) behaves as attack-only", () => {
        expect(
            isRunComplete({
                status: "ATTACKING",
                enqueuedAt: ENQUEUED,
                totalAttacks: 4,
                completedAttacks: 4,
                // totalBaselines / completedBaselines omitted entirely
            }),
        ).toBe(true);
    });
});

describe("isRunComplete — guards", () => {
    it("never completes before all jobs are enqueued (enqueuedAt null)", () => {
        expect(
            isRunComplete(run({ enqueuedAt: null, totalAttacks: 2, completedAttacks: 2, totalBaselines: 1, completedBaselines: 1 })),
        ).toBe(false);
    });

    it("never resurrects a terminal (FAILED/COMPLETED) run", () => {
        const done = { totalAttacks: 1, completedAttacks: 1, totalBaselines: 1, completedBaselines: 1 };
        expect(isRunComplete(run({ status: "FAILED", ...done }))).toBe(false);
        expect(isRunComplete(run({ status: "COMPLETED", ...done }))).toBe(false);
    });
});

describe("isRunComplete — attack/baseline counts are independent", () => {
    it("a stuck baseline does not let attack progress complete the run", () => {
        // All attacks done, attack counters look 'full', but a baseline is
        // outstanding — the run must stay open.
        const c = run({ totalAttacks: 20, completedAttacks: 20, totalBaselines: 1, completedBaselines: 0 });
        expect(isRunComplete(c)).toBe(false);
        // ...and finishing the baseline flips it complete without touching attacks.
        expect(isRunComplete({ ...c, completedBaselines: 1 })).toBe(true);
    });
});

describe("isRunComplete — replay (BOLA) counts (T13a)", () => {
    it("a run with outstanding replays stays open until they finish", () => {
        const c = run({
            totalAttacks: 5,
            completedAttacks: 5,
            totalBaselines: 2,
            completedBaselines: 2,
            totalReplays: 3,
            completedReplays: 1,
        });
        expect(isRunComplete(c)).toBe(false);
        expect(isRunComplete({ ...c, completedReplays: 3 })).toBe(true);
    });

    it("backward compat: a run with NO replay counts (undefined) completes on attacks+baselines", () => {
        // Pre-T13 rows / normal single-identity scans have no replay columns set.
        const c = run({ totalAttacks: 3, completedAttacks: 3 });
        expect(isRunComplete(c)).toBe(true);
    });
});

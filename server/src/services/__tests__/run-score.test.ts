// =============================================================================
// Behavior-lock tests for run-score.ts — the run-level score derivation and
// its fire-and-forget persistence. Prisma is fully mocked (no DB, no network);
// we assert the COMPUTED values and the current no-op-on-missing-column policy.
// =============================================================================

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the Prisma client the module imports. Must be declared before importing
// the module under test (vi.mock is hoisted above imports by Vitest).
// vi.hoisted so the fns exist before vi.mock's hoisted factory references them.
const { findMany, update } = vi.hoisted(() => ({ findMany: vi.fn(), update: vi.fn() }));
vi.mock("../../lib/prisma.js", () => ({
    prisma: {
        attackLog: { findMany },
        testRun: { update },
    },
}));

import {
    computeScore,
    isMissingScoreColumn,
    scoreAndPersistRun,
} from "../run-score.js";

type Log = { statusCode: number | null; attackType: string; responseSnippet: string | null };

beforeEach(() => {
    findMany.mockReset();
    update.mockReset();
});

describe("computeScore — derives overallScore + scoreLabel from logs", () => {
    it("empty logs => 100 / CLEAN", () => {
        expect(computeScore([])).toEqual({ overallScore: 100, scoreLabel: "CLEAN" });
    });

    it("one confirmed SQL injection (CRITICAL -25) => 75 / MEDIUM", () => {
        const logs: Log[] = [
            {
                statusCode: 200,
                attackType: "SQL_INJECTION",
                responseSnippet: "You have an error in your SQL syntax",
            },
        ];
        expect(computeScore(logs)).toEqual({ overallScore: 75, scoreLabel: "MEDIUM" });
    });

    it("mixed run: CRITICAL + HIGH + a healthy 401 (LOW)", () => {
        // CRITICAL(-25, SQL error) + HIGH(-15, 5xx non-injection) + LOW(-3, 401) = -43 => 57 / MEDIUM
        const logs: Log[] = [
            { statusCode: 200, attackType: "SQL_INJECTION", responseSnippet: "You have an error in your SQL syntax" },
            { statusCode: 500, attackType: "BOUNDARY", responseSnippet: "" },
            { statusCode: 401, attackType: "MISSING_AUTH", responseSnippet: "" },
        ];
        expect(computeScore(logs)).toEqual({ overallScore: 57, scoreLabel: "MEDIUM" });
    });

    it("tolerates null statusCode / responseSnippet (coerced to 0 / \"\")", () => {
        const logs: Log[] = [{ statusCode: null, attackType: "BOUNDARY", responseSnippet: null }];
        // status 0 => transport-error INFO => no deduction
        expect(computeScore(logs)).toEqual({ overallScore: 100, scoreLabel: "CLEAN" });
    });
});

describe("isMissingScoreColumn — recognizes the pre-migration state", () => {
    it("true for Prisma P2022", () => {
        expect(isMissingScoreColumn({ code: "P2022" })).toBe(true);
    });
    it("true when the message names the score columns", () => {
        expect(isMissingScoreColumn(new Error("column overallScore does not exist"))).toBe(true);
        expect(isMissingScoreColumn(new Error("The column scoreLabel ..."))).toBe(true);
    });
    it("false for an unrelated error", () => {
        expect(isMissingScoreColumn(new Error("connection refused"))).toBe(false);
    });
});

describe("scoreAndPersistRun — persists computed score on the run", () => {
    it("reads logs and writes the derived overallScore + scoreLabel", async () => {
        findMany.mockResolvedValue([
            { statusCode: 200, attackType: "SQL_INJECTION", responseSnippet: "You have an error in your SQL syntax" },
        ]);
        update.mockResolvedValue({});

        await scoreAndPersistRun("run-1234");

        expect(findMany).toHaveBeenCalledWith({
            where: { testRunId: "run-1234" },
            select: { statusCode: true, attackType: true, responseSnippet: true },
        });
        expect(update).toHaveBeenCalledWith({
            where: { id: "run-1234" },
            data: { overallScore: 75, scoreLabel: "MEDIUM" },
        });
    });

    it("swallows the missing-column error (feature-off no-op) without throwing", async () => {
        findMany.mockResolvedValue([]);
        update.mockRejectedValue({ code: "P2022" });
        await expect(scoreAndPersistRun("run-x")).resolves.toBeUndefined();
    });
});

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
    isStoredScoreFresh,
    baseUrlWarning,
    SCORE_VERSION,
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

    it("mixed run: CRITICAL + HIGH + a healthy 401 (INFO, no deduction)", () => {
        // CRITICAL(-25, SQL error) + HIGH(-15, 5xx non-injection) + INFO(0, 401) = -40 => 60 / MEDIUM
        const logs: Log[] = [
            { statusCode: 200, attackType: "SQL_INJECTION", responseSnippet: "You have an error in your SQL syntax" },
            { statusCode: 500, attackType: "BOUNDARY", responseSnippet: "" },
            { statusCode: 401, attackType: "MISSING_AUTH", responseSnippet: "" },
        ];
        expect(computeScore(logs)).toEqual({ overallScore: 60, scoreLabel: "MEDIUM" });
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
            // findingJson (T13b) lets persisted BOLA severities score correctly.
            select: {
                statusCode: true,
                attackType: true,
                responseSnippet: true,
                findingJson: true,
            },
        });
        expect(update).toHaveBeenCalledWith({
            where: { id: "run-1234" },
            data: { overallScore: 75, scoreLabel: "MEDIUM", scoreVersion: SCORE_VERSION },
        });
    });

    it("swallows the missing-column error (feature-off no-op) without throwing", async () => {
        findMany.mockResolvedValue([]);
        update.mockRejectedValue({ code: "P2022" });
        await expect(scoreAndPersistRun("run-x")).resolves.toBeUndefined();
    });
});

describe("isStoredScoreFresh — stale scores from older rules are recomputed", () => {
    it("trusts a score stored by the current rules", () => {
        expect(isStoredScoreFresh({ overallScore: 80, scoreLabel: "LOW", scoreVersion: SCORE_VERSION })).toBe(true);
    });
    it("rejects a score stored by an older rule set", () => {
        expect(isStoredScoreFresh({ overallScore: 0, scoreLabel: "CRITICAL", scoreVersion: 0 })).toBe(false);
    });
    it("rejects a missing score or version", () => {
        expect(isStoredScoreFresh({ overallScore: null, scoreLabel: null, scoreVersion: SCORE_VERSION })).toBe(false);
        expect(isStoredScoreFresh({ overallScore: 90, scoreLabel: "LOW", scoreVersion: null })).toBe(false);
    });
});

// -----------------------------------------------------------------------------
// Mass-404 detection — a run that targeted the wrong base path.
// -----------------------------------------------------------------------------
describe("baseUrlWarning", () => {
    const logs = (n: number, status: number) =>
        Array.from({ length: n }, () => ({ statusCode: status }));

    it("warns when nearly every request 404s", () => {
        const warning = baseUrlWarning([...logs(49, 404), ...logs(1, 200)]);
        expect(warning).toMatch(/98% of requests returned 404/);
        expect(warning).toMatch(/wrong base path/);
    });

    it("stays silent on a normal run with a few 404s", () => {
        expect(baseUrlWarning([...logs(10, 404), ...logs(40, 200)])).toBeNull();
    });

    it("stays silent when there are too few results to be representative", () => {
        expect(baseUrlWarning(logs(10, 404))).toBeNull();
    });

    it("ignores transport failures (status 0) when computing the ratio", () => {
        // 30 unreachable + 30 genuine 404s => 100% of ANSWERED requests 404'd.
        expect(baseUrlWarning([...logs(30, 0), ...logs(30, 404)])).toMatch(/100%/);
    });
});

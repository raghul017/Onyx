// =============================================================================
// Behavior-lock tests for the scoring math in severity.ts:
//   - getOverallScore: start 100; deduct CRITICAL -25, HIGH -15, MEDIUM -8,
//     LOW -3, INFO 0; clamp at >= 0.
//   - getScoreLabel: <=25 CRITICAL, <=50 HIGH, <=75 MEDIUM, <=99 LOW, 100 CLEAN.
//   - getSeverity: thin wrapper over analyzeFinding (no payload passed, so the
//     reflection-based XSS upgrade never fires on this path).
// =============================================================================

import { describe, it, expect } from "vitest";
import {
    getOverallScore,
    getScoreLabel,
    getSeverity,
    type ScoredLog,
    type ScoreLabel,
} from "../severity.js";

const log = (severity: ScoredLog["severity"]): ScoredLog => ({ severity });

describe("getOverallScore — deductions + clamp", () => {
    it("empty logs => perfect 100", () => {
        expect(getOverallScore([])).toBe(100);
    });

    const perSeverity: [ScoredLog["severity"], number][] = [
        ["CRITICAL", 75], // 100 - 25
        ["HIGH", 85], //     100 - 15
        ["MEDIUM", 92], //   100 - 8
        ["LOW", 97], //      100 - 3
        ["INFO", 100], //    100 - 0
    ];
    for (const [sev, expected] of perSeverity) {
        it(`single ${sev} log => ${expected}`, () => {
            expect(getOverallScore([log(sev)])).toBe(expected);
        });
    }

    it("mixed severities sum their deductions", () => {
        // 25 + 15 + 8 + 3 + 0 = 51 deducted => 49
        const score = getOverallScore([
            log("CRITICAL"),
            log("HIGH"),
            log("MEDIUM"),
            log("LOW"),
            log("INFO"),
        ]);
        expect(score).toBe(49);
    });

    it("clamps at 0 and never goes negative", () => {
        // 5 * 25 = 125 deducted, clamped to 0
        const score = getOverallScore(Array.from({ length: 5 }, () => log("CRITICAL")));
        expect(score).toBe(0);
    });
});

describe("getScoreLabel — threshold boundaries", () => {
    const cases: [number, ScoreLabel][] = [
        [0, "CRITICAL"],
        [25, "CRITICAL"],
        [26, "HIGH"],
        [50, "HIGH"],
        [51, "MEDIUM"],
        [75, "MEDIUM"],
        [76, "LOW"],
        [99, "LOW"],
        [100, "CLEAN"],
    ];
    for (const [score, label] of cases) {
        it(`score ${score} => ${label}`, () => {
            expect(getScoreLabel(score)).toBe(label);
        });
    }

    it("empty run scores 100 => CLEAN end-to-end", () => {
        expect(getScoreLabel(getOverallScore([]))).toBe("CLEAN");
    });
});

describe("getSeverity — wrapper (no payload => no XSS reflection upgrade)", () => {
    it("SQL error body still classified CRITICAL", () => {
        expect(getSeverity("SQL_INJECTION", 200, "You have an error in your SQL syntax")).toBe(
            "CRITICAL",
        );
    });

    it("XSS markup in body but no payload arg => not upgraded (INFO)", () => {
        // getSeverity does not pass a payload, so isReflected() can't fire.
        expect(getSeverity("XSS", 200, "<script>alert(1)</script>")).toBe("INFO");
    });

    it("5xx on a non-injection type => HIGH", () => {
        expect(getSeverity("BOUNDARY", 500, "")).toBe("HIGH");
    });
});

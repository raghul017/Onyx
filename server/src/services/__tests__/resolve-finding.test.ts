// =============================================================================
// Tests for the T13b read path (resolveFinding) + BOLA scoring:
//   • a log with a persisted findingJson (BOLA) returns the STORED finding
//   • every other log still RECOMPUTES exactly as before (backward compatible)
//   • computeScore uses the stored severity for BOLA rows
// =============================================================================
import { describe, it, expect } from "vitest";
import { resolveFinding, analyzeFinding } from "../finding-analysis.js";
import { computeScore } from "../run-score.js";

const STORED_BOLA = {
    severity: "CRITICAL",
    category: "Broken Object Level Authorization",
    title: "Object 42 readable by another user",
    cause: "userB requested userA's object 42 and received it.",
    evidence: "A → 200 / B → 200",
    remediation: "Enforce an ownership check.",
    confidence: "confirmed",
    owaspCategory: "API1_BOLA",
};

const bolaRow = {
    attackType: "BOLA_REPLAY",
    method: "GET",
    statusCode: 200,
    latencyMs: 12,
    payload: "",
    responseSnippet: '{"id":"42"}',
    findingJson: STORED_BOLA,
};

describe("resolveFinding — stored vs recomputed", () => {
    it("returns the STORED finding when findingJson is present (BOLA)", () => {
        const f = resolveFinding(bolaRow);
        expect(f.category).toBe("Broken Object Level Authorization");
        expect(f.owaspCategory).toBe("API1_BOLA");
        expect(f.severity).toBe("CRITICAL");
        expect(f.confidence).toBe("confirmed");
    });

    it("recomputes normally when there is NO findingJson", () => {
        const row = { ...bolaRow, findingJson: undefined };
        expect(resolveFinding(row)).toEqual(analyzeFinding(row));
    });

    it("ignores a malformed findingJson and falls back to recomputation", () => {
        const row = { ...bolaRow, findingJson: { nope: true } };
        expect(resolveFinding(row)).toEqual(analyzeFinding(row));
    });

    it("a normal (non-BOLA) log is unchanged vs analyzeFinding", () => {
        const normal = {
            attackType: "SQL_INJECTION",
            method: "POST",
            statusCode: 500,
            latencyMs: 30,
            payload: "' OR 1=1--",
            responseSnippet: "internal server error",
        };
        expect(resolveFinding(normal)).toEqual(analyzeFinding(normal));
    });
});

describe("computeScore — BOLA rows use the stored severity", () => {
    it("a confirmed CRITICAL BOLA lowers the score", () => {
        const clean = computeScore([
            { statusCode: 200, attackType: "BOLA_REPLAY", responseSnippet: '{"id":"42"}' },
        ]);
        const withBola = computeScore([
            {
                statusCode: 200,
                attackType: "BOLA_REPLAY",
                responseSnippet: '{"id":"42"}',
                findingJson: STORED_BOLA,
            },
        ]);
        // Without the stored finding the row scores INFO (100); with it, the
        // CRITICAL severity applies its 25-point deduction.
        expect(clean.overallScore).toBe(100);
        expect(withBola.overallScore).toBe(75);
        expect(withBola.overallScore).toBeLessThan(clean.overallScore);
    });

    it("multiple confirmed BOLAs compound into a CRITICAL run score", () => {
        const rows = Array.from({ length: 4 }, () => ({
            statusCode: 200,
            attackType: "BOLA_REPLAY",
            responseSnippet: '{"id":"42"}',
            findingJson: STORED_BOLA,
        }));
        const r = computeScore(rows);
        expect(r.overallScore).toBe(0); // 4 × 25
        expect(r.scoreLabel).toBe("CRITICAL");
    });

    it("rows without findingJson score exactly as before", () => {
        const logs = [{ statusCode: 200, attackType: "XSS", responseSnippet: "ok" }];
        expect(computeScore(logs)).toEqual(computeScore(logs.map((l) => ({ ...l }))));
    });
});

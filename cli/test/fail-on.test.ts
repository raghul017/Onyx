// fail-on threshold → exit code, at every severity boundary.
import { describe, it, expect } from "vitest";
import { computeExitCode, hasFindingAtOrAbove } from "../src/findings.js";
import type { Severity } from "../src/types.js";

const f = (severity: Severity) => ({ severity });

describe("computeExitCode — --fail-on boundaries", () => {
    it("no findings → 0 for any threshold", () => {
        expect(computeExitCode([], "critical")).toBe(0);
        expect(computeExitCode([], "low")).toBe(0);
    });

    it("critical threshold: only CRITICAL fails", () => {
        expect(computeExitCode([f("HIGH"), f("MEDIUM")], "critical")).toBe(0);
        expect(computeExitCode([f("CRITICAL")], "critical")).toBe(1);
    });

    it("high threshold: HIGH and CRITICAL fail, not MEDIUM", () => {
        expect(computeExitCode([f("MEDIUM"), f("LOW")], "high")).toBe(0);
        expect(computeExitCode([f("HIGH")], "high")).toBe(1);
        expect(computeExitCode([f("CRITICAL")], "high")).toBe(1);
    });

    it("medium threshold: MEDIUM+ fail, not LOW", () => {
        expect(computeExitCode([f("LOW")], "medium")).toBe(0);
        expect(computeExitCode([f("MEDIUM")], "medium")).toBe(1);
    });

    it("low threshold: any LOW+ fails, INFO never reaches here (excluded from findings)", () => {
        expect(computeExitCode([f("LOW")], "low")).toBe(1);
        expect(computeExitCode([f("INFO")], "low")).toBe(0);
    });

    it("hasFindingAtOrAbove matches computeExitCode", () => {
        expect(hasFindingAtOrAbove([f("HIGH")], "high")).toBe(true);
        expect(hasFindingAtOrAbove([f("MEDIUM")], "high")).toBe(false);
    });
});

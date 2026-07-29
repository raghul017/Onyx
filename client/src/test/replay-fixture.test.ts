// =============================================================================
// Guards the homepage live-console replay fixture (T21-demo): realistic row shape
// and a believable mix (confirmed findings across severities + handled 2xx info
// probes), so the replay reads as authentic rather than invented.
// =============================================================================
import { describe, it, expect } from "vitest";
import { REPLAY_ROWS } from "../data/replayFixture";

const METHODS = new Set(["GET", "POST", "PUT", "DELETE", "PATCH"]);

describe("REPLAY_ROWS", () => {
    it("every row has a realistic AttackResult-like shape", () => {
        for (const r of REPLAY_ROWS) {
            expect(METHODS.has(r.method)).toBe(true);
            expect(r.endpoint.startsWith("/")).toBe(true);
            expect(r.statusCode).toBeGreaterThanOrEqual(100);
            expect(r.statusCode).toBeLessThan(600);
            expect(r.responseTime).toBeGreaterThan(0);
            expect(r.attackType.length).toBeGreaterThan(0);
        }
    });

    it("owaspCode, when present, is API1…API10", () => {
        for (const r of REPLAY_ROWS) {
            if (r.owaspCode) expect(r.owaspCode).toMatch(/^API([1-9]|10)$/);
        }
    });

    it("has a believable mix — confirmed findings AND handled info probes", () => {
        const findings = REPLAY_ROWS.filter((r) => r.severity !== "INFO");
        const info = REPLAY_ROWS.filter((r) => r.severity === "INFO");
        const criticals = REPLAY_ROWS.filter((r) => r.severity === "CRITICAL");
        expect(findings.length).toBeGreaterThanOrEqual(2);
        expect(info.length).toBeGreaterThanOrEqual(1);
        expect(criticals.length).toBeGreaterThanOrEqual(1);
    });

    it("is capped to a small, performant set", () => {
        expect(REPLAY_ROWS.length).toBeLessThanOrEqual(20);
    });
});

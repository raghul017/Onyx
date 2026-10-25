import { describe, it, expect } from "vitest";
import {
    endpointCapFor,
    mapWithConcurrency,
    MAX_ENDPOINTS_PER_RUN,
    PLAN_LIMITS,
} from "../plan-limits.js";

describe("endpointCapFor — matches what pricing promises", () => {
    it("Free 10 · Pro 50 · Team 200", () => {
        expect(endpointCapFor("FREE")).toBe(10);
        expect(endpointCapFor("PRO")).toBe(50);
        expect(endpointCapFor("TEAM")).toBe(200);
    });
    it("never exceeds the safety ceiling", () => {
        for (const plan of Object.keys(PLAN_LIMITS) as Array<keyof typeof PLAN_LIMITS>) {
            expect(endpointCapFor(plan)).toBeLessThanOrEqual(MAX_ENDPOINTS_PER_RUN);
        }
    });
    it("run quotas are unchanged", () => {
        expect(PLAN_LIMITS.FREE.testRunsPerMonth).toBe(5);
        expect(PLAN_LIMITS.PRO.testRunsPerMonth).toBe(100);
        expect(PLAN_LIMITS.TEAM.testRunsPerMonth).toBe(500);
    });
});

describe("mapWithConcurrency — paces Gemini calls", () => {
    it("never has more than `limit` calls in flight and keeps order", async () => {
        let inFlight = 0;
        let peak = 0;
        const out = await mapWithConcurrency([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 4, async (n) => {
            inFlight++;
            peak = Math.max(peak, inFlight);
            await new Promise((r) => setTimeout(r, 5));
            inFlight--;
            return n * 2;
        });
        expect(peak).toBe(4);
        expect(out).toEqual([2, 4, 6, 8, 10, 12, 14, 16, 18, 20]);
    });
    it("handles an empty list", async () => {
        expect(await mapWithConcurrency([], 4, async (n: number) => n)).toEqual([]);
    });
});

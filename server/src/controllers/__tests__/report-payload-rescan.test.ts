// =============================================================================
// T15b read path: buildReportPayload must surface resolvedAt / lastCheckedAt so
// the client can render a "Resolved" badge — and must emit nulls (not undefined
// or a crash) for the overwhelming majority of rows that were never re-scanned.
// =============================================================================
import { describe, it, expect } from "vitest";
import { buildReportPayload } from "../test-run.controller.js";

const baseRun = {
    id: "run-1",
    specUrl: "https://api.example.com/openapi.json",
    status: "COMPLETED",
    totalEndpoints: 1,
    totalAttacks: 2,
    completedAttacks: 2,
    createdAt: new Date("2026-08-31T10:00:00Z"),
    completedAt: new Date("2026-08-31T10:05:00Z"),
};

const log = (over: Record<string, unknown> = {}) => ({
    id: "l1",
    testRunId: "run-1",
    method: "GET",
    path: "/users",
    statusCode: 200,
    latencyMs: 10,
    payload: "",
    responseSnippet: "{}",
    attackType: "SQL_INJECTION",
    createdAt: new Date("2026-08-31T10:01:00Z"),
    ...over,
});

describe("report payload — re-scan state", () => {
    it("emits null for rows never re-scanned (backward compatible)", () => {
        const out = buildReportPayload({ ...baseRun, logs: [log()] });
        expect(out.logs[0]!.resolvedAt).toBeNull();
        expect(out.logs[0]!.lastCheckedAt).toBeNull();
    });

    it("surfaces resolvedAt + lastCheckedAt as ISO strings when set", () => {
        const resolvedAt = new Date("2026-08-31T11:00:00Z");
        const lastCheckedAt = new Date("2026-08-31T11:00:00Z");
        const out = buildReportPayload({
            ...baseRun,
            logs: [log({ id: "l2", resolvedAt, lastCheckedAt })],
        });
        expect(out.logs[0]!.resolvedAt).toBe(resolvedAt.toISOString());
        expect(out.logs[0]!.lastCheckedAt).toBe(lastCheckedAt.toISOString());
    });

    it("a still-present finding has lastCheckedAt but resolvedAt null", () => {
        const out = buildReportPayload({
            ...baseRun,
            logs: [log({ resolvedAt: null, lastCheckedAt: new Date("2026-08-31T11:00:00Z") })],
        });
        expect(out.logs[0]!.resolvedAt).toBeNull();
        expect(out.logs[0]!.lastCheckedAt).toBeTruthy();
    });

    it("the run score is NOT affected by re-scan state (single-finding recheck)", () => {
        const without = buildReportPayload({ ...baseRun, logs: [log()] });
        const withResolved = buildReportPayload({
            ...baseRun,
            logs: [log({ resolvedAt: new Date(), lastCheckedAt: new Date() })],
        });
        expect(withResolved.summary.overallScore).toBe(without.summary.overallScore);
    });
});

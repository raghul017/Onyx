// =============================================================================
// Tests for rescanFinding (T15b). Prisma and the HTTP firer are mocked, so no
// live DB and no network. Verdicts come from the REAL services (analyzeFinding /
// mass-assignment / data-exposure), so these also prove the reuse is wired.
// =============================================================================
import { describe, it, expect, vi, beforeEach } from "vitest";

const findUnique = vi.fn();
const update = vi.fn();
const baselineFindUnique = vi.fn();
const identityFindUnique = vi.fn();

vi.mock("../../lib/prisma.js", () => ({
    prisma: {
        attackLog: {
            findUnique: (...a: unknown[]) => findUnique(...a),
            update: (...a: unknown[]) => update(...a),
        },
        baselineResponse: { findUnique: (...a: unknown[]) => baselineFindUnique(...a) },
        runIdentity: { findUnique: (...a: unknown[]) => identityFindUnique(...a) },
    },
}));
// The SSRF guard resolves DNS; stub it so tests stay offline.
vi.mock("../../lib/ssrf-guard.js", () => ({ assertNotSSRF: vi.fn().mockResolvedValue(undefined) }));

const { rescanFinding, baseUrlFromSpec } = await import("../rescan.service.js");

const row = (over: Record<string, unknown> = {}) => ({
    id: "log-1",
    testRunId: "run-1",
    endpointId: "ep-1",
    method: "POST",
    path: "/users",
    payload: "' OR 1=1--",
    attackType: "SQL_INJECTION",
    identityId: null,
    findingJson: null,
    testRun: { specUrl: "https://api.example.com/openapi.json" },
    endpoint: { requestBodySchema: null },
    ...over,
});

beforeEach(() => {
    [findUnique, update, baselineFindUnique, identityFindUnique].forEach((m) => m.mockReset());
    update.mockResolvedValue({});
    baselineFindUnique.mockResolvedValue(null);
});

describe("baseUrlFromSpec", () => {
    it("derives the API origin from the spec URL", () => {
        expect(baseUrlFromSpec("https://api.example.com/v1/openapi.json")).toBe(
            "https://api.example.com",
        );
        expect(baseUrlFromSpec("not a url")).toBe("");
    });
});

describe("normal attack findings", () => {
    it("SAFE now => resolved=true and resolvedAt is set", async () => {
        findUnique.mockResolvedValue(row());
        // A clean 200 with no error signature => analyzeFinding returns INFO.
        const fire = vi.fn().mockResolvedValue({
            statusCode: 200, latencyMs: 12, snippet: '{"ok":true}', bodyLength: 11,
        });

        const res = await rescanFinding("log-1", { fire });
        expect(res.outcome).toBe("resolved");
        expect(res.resolved).toBe(true);
        expect(res.checkedAt).toBeTruthy();

        const data = update.mock.calls[0]![0].data;
        expect(data.resolvedAt).toBeInstanceOf(Date);
        expect(data.lastCheckedAt).toBeInstanceOf(Date);
    });

    it("STILL vulnerable => resolved=false, lastCheckedAt set, resolvedAt null", async () => {
        findUnique.mockResolvedValue(row());
        // A reflected SQL error is a confirmed finding in analyzeFinding.
        const fire = vi.fn().mockResolvedValue({
            statusCode: 500,
            latencyMs: 30,
            snippet: 'You have an error in your SQL syntax near "OR 1=1"',
            bodyLength: 50,
        });

        const res = await rescanFinding("log-1", { fire });
        expect(res.outcome).toBe("still_present");
        expect(res.resolved).toBe(false);
        expect(res.severity).toBeTruthy();
        expect(res.category).toBeTruthy();

        const data = update.mock.calls[0]![0].data;
        expect(data.resolvedAt).toBeNull();      // a regression clears resolved
        expect(data.lastCheckedAt).toBeInstanceOf(Date);
    });
});

describe("mass assignment (API3) is supported", () => {
    const maRow = row({
        attackType: "MASS_ASSIGNMENT",
        endpoint: {
            requestBodySchema: { type: "object", properties: { name: { type: "string" } } },
        },
    });

    it("still reflects the injected privileged field => still_present", async () => {
        findUnique.mockResolvedValue(maRow);
        const fire = vi.fn().mockResolvedValue({
            statusCode: 201,
            latencyMs: 20,
            snippet: '{"id":1,"name":"test","role":"onyx_admin_probe"}',
            bodyLength: 48,
        });
        const res = await rescanFinding("log-1", { fire });
        expect(res.outcome).toBe("still_present");
        expect(res.category).toBe("Mass Assignment");
    });

    it("field no longer reflected => resolved", async () => {
        findUnique.mockResolvedValue(maRow);
        const fire = vi.fn().mockResolvedValue({
            statusCode: 201, latencyMs: 20, snippet: '{"id":1,"name":"test"}', bodyLength: 22,
        });
        const res = await rescanFinding("log-1", { fire });
        expect(res.outcome).toBe("resolved");
        expect(res.resolved).toBe(true);
    });
});

describe("data exposure (API3) is supported", () => {
    const deRow = row({ attackType: "DATA_EXPOSURE", method: "GET" });

    it("still exposes a credential field => still_present", async () => {
        findUnique.mockResolvedValue(deRow);
        const fire = vi.fn().mockResolvedValue({
            statusCode: 200, latencyMs: 15, snippet: '{"id":1,"ssn":"123-45-6789"}', bodyLength: 28,
        });
        const res = await rescanFinding("log-1", { fire });
        expect(res.outcome).toBe("still_present");
        expect(res.category).toBe("Excessive Data Exposure");
    });

    it("field removed => resolved", async () => {
        findUnique.mockResolvedValue(deRow);
        const fire = vi.fn().mockResolvedValue({
            statusCode: 200, latencyMs: 15, snippet: '{"id":1,"name":"Ann"}', bodyLength: 21,
        });
        const res = await rescanFinding("log-1", { fire });
        expect(res.outcome).toBe("resolved");
    });
});

describe("deferred + error paths return a CLEAR result, never a wrong verdict", () => {
    it("BOLA_REPLAY => unsupported", async () => {
        findUnique.mockResolvedValue(row({ attackType: "BOLA_REPLAY" }));
        const res = await rescanFinding("log-1", { fire: vi.fn() });
        expect(res.outcome).toBe("unsupported");
        expect(res.resolved).toBe(false);
        expect(res.message).toMatch(/BOLA|cross-identity/i);
        expect(update).not.toHaveBeenCalled(); // never marks anything resolved
    });

    it("BFLA_PROBE => unsupported", async () => {
        findUnique.mockResolvedValue(row({ attackType: "BFLA_PROBE" }));
        const res = await rescanFinding("log-1", { fire: vi.fn() });
        expect(res.outcome).toBe("unsupported");
    });

    it("missing log => error, nothing updated", async () => {
        findUnique.mockResolvedValue(null);
        const res = await rescanFinding("nope", { fire: vi.fn() });
        expect(res.outcome).toBe("error");
        expect(update).not.toHaveBeenCalled();
    });

    it("a firing failure => error, NOT a false 'resolved'", async () => {
        findUnique.mockResolvedValue(row());
        const fire = vi.fn().mockRejectedValue(new Error("connect ECONNREFUSED"));
        const res = await rescanFinding("log-1", { fire });
        expect(res.outcome).toBe("error");
        expect(res.resolved).toBe(false);
        expect(update).not.toHaveBeenCalled(); // must never mark resolved on failure
    });
});

// =============================================================================
// T15b-fix — the re-fired request must use the endpoint's PERSISTED parameters,
// so a query/header-parameter finding is reconstructed exactly and cannot
// false-resolve. Legacy rows (parameters null) must still work.
// =============================================================================
describe("T15b-fix — re-fires with the stored endpoint parameters", () => {
    const queryParamRow = (params: unknown) =>
        row({
            method: "GET",
            path: "/search",
            payload: "' OR 1=1--",
            attackType: "SQL_INJECTION",
            endpoint: { requestBodySchema: null, parameters: params },
        });

    it("injects the payload into the stored QUERY parameter (URL carries it)", async () => {
        findUnique.mockResolvedValue(
            queryParamRow([{ name: "q", in: "query", required: true, schema: null }]),
        );
        const fire = vi.fn().mockResolvedValue({
            statusCode: 200, latencyMs: 10, snippet: "{}", bodyLength: 2,
        });

        await rescanFinding("log-1", { fire });

        const sent = fire.mock.calls[0]![0];
        // The stored param name must appear in the re-fired URL...
        expect(sent.url).toContain("q=");
        // ...carrying the ORIGINAL payload (url-encoded), not a benign dummy.
        expect(decodeURIComponent(sent.url)).toContain("' OR 1=1--");
    });

    it("a STILL-vulnerable query-param finding is NOT falsely resolved", async () => {
        findUnique.mockResolvedValue(
            queryParamRow([{ name: "q", in: "query", required: true, schema: null }]),
        );
        // The target still reflects a SQL error for the injected query param.
        const fire = vi.fn().mockResolvedValue({
            statusCode: 500,
            latencyMs: 25,
            snippet: 'You have an error in your SQL syntax near "OR 1=1"',
            bodyLength: 50,
        });

        const res = await rescanFinding("log-1", { fire });
        expect(res.outcome).toBe("still_present");
        expect(res.resolved).toBe(false);
    });

    it("a genuinely FIXED query-param finding resolves", async () => {
        findUnique.mockResolvedValue(
            queryParamRow([{ name: "q", in: "query", required: true, schema: null }]),
        );
        const fire = vi.fn().mockResolvedValue({
            // A clean 4xx rejection (no leaky wording) — "Input Rejected",
            // which means validation now works => the finding is fixed.
            statusCode: 400, latencyMs: 8, snippet: '{"message":"Bad Request"}', bodyLength: 25,
        });
        const res = await rescanFinding("log-1", { fire });
        expect(res.resolved).toBe(true);
        expect(res.outcome).toBe("resolved");
    });

    it("passes stored HEADER parameters through too", async () => {
        findUnique.mockResolvedValue(
            queryParamRow([{ name: "X-Tenant", in: "header", required: false, schema: null }]),
        );
        const fire = vi.fn().mockResolvedValue({
            statusCode: 200, latencyMs: 10, snippet: "{}", bodyLength: 2,
        });
        await rescanFinding("log-1", { fire });
        const sent = fire.mock.calls[0]![0];
        expect(Object.keys(sent.headers)).toContain("X-Tenant");
    });

    it("LEGACY row with parameters=null still works (falls back to [])", async () => {
        findUnique.mockResolvedValue(queryParamRow(null));
        const fire = vi.fn().mockResolvedValue({
            statusCode: 200, latencyMs: 10, snippet: "{}", bodyLength: 2,
        });
        const res = await rescanFinding("log-1", { fire });
        expect(res.outcome).toBe("resolved"); // no crash, pre-fix behavior
        expect(fire).toHaveBeenCalledTimes(1);
    });

    it("tolerates a malformed parameters value without crashing", async () => {
        findUnique.mockResolvedValue(queryParamRow({ not: "an array" }));
        const fire = vi.fn().mockResolvedValue({
            statusCode: 200, latencyMs: 10, snippet: "{}", bodyLength: 2,
        });
        const res = await rescanFinding("log-1", { fire });
        expect(res.outcome).toBe("resolved");
    });
});

// =============================================================================
// Regression guard: a patched endpoint that now REJECTS the payload must resolve.
// analyzeFinding classifies that as "Input Rejected" — LOW severity but
// confidence "info" ("input validation is doing its job"). A severity-only
// check would call it still-present and the finding could never be resolved.
// =============================================================================
describe("a patched endpoint that now rejects input resolves", () => {
    it("'Input Rejected' (LOW + confidence info) counts as FIXED", async () => {
        findUnique.mockResolvedValue(row());
        const fire = vi.fn().mockResolvedValue({
            statusCode: 400, latencyMs: 8, snippet: '{"message":"Bad Request"}', bodyLength: 25,
        });
        const res = await rescanFinding("log-1", { fire });
        expect(res.outcome).toBe("resolved");
        expect(res.resolved).toBe(true);
    });

    it("a 403 (Access Control Enforced) also counts as FIXED", async () => {
        findUnique.mockResolvedValue(row({ attackType: "MISSING_AUTH" }));
        const fire = vi.fn().mockResolvedValue({
            statusCode: 403, latencyMs: 9, snippet: '{"message":"Forbidden"}', bodyLength: 23,
        });
        const res = await rescanFinding("log-1", { fire });
        expect(res.resolved).toBe(true);
    });

    it("but a leaky 4xx (verbose error) is STILL a finding", async () => {
        findUnique.mockResolvedValue(row());
        const fire = vi.fn().mockResolvedValue({
            statusCode: 400,
            latencyMs: 8,
            snippet: '{"error":"java.lang.NumberFormatException: For input string: \\"abc\\""}',
            bodyLength: 70,
        });
        const res = await rescanFinding("log-1", { fire });
        expect(res.outcome).toBe("still_present");
    });
});

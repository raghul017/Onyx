// =============================================================================
// Tests for mass-assignment detection (T14b, API3). Conservative: a finding only
// when the write SUCCEEDS and a PRIVILEGED field we injected is reflected back
// WITH OUR PROBE VALUE. Everything else is safe.
// =============================================================================
import { describe, it, expect, vi } from "vitest";
import {
    isMassAssignmentCandidate,
    buildMassAssignmentBody,
    findReflectedField,
    decideMassAssignmentVerdict,
    PROBE_STRING,
    type MassAssignmentVerdictInput,
} from "../mass-assignment.js";

const objSchema = {
    type: "object",
    properties: { name: { type: "string" }, qty: { type: "integer" } },
} as Record<string, unknown>;

describe("candidate selection — only writes with an object body", () => {
    it("accepts POST/PUT/PATCH with an object schema", () => {
        for (const method of ["POST", "PUT", "PATCH"]) {
            expect(isMassAssignmentCandidate({ method, requestBodySchema: objSchema })).toBe(true);
        }
    });
    it("rejects GET/DELETE (no body to mass-assign)", () => {
        for (const method of ["GET", "DELETE"]) {
            expect(isMassAssignmentCandidate({ method, requestBodySchema: objSchema })).toBe(false);
        }
    });
    it("rejects writes with no/!object body schema", () => {
        expect(isMassAssignmentCandidate({ method: "POST", requestBodySchema: null })).toBe(false);
        expect(
            isMassAssignmentCandidate({ method: "POST", requestBodySchema: { type: "string" } }),
        ).toBe(false);
    });
});

describe("probe body", () => {
    it("keeps schema fields (valid body) and adds privileged fields", () => {
        const { body, injected } = buildMassAssignmentBody(objSchema);
        const parsed = JSON.parse(body);
        expect(parsed.name).toBe("test"); // schema dummy preserved
        expect(parsed.qty).toBe(1);
        expect(parsed.role).toBe(PROBE_STRING); // injected
        expect(parsed.isAdmin).toBe(true);
        expect(injected).toContain("role");
    });

    it("does NOT inject a field the schema already declares (not an injection)", () => {
        const withRole = {
            type: "object",
            properties: { role: { type: "string" }, name: { type: "string" } },
        } as Record<string, unknown>;
        const { body, injected } = buildMassAssignmentBody(withRole);
        expect(injected).not.toContain("role");
        expect(JSON.parse(body).role).toBe("test"); // the schema dummy, not the probe
    });
});

describe("findReflectedField — value must match our probe", () => {
    const injected = ["role", "isAdmin"];
    it("finds a reflected field in JSON", () => {
        expect(findReflectedField(`{"id":1,"role":"${PROBE_STRING}"}`, injected)).toBe("role");
    });
    it("finds it nested", () => {
        expect(
            findReflectedField(`{"data":{"user":{"role":"${PROBE_STRING}"}}}`, injected),
        ).toBe("role");
    });
    it("ignores the field when the value is NOT ours (server set its own)", () => {
        expect(findReflectedField('{"id":1,"role":"user"}', injected)).toBeNull();
    });
    it("ignores a mere mention of the key in an error string", () => {
        expect(findReflectedField('{"error":"role is not allowed"}', injected)).toBeNull();
    });
});

const base = (over: Partial<MassAssignmentVerdictInput> = {}): MassAssignmentVerdictInput => ({
    method: "POST",
    path: "/users",
    statusCode: 201,
    responseSnippet: `{"id":7,"name":"test","role":"${PROBE_STRING}"}`,
    requestBody: `{"name":"test","role":"${PROBE_STRING}"}`,
    injectedFields: ["role", "isAdmin"],
    ...over,
});

describe("decideMassAssignmentVerdict", () => {
    it("2xx + reflected privileged field => CONFIRMED (API3)", async () => {
        const f = await decideMassAssignmentVerdict(base());
        expect(f).not.toBeNull();
        expect(f!.owaspCategory).toBe("API3_BROKEN_OBJECT_PROPERTY_LEVEL_AUTHORIZATION");
        expect(f!.category).toBe("Mass Assignment");
        expect(f!.severity).toBe("HIGH");
        expect(f!.confidence).toBe("firm"); // no judge → deterministic
        expect(f!.cause).toContain("role");
        expect(f!.evidence).toContain("request");
        expect(f!.evidence).toContain("response");
        expect(f!.remediation).toMatch(/allow-list/i);
    });

    it("4xx (input rejected) => no finding", async () => {
        expect(await decideMassAssignmentVerdict(base({ statusCode: 400 }))).toBeNull();
        expect(await decideMassAssignmentVerdict(base({ statusCode: 422 }))).toBeNull();
    });

    it("2xx but the field is NOT reflected (server ignored it) => no finding", async () => {
        expect(
            await decideMassAssignmentVerdict(
                base({ responseSnippet: '{"id":7,"name":"test"}' }),
            ),
        ).toBeNull();
    });

    it("a NON-privileged reflected field is never a finding", async () => {
        // "name" is normal client input — it isn't in the privileged list, so it
        // is never among injectedFields and can't produce a verdict.
        expect(
            await decideMassAssignmentVerdict(
                base({
                    injectedFields: [],
                    responseSnippet: '{"id":7,"name":"test"}',
                }),
            ),
        ).toBeNull();
    });

    it("judge VETO => no finding; judge agreement => confirmed", async () => {
        const no = vi.fn().mockResolvedValue({ isSensitive: false, reason: "public field" });
        expect(await decideMassAssignmentVerdict(base(), no)).toBeNull();

        const yes = vi.fn().mockResolvedValue({ isSensitive: true });
        const f = await decideMassAssignmentVerdict(base(), yes);
        expect(f!.confidence).toBe("confirmed");
    });

    it("judge throws / returns null => deterministic verdict stands", async () => {
        const boom = vi.fn().mockRejectedValue(new Error("gemini down"));
        expect((await decideMassAssignmentVerdict(base(), boom))!.confidence).toBe("firm");
        const nul = vi.fn().mockResolvedValue(null);
        expect((await decideMassAssignmentVerdict(base(), nul))!.confidence).toBe("firm");
    });
});

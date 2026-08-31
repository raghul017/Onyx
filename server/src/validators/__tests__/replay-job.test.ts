// =============================================================================
// Regression guard (T14a): cross-identity replay jobs must VALIDATE.
//
// BOLA_REPLAY was missing from attackTypeEnum, so every replay job failed the
// worker's safeParse and was dropped before reaching the replay branch — BOLA
// silently never ran. Lock both probe types in, plus the checkType default.
// =============================================================================
import { describe, it, expect } from "vitest";
import { attackJobDataSchema } from "../schemas.js";

const base = {
    testRunId: "11111111-1111-1111-1111-111111111111",
    endpointId: "22222222-2222-2222-2222-222222222222",
    method: "GET" as const,
    path: "/admin/users",
    baseUrl: "https://api.example.com",
    payload: "",
    kind: "replay" as const,
    sourceIdentityId: "33333333-3333-3333-3333-333333333333",
    targetIdentityId: "44444444-4444-4444-4444-444444444444",
};

describe("replay job validation", () => {
    it("accepts a BOLA replay job", () => {
        const r = attackJobDataSchema.safeParse({
            ...base,
            attackType: "BOLA_REPLAY",
            objectId: "42",
            idParamName: "id",
        });
        expect(r.success).toBe(true);
        expect(r.success && r.data.checkType).toBe("bola"); // default
    });

    it("accepts a BFLA probe job", () => {
        const r = attackJobDataSchema.safeParse({
            ...base,
            attackType: "BFLA_PROBE",
            checkType: "bfla",
            privilegedReason: 'administrative path segment "/admin"',
        });
        expect(r.success).toBe(true);
        expect(r.success && r.data.checkType).toBe("bfla");
    });

    it("still accepts ordinary attack jobs unchanged", () => {
        const r = attackJobDataSchema.safeParse({
            ...base,
            kind: "attack",
            attackType: "SQL_INJECTION",
            payload: "' OR 1=1--",
        });
        expect(r.success).toBe(true);
    });

    it("rejects an unknown attackType", () => {
        const r = attackJobDataSchema.safeParse({ ...base, attackType: "NOT_A_TYPE" });
        expect(r.success).toBe(false);
    });
});

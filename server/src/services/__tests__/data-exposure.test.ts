// =============================================================================
// Tests for excessive-data-exposure detection (T14c, API3). Value-aware and
// conservative: a key alone never counts, PII only counts in bulk, and a body
// already covered by the T1 SECRET_LEAK rule is skipped (no double-flag).
// =============================================================================
import { describe, it, expect, vi } from "vitest";
import {
    analyzeResponseExposure,
    decideExposureVerdict,
    hasSecretLeak,
} from "../data-exposure.js";

const j = (o: unknown) => JSON.stringify(o);

describe("detector — POSITIVE (credential grade)", () => {
    it("flags a bcrypt password hash", () => {
        const a = analyzeResponseExposure(
            200,
            j({ id: 1, name: "Ann", passwordHash: "$2b$12$abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUV123456" }),
        );
        expect(a.fields.map((f) => f.field)).toContain("passwordHash");
        expect(a.topGrade).toBe("credential");
    });

    it("flags a JWT token", () => {
        const a = analyzeResponseExposure(200, j({ id: 1, token: "aaaa.bbbb.cccc" }));
        expect(a.topGrade).toBe("credential");
    });

    it("flags an SSN and a full card number", () => {
        expect(analyzeResponseExposure(200, j({ ssn: "123-45-6789" })).topGrade).toBe("credential");
        expect(
            analyzeResponseExposure(200, j({ cardNumber: "4111111111111111" })).topGrade,
        ).toBe("credential");
    });

    it("finds fields nested inside arrays/objects", () => {
        const a = analyzeResponseExposure(200, j({ data: { users: [{ ssn: "123-45-6789" }] } }));
        expect(a.fields.map((f) => f.field)).toContain("ssn");
    });
});

describe("detector — internal flags", () => {
    it("flags isAdmin:true and internalNotes", () => {
        const a = analyzeResponseExposure(200, j({ id: 1, isAdmin: true, internalNotes: "VIP" }));
        expect(a.topGrade).toBe("internal");
        expect(a.fields.map((f) => f.field).sort()).toEqual(["internalNotes", "isAdmin"]);
    });
});

describe("detector — NEGATIVE (no false positives)", () => {
    it("ignores ordinary fields", () => {
        expect(
            analyzeResponseExposure(200, j({ id: 1, name: "Ann", createdAt: "2026-01-01" })).fields,
        ).toHaveLength(0);
    });

    it("ignores a key-only mention in an error string", () => {
        expect(analyzeResponseExposure(200, j({ error: "password required" })).fields).toHaveLength(0);
        expect(analyzeResponseExposure(200, j({ message: "invalid token" })).fields).toHaveLength(0);
    });

    it("ignores implausible / placeholder values", () => {
        expect(analyzeResponseExposure(200, j({ password: "" })).fields).toHaveLength(0);
        expect(analyzeResponseExposure(200, j({ token: "abc" })).fields).toHaveLength(0); // too short
        expect(analyzeResponseExposure(200, j({ ssn: "not-an-ssn" })).fields).toHaveLength(0);
        expect(analyzeResponseExposure(200, j({ password: "***REDACTED***" })).fields).toHaveLength(0);
    });

    it("does not match partial keys (passwordHint, tokenCount)", () => {
        expect(
            analyzeResponseExposure(200, j({ passwordHint: "your dog", tokenCount: 5 })).fields,
        ).toHaveLength(0);
    });

    it("ignores non-2xx and non-JSON bodies", () => {
        expect(analyzeResponseExposure(403, j({ ssn: "123-45-6789" })).fields).toHaveLength(0);
        expect(analyzeResponseExposure(200, "<html>ssn</html>").fields).toHaveLength(0);
        expect(analyzeResponseExposure(200, "").fields).toHaveLength(0);
    });
});

describe("detector — PII is conservative", () => {
    it("does NOT flag a single record's own email/phone", () => {
        const a = analyzeResponseExposure(200, j({ id: 1, email: "me@example.com", phone: "555-123-4567" }));
        expect(a.fields).toHaveLength(0);
    });

    it("DOES flag PII in bulk (a list of other people)", () => {
        const users = Array.from({ length: 4 }, (_, i) => ({ id: i, email: `u${i}@example.com` }));
        const a = analyzeResponseExposure(200, j({ users }));
        expect(a.fields.map((f) => f.field)).toContain("email");
        expect(a.topGrade).toBe("pii");
    });

    it("flags PII alongside a stronger signal even in one record", () => {
        const a = analyzeResponseExposure(200, j({ email: "me@example.com", isAdmin: true }));
        expect(a.fields.map((f) => f.field).sort()).toEqual(["email", "isAdmin"]);
    });
});

describe("complements SECRET_LEAK (no double-flag)", () => {
    it('a body matching SECRET_LEAK ("api_key":"…") yields NO exposure finding', () => {
        const body = j({ api_key: "sk_live_abcdef123456" });
        expect(hasSecretLeak(body)).toBe(true);
        expect(analyzeResponseExposure(200, body).fields).toHaveLength(0);
    });

    it("a password-hash body NOT matching SECRET_LEAK is still caught by exposure", () => {
        const body = j({ passwordHash: "$2b$12$abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUV123456" });
        expect(hasSecretLeak(body)).toBe(false); // "password" key, but not the "password":"..." pattern
        expect(analyzeResponseExposure(200, body).topGrade).toBe("credential");
    });
});

describe("verdict", () => {
    const input = { method: "GET", path: "/users", statusCode: 200, bodySnippet: j({ ssn: "123-45-6789" }) };

    it("credential-grade => CRITICAL, API3, redacted-shape evidence", async () => {
        const a = analyzeResponseExposure(200, input.bodySnippet);
        const f = await decideExposureVerdict(input, a);
        expect(f).not.toBeNull();
        expect(f!.severity).toBe("CRITICAL");
        expect(f!.category).toBe("Excessive Data Exposure");
        expect(f!.owaspCategory).toBe("API3_BROKEN_OBJECT_PROPERTY_LEVEL_AUTHORIZATION");
        expect(f!.confidence).toBe("firm");
        expect(f!.cause).toContain("ssn");
        expect(f!.evidence).toContain("exposed fields");
        expect(f!.remediation).toMatch(/DTO|only the properties/i);
    });

    it("internal grade => HIGH", async () => {
        const body = j({ isAdmin: true });
        const f = await decideExposureVerdict({ ...input, bodySnippet: body }, analyzeResponseExposure(200, body));
        expect(f!.severity).toBe("HIGH");
    });

    it("nothing found => null", async () => {
        const body = j({ name: "Ann" });
        expect(await decideExposureVerdict({ ...input, bodySnippet: body }, analyzeResponseExposure(200, body))).toBeNull();
    });

    it("judge VETOES a PII-only finding => null; unavailable => stands", async () => {
        const users = Array.from({ length: 4 }, (_, i) => ({ id: i, email: `u${i}@e.com` }));
        const body = j({ users });
        const a = analyzeResponseExposure(200, body);

        const no = vi.fn().mockResolvedValue({ isSensitive: false });
        expect(await decideExposureVerdict({ ...input, bodySnippet: body }, a, no)).toBeNull();

        const boom = vi.fn().mockRejectedValue(new Error("down"));
        expect(await decideExposureVerdict({ ...input, bodySnippet: body }, a, boom)).not.toBeNull();
    });

    it("judge never vetoes a CREDENTIAL-grade finding (only PII is borderline)", async () => {
        const no = vi.fn().mockResolvedValue({ isSensitive: false });
        const a = analyzeResponseExposure(200, input.bodySnippet);
        expect(await decideExposureVerdict(input, a, no)).not.toBeNull();
        expect(no).not.toHaveBeenCalled();
    });
});

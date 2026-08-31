// =============================================================================
// Tests for the scan-identities payload builder (T13c). Guards the two contracts
// that matter: a single identity stays BACKWARD COMPATIBLE (legacy authRecipeId,
// no identities array), and 2+ identities produce exactly the shape the server
// validates (unique labels, <=4, at most one isPrimary, anonymous omits
// authRecipeId entirely — never null).
// =============================================================================
import { describe, it, expect } from "vitest";
import {
    MAX_IDENTITIES,
    buildIdentityPayload,
    isBolaEnabled,
    validateIdentities,
    type IdentityRow,
} from "../lib/identities";

const row = (over: Partial<IdentityRow> = {}): IdentityRow => ({
    key: Math.random().toString(36).slice(2),
    label: "User A",
    authRecipeId: "",
    isPrimary: false,
    ...over,
});

const RECIPE_A = "11111111-1111-1111-1111-111111111111";
const RECIPE_B = "22222222-2222-2222-2222-222222222222";

describe("buildIdentityPayload — backward compatibility (1 identity)", () => {
    it("single credentialed identity → legacy authRecipeId, NO identities array", () => {
        const p = buildIdentityPayload([row({ authRecipeId: RECIPE_A, isPrimary: true })]);
        expect(p).toEqual({ authRecipeId: RECIPE_A });
        expect(p.identities).toBeUndefined();
    });

    it("single anonymous identity → empty payload (today's no-auth scan)", () => {
        const p = buildIdentityPayload([row({ isPrimary: true })]);
        expect(p).toEqual({});
        expect(p.identities).toBeUndefined();
    });
});

describe("buildIdentityPayload — multi-identity (2+)", () => {
    it("emits the identities array with exactly one primary", () => {
        const p = buildIdentityPayload([
            row({ label: "User A", authRecipeId: RECIPE_A, isPrimary: true }),
            row({ label: "User B", authRecipeId: RECIPE_B }),
        ]);
        expect(p.identities).toEqual([
            { label: "User A", authRecipeId: RECIPE_A, isPrimary: true },
            { label: "User B", authRecipeId: RECIPE_B },
        ]);
        expect(p.identities!.filter((i) => i.isPrimary)).toHaveLength(1);
    });

    it("an anonymous identity OMITS authRecipeId (never sends null)", () => {
        const p = buildIdentityPayload([
            row({ label: "User A", authRecipeId: RECIPE_A, isPrimary: true }),
            row({ label: "Anon" }),
        ]);
        expect(p.identities![1]).toEqual({ label: "Anon" });
        expect("authRecipeId" in p.identities![1]!).toBe(false);
    });

    it("trims labels and caps at MAX_IDENTITIES", () => {
        const rows = Array.from({ length: MAX_IDENTITIES + 2 }, (_, i) =>
            row({ label: `  User ${i}  `, isPrimary: i === 0 }),
        );
        const p = buildIdentityPayload(rows);
        expect(p.identities).toHaveLength(MAX_IDENTITIES);
        expect(p.identities![0]!.label).toBe("User 0");
    });

    it("defaults primary to the first row when none is flagged", () => {
        const p = buildIdentityPayload([
            row({ label: "One", authRecipeId: RECIPE_A }),
            row({ label: "Two" }),
        ]);
        expect(p.identities![0]!.isPrimary).toBe(true);
        expect(p.identities![1]!.isPrimary).toBeUndefined();
    });
});

describe("isBolaEnabled — the form hint", () => {
    it("false with a single identity", () => {
        expect(isBolaEnabled([row({ authRecipeId: RECIPE_A, isPrimary: true })])).toBe(false);
    });
    it("false when the primary is anonymous (A owns no objects)", () => {
        expect(
            isBolaEnabled([row({ isPrimary: true }), row({ authRecipeId: RECIPE_B })]),
        ).toBe(false);
    });
    it("true with a credentialed primary + a second identity", () => {
        expect(
            isBolaEnabled([
                row({ authRecipeId: RECIPE_A, isPrimary: true }),
                row({ label: "B", authRecipeId: RECIPE_B }),
            ]),
        ).toBe(true);
    });
    it("true even when the SECOND identity is anonymous (no-auth reads A's object)", () => {
        expect(
            isBolaEnabled([
                row({ authRecipeId: RECIPE_A, isPrimary: true }),
                row({ label: "Anon" }),
            ]),
        ).toBe(true);
    });
});

describe("validateIdentities — mirrors the server rules", () => {
    it("rejects duplicate labels", () => {
        expect(
            validateIdentities([row({ label: "Same" }), row({ label: "same" })]),
        ).toMatch(/unique/i);
    });
    it("rejects an empty label", () => {
        expect(validateIdentities([row({ label: "A" }), row({ label: "  " })])).toMatch(/label/i);
    });
    it("accepts a valid set", () => {
        expect(
            validateIdentities([row({ label: "A", isPrimary: true }), row({ label: "B" })]),
        ).toBeNull();
    });
});

// =============================================================================
// Tests for the T12 run-identity normalization (pure) + the create-run schema's
// identities validation (cap, unique labels, single primary). No DB.
// =============================================================================
import { describe, it, expect } from "vitest";
import {
    normalizeIdentities,
    primaryRecipeId,
    distinctRecipeIds,
} from "../run-identities.js";
import { createTestRunSchema, MAX_RUN_IDENTITIES } from "../../validators/schemas.js";

const RECIPE_A = "11111111-1111-1111-1111-111111111111";
const RECIPE_B = "22222222-2222-2222-2222-222222222222";

describe("normalizeIdentities — backward compat", () => {
    it("no authRecipeId, no identities → single anonymous primary", () => {
        const ids = normalizeIdentities({});
        expect(ids).toHaveLength(1);
        expect(ids[0]).toMatchObject({ label: "anonymous", authRecipeId: null, isPrimary: true });
        expect(primaryRecipeId(ids)).toBeNull();
        expect(distinctRecipeIds(ids)).toEqual([]);
    });

    it("legacy authRecipeId only → single primary mirroring that recipe", () => {
        const ids = normalizeIdentities({ authRecipeId: RECIPE_A });
        expect(ids).toHaveLength(1);
        expect(ids[0]).toMatchObject({ label: "primary", authRecipeId: RECIPE_A, isPrimary: true });
        expect(primaryRecipeId(ids)).toBe(RECIPE_A);
    });
});

describe("normalizeIdentities — multi-identity", () => {
    it("uses the flagged primary and puts it first", () => {
        const ids = normalizeIdentities({
            identities: [
                { label: "anon" },
                { label: "admin", authRecipeId: RECIPE_B, isPrimary: true },
                { label: "userA", authRecipeId: RECIPE_A },
            ],
        });
        expect(ids).toHaveLength(3);
        expect(ids[0]).toMatchObject({ label: "admin", isPrimary: true });
        expect(ids.filter((i) => i.isPrimary)).toHaveLength(1);
        expect(primaryRecipeId(ids)).toBe(RECIPE_B);
    });

    it("defaults primary to the first identity when none flagged", () => {
        const ids = normalizeIdentities({
            identities: [
                { label: "userA", authRecipeId: RECIPE_A },
                { label: "anon" },
            ],
        });
        expect(ids[0]).toMatchObject({ label: "userA", isPrimary: true });
        expect(primaryRecipeId(ids)).toBe(RECIPE_A);
    });

    it("distinctRecipeIds dedupes and drops anonymous (null) recipes", () => {
        const ids = normalizeIdentities({
            identities: [
                { label: "a", authRecipeId: RECIPE_A },
                { label: "b", authRecipeId: RECIPE_A }, // dup recipe, different identity
                { label: "anon" },
            ],
        });
        expect(distinctRecipeIds(ids)).toEqual([RECIPE_A]);
    });
});

describe("createTestRunSchema — identities validation", () => {
    const base = { specUrl: "https://api.example.com/openapi.json" };

    it("accepts a valid identities array", () => {
        const r = createTestRunSchema.safeParse({
            ...base,
            identities: [{ label: "userA", authRecipeId: RECIPE_A }, { label: "anon" }],
        });
        expect(r.success).toBe(true);
    });

    it("rejects more than MAX_RUN_IDENTITIES", () => {
        const many = Array.from({ length: MAX_RUN_IDENTITIES + 1 }, (_, i) => ({ label: `id${i}` }));
        const r = createTestRunSchema.safeParse({ ...base, identities: many });
        expect(r.success).toBe(false);
    });

    it("rejects duplicate labels", () => {
        const r = createTestRunSchema.safeParse({
            ...base,
            identities: [{ label: "dup" }, { label: "dup" }],
        });
        expect(r.success).toBe(false);
    });

    it("rejects more than one primary", () => {
        const r = createTestRunSchema.safeParse({
            ...base,
            identities: [
                { label: "a", isPrimary: true },
                { label: "b", isPrimary: true },
            ],
        });
        expect(r.success).toBe(false);
    });

    it("still accepts the legacy authRecipeId-only body (backward compat)", () => {
        const r = createTestRunSchema.safeParse({ ...base, authRecipeId: RECIPE_A });
        expect(r.success).toBe(true);
    });
});

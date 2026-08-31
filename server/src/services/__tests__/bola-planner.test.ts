// =============================================================================
// Tests for the BOLA planner (T13a): replay specs are produced ONLY with >=2
// identities, a credentialed primary A, secondaries as B, and resolved ids;
// bounded by MAX_REPLAY_JOBS; clean skip otherwise.
// =============================================================================
import { describe, it, expect } from "vitest";
import { planReplays, MAX_REPLAY_JOBS, type ResolvedPair } from "../bola-planner.js";
import type { EndpointPair } from "../object-id.js";

const detail = (path: string): EndpointPair => ({
    detail: { method: "GET", path, parameters: [{ name: "id", in: "path", schema: null }] },
    idParam: { name: "id", kind: "string" },
    collection: null,
});

const resolved = (path: string, endpointId: string, objectId: string): ResolvedPair => ({
    pair: detail(path),
    endpointId,
    objectId,
});

const A = { id: "A", authRecipeId: "recipe-a", isPrimary: true };
const B = { id: "B", authRecipeId: "recipe-b", isPrimary: false };
const anonB = { id: "C", authRecipeId: null, isPrimary: false };

describe("planReplays", () => {
    it("plans B-vs-A replays for each resolved pair", () => {
        const { specs, skipReason } = planReplays(
            [A, B],
            [resolved("/users/{id}", "ep1", "id-1")],
        );
        expect(skipReason).toBeNull();
        expect(specs).toHaveLength(1);
        expect(specs[0]).toMatchObject({
            endpointId: "ep1",
            objectId: "id-1",
            idParamName: "id",
            sourceIdentityId: "A",
            targetIdentityId: "B",
        });
    });

    it("allows an ANONYMOUS secondary as B (no-auth reads A's object)", () => {
        const { specs } = planReplays([A, anonB], [resolved("/users/{id}", "ep1", "id-1")]);
        expect(specs).toHaveLength(1);
        expect(specs[0]!.targetIdentityId).toBe("C");
    });

    it("fans out each secondary B against A", () => {
        const { specs } = planReplays([A, B, anonB], [resolved("/users/{id}", "ep1", "id-1")]);
        expect(specs.map((s) => s.targetIdentityId).sort()).toEqual(["B", "C"]);
    });

    it("skips: fewer than 2 identities", () => {
        expect(planReplays([A], [resolved("/u/{id}", "ep1", "i")]).specs).toHaveLength(0);
    });

    it("skips: anonymous primary (A owns no objects)", () => {
        const anonA = { id: "A", authRecipeId: null, isPrimary: true };
        const r = planReplays([anonA, B], [resolved("/u/{id}", "ep1", "i")]);
        expect(r.specs).toHaveLength(0);
        expect(r.skipReason).toMatch(/anonymous/);
    });

    it("skips: no resolved ids", () => {
        expect(planReplays([A, B], []).specs).toHaveLength(0);
    });

    it("caps total specs at MAX_REPLAY_JOBS", () => {
        const manyPairs = Array.from({ length: MAX_REPLAY_JOBS + 10 }, (_, i) =>
            resolved(`/r${i}/{id}`, `ep${i}`, `id${i}`),
        );
        const { specs } = planReplays([A, B], manyPairs);
        expect(specs.length).toBe(MAX_REPLAY_JOBS);
    });
});

// =============================================================================
// Tests for the BOLA orchestrator (T13a): with 2 identities + a resolvable detail
// endpoint, replay jobs are enqueued as B against A's id and totalReplays is set;
// with 1 identity or no ids, NONE are enqueued (graceful skip / backward compat).
// Fetcher + enqueue + setTotalReplays are injected.
// =============================================================================
import { describe, it, expect, vi } from "vitest";
import { orchestrateReplays, type OrchestratorEndpoint } from "../bola-orchestrator.js";

const A = { id: "A", authRecipeId: "recipe-a", isPrimary: true };
const B = { id: "B", authRecipeId: "recipe-b", isPrimary: false };

const endpoints: OrchestratorEndpoint[] = [
    { endpointId: "ep-coll", method: "GET", path: "/users", parameters: [] },
    {
        endpointId: "ep-detail",
        method: "GET",
        path: "/users/{id}",
        parameters: [{ name: "id", in: "path", required: false, schema: null }] as any,
    },
];

function harness(overrides: Partial<Parameters<typeof orchestrateReplays>[0]> = {}) {
    const enqueue = vi.fn().mockResolvedValue(1);
    const setTotalReplays = vi.fn().mockResolvedValue(undefined);
    const fetchCollectionAsPrimary = vi
        .fn()
        .mockResolvedValue({ json: [{ id: "obj-42" }], statusCode: 200 });
    const input = {
        testRunId: "run-1",
        baseUrl: "https://api.example.com",
        identities: [A, B],
        endpoints,
        fetchCollectionAsPrimary,
        enqueue,
        setTotalReplays,
        ...overrides,
    };
    return { input, enqueue, setTotalReplays, fetchCollectionAsPrimary };
}

describe("orchestrateReplays", () => {
    it("enqueues replays as B vs A's acquired id and sets totalReplays", async () => {
        const { input, enqueue, setTotalReplays, fetchCollectionAsPrimary } = harness();
        const count = await orchestrateReplays(input);

        expect(fetchCollectionAsPrimary).toHaveBeenCalledTimes(1); // acquired as A
        expect(setTotalReplays).toHaveBeenCalledWith("run-1", 1);
        expect(count).toBe(1);
        const specs = enqueue.mock.calls[0]![2];
        expect(specs).toHaveLength(1);
        expect(specs[0]).toMatchObject({
            endpointId: "ep-detail",
            objectId: "obj-42",
            sourceIdentityId: "A",
            targetIdentityId: "B",
        });
    });

    it("skips (enqueues nothing) with only ONE identity", async () => {
        const { input, enqueue, setTotalReplays } = harness({ identities: [A] });
        expect(await orchestrateReplays(input)).toBe(0);
        expect(enqueue).not.toHaveBeenCalled();
        expect(setTotalReplays).not.toHaveBeenCalled();
    });

    it("skips when no ids resolve (empty collection + no example)", async () => {
        const { input, enqueue } = harness({
            fetchCollectionAsPrimary: vi.fn().mockResolvedValue({ json: [], statusCode: 200 }),
        });
        expect(await orchestrateReplays(input)).toBe(0);
        expect(enqueue).not.toHaveBeenCalled();
    });

    it("skips when there are no detail endpoints", async () => {
        const { input, enqueue } = harness({
            endpoints: [{ endpointId: "c", method: "GET", path: "/users", parameters: [] }],
        });
        expect(await orchestrateReplays(input)).toBe(0);
        expect(enqueue).not.toHaveBeenCalled();
    });
});

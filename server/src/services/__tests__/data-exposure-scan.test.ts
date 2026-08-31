// =============================================================================
// Tests for the exposure scan pass (T14c) — AT MOST ONE finding per endpoint,
// baseline preferred with a 2xx-attack-response fallback, and never throwing.
// DB access is injected, so no live DB.
// =============================================================================
import { describe, it, expect, vi } from "vitest";
import { scanForDataExposure } from "../data-exposure-scan.js";

const LEAKY = JSON.stringify({ id: 1, ssn: "123-45-6789" });
const CLEAN = JSON.stringify({ id: 1, name: "Ann" });

const resp = (over: Partial<{ endpointId: string; method: string; path: string; statusCode: number; bodySnippet: string }> = {}) => ({
    endpointId: "ep-1",
    method: "GET",
    path: "/users/{id}",
    statusCode: 200,
    bodySnippet: LEAKY,
    ...over,
});

describe("scanForDataExposure", () => {
    it("records ONE finding per leaky endpoint", async () => {
        const saveFinding = vi.fn().mockResolvedValue(undefined);
        const n = await scanForDataExposure("run-1", {
            loadResponses: async () => [resp()],
            saveFinding,
        });
        expect(n).toBe(1);
        expect(saveFinding).toHaveBeenCalledTimes(1);
        const row = saveFinding.mock.calls[0]![0];
        expect(row.endpointId).toBe("ep-1");
        expect((row.finding as { owaspCategory: string }).owaspCategory).toBe(
            "API3_BROKEN_OBJECT_PROPERTY_LEVEL_AUTHORIZATION",
        );
    });

    it("DEDUPE: the loader yields one response per endpoint, so N endpoints => at most N findings", async () => {
        const saveFinding = vi.fn().mockResolvedValue(undefined);
        const n = await scanForDataExposure("run-1", {
            // Two DIFFERENT endpoints, each leaky — never two rows for one endpoint.
            loadResponses: async () => [
                resp({ endpointId: "ep-1" }),
                resp({ endpointId: "ep-2", path: "/accounts" }),
            ],
            saveFinding,
        });
        expect(n).toBe(2);
        const ids = saveFinding.mock.calls.map((c) => c[0].endpointId);
        expect(new Set(ids).size).toBe(2); // one per endpoint
    });

    it("records nothing for clean responses", async () => {
        const saveFinding = vi.fn();
        const n = await scanForDataExposure("run-1", {
            loadResponses: async () => [resp({ bodySnippet: CLEAN })],
            saveFinding,
        });
        expect(n).toBe(0);
        expect(saveFinding).not.toHaveBeenCalled();
    });

    it("records nothing when there are no responses at all (no baseline, no 2xx)", async () => {
        const n = await scanForDataExposure("run-1", {
            loadResponses: async () => [],
            saveFinding: vi.fn(),
        });
        expect(n).toBe(0);
    });

    it("never throws — a loader failure is swallowed and returns 0", async () => {
        const n = await scanForDataExposure("run-1", {
            loadResponses: async () => {
                throw new Error("db down");
            },
        });
        expect(n).toBe(0);
    });

    it("never throws — a save failure is swallowed", async () => {
        const n = await scanForDataExposure("run-1", {
            loadResponses: async () => [resp()],
            saveFinding: async () => {
                throw new Error("write failed");
            },
        });
        expect(n).toBe(0);
    });
});

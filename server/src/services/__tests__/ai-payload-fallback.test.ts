import { describe, it, expect, vi } from "vitest";

// No Gemini key in this test process → generation must report the fallback.
vi.stubEnv("GEMINI_API_KEY", "");

describe("generatePayloadsWithSource — reports when the built-in set was used", () => {
    it("flags usedFallback and returns the 36 built-in payloads without a key", async () => {
        const { generatePayloadsWithSource } = await import("../ai-payload.js");
        const out = await generatePayloadsWithSource({
            method: "GET",
            path: "/users/{id}",
            parameters: [],
            requestBodySchema: null,
        } as never);
        expect(out.usedFallback).toBe(true);
        expect(out.payloads).toHaveLength(36);
    });
});

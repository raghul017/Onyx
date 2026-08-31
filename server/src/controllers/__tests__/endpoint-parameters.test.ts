// =============================================================================
// T15b-fix — the endpoint-creation call must persist `parameters` alongside
// requestBodySchema, so a later re-scan can rebuild the exact original request.
// Asserted against the controller source (the create call is deep inside the
// async scan pipeline, which isn't callable in isolation without a live queue).
// =============================================================================
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const src = readFileSync(
    resolve(__dirname, "../test-run.controller.ts"),
    "utf8",
);

/** The targetEndpoint.create({ data: {...} }) block. */
function createBlock(): string {
    const i = src.indexOf("prisma.targetEndpoint.create(");
    expect(i).toBeGreaterThan(-1);
    return src.slice(i, i + 1200);
}

describe("TargetEndpoint creation persists parameters", () => {
    const block = createBlock();

    it("writes a `parameters` field from the parsed endpoint", () => {
        expect(block).toContain("parameters:");
        expect(block).toContain("ep.parameters");
    });

    it("still writes requestBodySchema (unchanged behavior)", () => {
        expect(block).toContain("requestBodySchema:");
        expect(block).toContain("ep.requestBodySchema");
    });

    it("omits the field for an endpoint with no parameters (stays null)", () => {
        // `undefined` lets Prisma leave the column NULL rather than storing [].
        expect(block).toMatch(/ep\.parameters[\s\S]{0,120}undefined/);
    });
});

describe("rescan consumes the persisted parameters", () => {
    const rescanSrc = readFileSync(
        resolve(__dirname, "../../services/rescan.service.ts"),
        "utf8",
    );

    it("selects parameters from the endpoint", () => {
        expect(rescanSrc).toContain("parameters: true");
    });

    it("no longer hardcodes an empty parameter list", () => {
        expect(rescanSrc).not.toContain("parameters: [],");
    });

    it("falls back to [] for legacy null/malformed values", () => {
        expect(rescanSrc).toContain("Array.isArray(row.endpoint.parameters)");
    });
});

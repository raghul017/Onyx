// =============================================================================
// Base-URL resolution tests.
//
// Regression lock for the bug that made a healthy API score 0/100: endpoint
// paths are relative to the spec's DECLARED SERVER, not to the spec URL's
// origin. Onyx's own spec declares `servers: [{ url: "/api" }]` while being
// served from `/api/openapi.json`, so resolving to the bare origin fired every
// attack at a route that doesn't exist (404) and turned the whole run to noise.
// =============================================================================

import { describe, it, expect } from "vitest";
import { resolveBaseUrl } from "../openapi-parser.js";

const SPEC = "https://onyx-server-a38v.onrender.com/api/openapi.json";

describe("resolveBaseUrl — OpenAPI 3 servers", () => {
    it("joins a RELATIVE server url onto the spec origin (the actual bug)", () => {
        expect(resolveBaseUrl({ servers: [{ url: "/api" }] }, SPEC)).toBe(
            "https://onyx-server-a38v.onrender.com/api",
        );
    });

    it("uses an ABSOLUTE server url as-is", () => {
        expect(
            resolveBaseUrl({ servers: [{ url: "https://api.example.com/v2" }] }, SPEC),
        ).toBe("https://api.example.com/v2");
    });

    it("strips a trailing slash so paths don't double up", () => {
        expect(resolveBaseUrl({ servers: [{ url: "/api/" }] }, SPEC)).toBe(
            "https://onyx-server-a38v.onrender.com/api",
        );
    });

    it("substitutes server variables with their defaults", () => {
        const api = {
            servers: [
                { url: "https://{host}/{basePath}", variables: { host: { default: "api.example.com" }, basePath: { default: "v1" } } },
            ],
        };
        expect(resolveBaseUrl(api, SPEC)).toBe("https://api.example.com/v1");
    });

    it("tolerates a relative url with no leading slash", () => {
        expect(resolveBaseUrl({ servers: [{ url: "api" }] }, SPEC)).toBe(
            "https://onyx-server-a38v.onrender.com/api",
        );
    });
});

describe("resolveBaseUrl — Swagger 2", () => {
    it("builds from host + basePath + schemes", () => {
        expect(
            resolveBaseUrl({ host: "api.example.com", basePath: "/v1", schemes: ["https"] }, SPEC),
        ).toBe("https://api.example.com/v1");
    });

    it("applies basePath against the spec origin when host is absent", () => {
        expect(resolveBaseUrl({ basePath: "/api" }, SPEC)).toBe(
            "https://onyx-server-a38v.onrender.com/api",
        );
    });
});

describe("resolveBaseUrl — fallbacks", () => {
    it("falls back to the spec origin when the spec declares nothing", () => {
        expect(resolveBaseUrl({}, SPEC)).toBe("https://onyx-server-a38v.onrender.com");
    });

    it("ignores an empty servers array", () => {
        expect(resolveBaseUrl({ servers: [] }, SPEC)).toBe(
            "https://onyx-server-a38v.onrender.com",
        );
    });

    it("returns empty string for an unparseable spec url", () => {
        expect(resolveBaseUrl({ servers: [{ url: "/api" }] }, "not a url")).toBe("");
    });
});

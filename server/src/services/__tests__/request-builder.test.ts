// =============================================================================
// Tests for buildAttackRequest — payload placement across path/query/header/body
// by attack type. Verifies the T4 contract: GET/DELETE and path/query/header
// params are actually injected, placeholders are always resolved (no literal
// braces), POST body injection is preserved, and MISSING_AUTH injects no payload
// into params. Pure/synchronous — no network, no DB.
// =============================================================================

import { describe, it, expect } from "vitest";
import { buildAttackRequest, buildBenignRequest } from "../request-builder.js";
import type { ParsedParameterInput } from "../../validators/schemas.js";

const BASE = "https://api.example.com";
const param = (
    name: string,
    where: ParsedParameterInput["in"],
    extra: Partial<ParsedParameterInput> = {},
): ParsedParameterInput => ({
    name,
    in: where,
    required: extra.required ?? false,
    schema: extra.schema ?? null,
});

describe("buildAttackRequest — GET with query params", () => {
    it("injects the payload into the querystring and sends no body", () => {
        const payload = "1' OR '1'='1";
        const req = buildAttackRequest({
            method: "GET",
            path: "/search",
            baseUrl: BASE,
            payload,
            attackType: "SQL_INJECTION",
            parameters: [param("q", "query"), param("page", "query")],
        });
        expect(req.method).toBe("GET");
        expect(req.body).toBeUndefined();
        // Both query params carry the (encoded) payload, in a single request.
        expect(req.url).toContain("q=");
        expect(req.url).toContain("page=");
        expect(decodeURIComponent(req.url)).toContain(payload);
        expect(req.url).not.toContain("{");
    });

    it("still carries the payload on a param-less GET (synthetic query)", () => {
        const payload = "<script>alert(1)</script>";
        const req = buildAttackRequest({
            method: "GET",
            path: "/health",
            baseUrl: BASE,
            payload,
            attackType: "XSS",
            parameters: [],
        });
        expect(req.body).toBeUndefined();
        expect(req.url).toContain("data=");
        expect(decodeURIComponent(req.url)).toContain(payload);
    });
});

describe("buildAttackRequest — DELETE with a path param", () => {
    it("resolves the placeholder with the payload in the path segment", () => {
        const payload = "../../etc/passwd";
        const req = buildAttackRequest({
            method: "DELETE",
            path: "/files/{fileId}",
            baseUrl: BASE,
            payload,
            attackType: "PATH_TRAVERSAL",
            parameters: [param("fileId", "path", { required: true })],
        });
        expect(req.method).toBe("DELETE");
        expect(req.url).not.toContain("{");
        expect(req.url).not.toContain("}");
        // Payload lands in the path (encoded), not a bare/literal placeholder.
        expect(req.url.startsWith(`${BASE}/files/`)).toBe(true);
        expect(decodeURIComponent(req.url)).toContain(payload);
        expect(req.body).toBeUndefined();
    });
});

describe("buildAttackRequest — path {id} + separate query param", () => {
    it("resolves {id} and injects both without literal braces", () => {
        const payload = "abc123XSS";
        const req = buildAttackRequest({
            method: "GET",
            path: "/users/{id}/posts",
            baseUrl: BASE,
            payload,
            attackType: "XSS",
            parameters: [
                param("id", "path", { required: true }),
                param("filter", "query"),
            ],
        });
        expect(req.url).not.toContain("{");
        expect(req.url).not.toContain("}");
        expect(req.url).toContain("/users/");
        expect(req.url).toContain("/posts");
        expect(req.url).toContain("filter=");
        // Both the path segment and the query carry the payload.
        const decoded = decodeURIComponent(req.url);
        expect(decoded).toContain(`/users/${payload}/posts`);
        expect(decoded).toContain(`filter=${payload}`);
    });

    it("resolves an un-injected placeholder to a benign dummy (non-injection attack)", () => {
        const req = buildAttackRequest({
            method: "GET",
            path: "/users/{id}",
            baseUrl: BASE,
            payload: "[No Authorization Header]",
            attackType: "MISSING_AUTH",
            parameters: [param("id", "path", { required: true })],
        });
        expect(req.url).toBe(`${BASE}/users/1`); // dummy, no braces, no payload
        expect(req.url).not.toContain("Authorization");
    });
});

describe("buildAttackRequest — POST with request body (preserved behavior)", () => {
    it("puts a JSON-like payload into the body verbatim", () => {
        const payload = '{"name":"<script>","id":1}';
        const req = buildAttackRequest({
            method: "POST",
            path: "/users",
            baseUrl: BASE,
            payload,
            attackType: "XSS",
            parameters: [],
            requestBodySchema: { type: "object" },
        });
        expect(req.method).toBe("POST");
        expect(req.headers["Content-Type"]).toBe("application/json");
        expect(req.body).toBe(payload); // JSON-like passed through unchanged
        expect(req.url).toBe(`${BASE}/users`);
    });

    it("wraps a non-JSON payload as { data: payload } (today's behavior)", () => {
        const payload = "plain string payload";
        const req = buildAttackRequest({
            method: "PUT",
            path: "/items/{id}",
            baseUrl: BASE,
            payload,
            attackType: "SQL_INJECTION",
            parameters: [param("id", "path")],
        });
        expect(req.body).toBe(JSON.stringify({ data: payload }));
        // Path placeholder is still injected on a body method.
        expect(decodeURIComponent(req.url)).toContain(`/items/${payload}`);
    });
});

describe("buildAttackRequest — header param injection", () => {
    it("sets the declared header to the payload for an injection attack", () => {
        const payload = "'; DROP TABLE users;--";
        const req = buildAttackRequest({
            method: "GET",
            path: "/report",
            baseUrl: BASE,
            payload,
            attackType: "SQL_INJECTION",
            parameters: [param("X-Tenant-Id", "header")],
        });
        expect(req.headers["X-Tenant-Id"]).toBe(payload);
        expect(req.headers["User-Agent"]).toBe("Onyx/1.0 (Security Testing)");
    });

    it("never clobbers structural headers (e.g. Content-Type)", () => {
        const req = buildAttackRequest({
            method: "POST",
            path: "/x",
            baseUrl: BASE,
            payload: "evil",
            attackType: "XSS",
            parameters: [param("Content-Type", "header")],
        });
        expect(req.headers["Content-Type"]).toBe("application/json");
    });
});

describe("buildAttackRequest — MISSING_AUTH injects no payload into params", () => {
    it("does not inject the payload into query/header params", () => {
        const payload = "Bearer eyJhbGciOiJub25lIn0.e30.";
        const req = buildAttackRequest({
            method: "GET",
            path: "/admin",
            baseUrl: BASE,
            payload,
            attackType: "MISSING_AUTH",
            parameters: [param("scope", "query"), param("X-Auth", "header")],
        });
        // No payload anywhere in url or headers.
        expect(decodeURIComponent(req.url)).not.toContain(payload);
        expect(req.headers["X-Auth"]).toBeUndefined();
        expect(req.body).toBeUndefined();
    });

    it("keeps today's body behavior on POST (payload sent as body)", () => {
        const payload = '{"role":"admin"}';
        const req = buildAttackRequest({
            method: "POST",
            path: "/login",
            baseUrl: BASE,
            payload,
            attackType: "MISSING_AUTH",
            parameters: [],
            requestBodySchema: { type: "object" },
        });
        expect(req.body).toBe(payload);
    });
});

describe("buildAttackRequest — OVERSIZED/RATE_LIMIT routing", () => {
    it("prefers the body when the method has one", () => {
        const payload = "x".repeat(1000);
        const req = buildAttackRequest({
            method: "POST",
            path: "/upload",
            baseUrl: BASE,
            payload,
            attackType: "OVERSIZED_PAYLOAD",
            parameters: [param("tag", "query")],
        });
        expect(req.body).toBe(JSON.stringify({ data: payload }));
        // Not injected into the query param when a body exists.
        expect(req.url).toBe(`${BASE}/upload`);
    });

    it("falls back to a query param when there is no body (GET)", () => {
        const payload = "y".repeat(500);
        const req = buildAttackRequest({
            method: "GET",
            path: "/ping",
            baseUrl: BASE,
            payload,
            attackType: "RATE_LIMIT",
            parameters: [],
        });
        expect(req.body).toBeUndefined();
        expect(req.url).toContain("data=");
        expect(decodeURIComponent(req.url)).toContain(payload);
    });
});

// =============================================================================
// buildBenignRequest (T5 baseline) — schema-valid dummies, NEVER an attack payload
// =============================================================================

describe("buildBenignRequest — clean control request", () => {
    it("fills path + required query with dummies and a schema-shaped body; no payload", () => {
        const req = buildBenignRequest({
            method: "POST",
            path: "/users/{id}/orders",
            baseUrl: BASE,
            parameters: [
                param("id", "path", { required: true, schema: { type: "integer" } }),
                param("limit", "query", { required: true, schema: { type: "integer" } }),
                param("verbose", "query", { required: false }), // optional → omitted
            ],
            requestBodySchema: {
                type: "object",
                properties: {
                    name: { type: "string" },
                    count: { type: "integer" },
                    active: { type: "boolean" },
                },
            },
        });
        // Path placeholder resolved to a dummy, no literal braces.
        expect(req.url).not.toContain("{");
        expect(req.url).not.toContain("}");
        expect(req.url).toContain("/users/1/orders");
        // Required query present with a dummy; optional one omitted.
        expect(req.url).toContain("limit=1");
        expect(req.url).not.toContain("verbose=");
        // Body is a schema-shaped dummy object — valid JSON, benign values.
        expect(req.headers["Content-Type"]).toBe("application/json");
        const body = JSON.parse(req.body!);
        expect(body).toEqual({ name: "test", count: 1, active: true });
        expect(req.headers["User-Agent"]).toBe("Onyx/1.0 (Security Testing)");
    });

    it("GET with only a path param resolves the placeholder, sends no body", () => {
        const req = buildBenignRequest({
            method: "GET",
            path: "/files/{fileId}",
            baseUrl: BASE,
            parameters: [param("fileId", "path", { required: true })],
        });
        expect(req.method).toBe("GET");
        expect(req.body).toBeUndefined();
        expect(req.url).toBe(`${BASE}/files/1`);
    });

    it("does NOT contain any injection-looking payload for a param-less GET", () => {
        const req = buildBenignRequest({
            method: "GET",
            path: "/health",
            baseUrl: BASE,
            parameters: [],
        });
        // Unlike the attack builder, no synthetic `data=` payload is appended.
        expect(req.url).toBe(`${BASE}/health`);
        expect(req.body).toBeUndefined();
    });

    it("uses an empty JSON object body when a body method has no schema", () => {
        const req = buildBenignRequest({
            method: "PUT",
            path: "/config",
            baseUrl: BASE,
            parameters: [],
            requestBodySchema: null,
        });
        expect(req.body).toBe("{}");
    });
});

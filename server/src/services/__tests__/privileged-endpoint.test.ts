// =============================================================================
// Tests for the privileged-endpoint heuristic (T14a). Conservative by design:
// a wrong "privileged" label would produce a bogus BFLA finding, so ordinary
// reads must never be flagged.
// =============================================================================
import { describe, it, expect } from "vitest";
import {
    classifyPrivilegedEndpoint,
    isPrivilegedEndpoint,
} from "../privileged-endpoint.js";

describe("privileged endpoints — POSITIVE", () => {
    it("flags admin path segments on any method", () => {
        for (const path of [
            "/admin/users",
            "/v1/admin",
            "/internal/metrics",
            "/api/manage/tenants",
            "/settings",
            "/system/backup",
            "/users/{id}/roles",
            "/audit-logs",
        ]) {
            expect(isPrivilegedEndpoint({ method: "GET", path })).toBe(true);
        }
    });

    it("flags DELETE on an admin path", () => {
        const v = classifyPrivilegedEndpoint({ method: "DELETE", path: "/admin/users/{id}" });
        expect(v.privileged).toBe(true);
        expect(v.reason).toContain("admin");
    });

    it("flags WRITES on account-administration collections", () => {
        for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
            expect(isPrivilegedEndpoint({ method, path: "/users/{id}" })).toBe(true);
            expect(isPrivilegedEndpoint({ method, path: "/v1/accounts" })).toBe(true);
        }
    });

    it("flags an administrative operationId", () => {
        const v = classifyPrivilegedEndpoint({
            method: "POST",
            path: "/tickets/{id}/escalate",
            operationId: "impersonateUser",
        });
        expect(v.privileged).toBe(true);
        expect(v.reason).toContain("operationId");
    });
});

describe("privileged endpoints — NEGATIVE (must not flag)", () => {
    it("does NOT flag ordinary reads", () => {
        for (const path of ["/products", "/orders/{id}", "/health", "/search", "/v1/posts"]) {
            expect(isPrivilegedEndpoint({ method: "GET", path })).toBe(false);
        }
    });

    it("does NOT flag a plain GET on /users (reads are common)", () => {
        expect(isPrivilegedEndpoint({ method: "GET", path: "/users" })).toBe(false);
        expect(isPrivilegedEndpoint({ method: "GET", path: "/users/{id}" })).toBe(false);
    });

    it("matches whole segments only — no substring false positives", () => {
        for (const path of ["/badminton", "/configurator", "/systemic", "/rootkits"]) {
            expect(isPrivilegedEndpoint({ method: "GET", path })).toBe(false);
        }
    });

    it("does NOT flag a non-admin write on an ordinary resource", () => {
        expect(isPrivilegedEndpoint({ method: "POST", path: "/orders" })).toBe(false);
        expect(isPrivilegedEndpoint({ method: "DELETE", path: "/cart/items/{id}" })).toBe(false);
    });

    it("ignores {placeholders} when segmenting", () => {
        expect(isPrivilegedEndpoint({ method: "GET", path: "/{tenant}/products" })).toBe(false);
    });
});

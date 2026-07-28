// =============================================================================
// Tests for the auth-recipe form helpers (T7b) — the "leave blank keeps secret"
// rule and per-type meta assembly. Pure logic, no DOM.
// =============================================================================

import { describe, it, expect } from "vitest";
import {
    buildRecipeUpdatePayload,
    buildRecipeMeta,
} from "@/components/AuthRecipesPanel";

const fields = { headerName: "", queryName: "", location: "header" as const, cookieName: "" };

describe("buildRecipeUpdatePayload — leave blank keeps the current secret", () => {
    it("omits `secret` when the field is left blank", () => {
        const payload = buildRecipeUpdatePayload({ name: "prod", meta: {}, secret: "" });
        expect(payload).toEqual({ name: "prod", meta: {} });
        expect("secret" in payload).toBe(false);
    });

    it("omits `secret` when the field is only whitespace", () => {
        const payload = buildRecipeUpdatePayload({ name: "prod", meta: {}, secret: "   " });
        expect("secret" in payload).toBe(false);
    });

    it("includes `secret` (verbatim) when the user typed a new one", () => {
        const payload = buildRecipeUpdatePayload({ name: "prod", meta: {}, secret: "new-token-123" });
        expect(payload.secret).toBe("new-token-123");
    });

    it("trims the name but never the secret", () => {
        const payload = buildRecipeUpdatePayload({ name: "  prod  ", meta: {}, secret: " keep spaces " });
        expect(payload.name).toBe("prod");
        expect(payload.secret).toBe(" keep spaces ");
    });
});

describe("buildRecipeMeta — per-type descriptors", () => {
    it("bearer carries no meta", () => {
        expect(buildRecipeMeta("bearer", fields)).toEqual({});
    });
    it("header carries the header name", () => {
        expect(buildRecipeMeta("header", { ...fields, headerName: "X-Api-Key" })).toEqual({
            headerName: "X-Api-Key",
        });
    });
    it("cookie carries the cookie name", () => {
        expect(buildRecipeMeta("cookie", { ...fields, cookieName: "session" })).toEqual({
            cookieName: "session",
        });
    });
    it("apiKey (header) carries location + header name", () => {
        expect(
            buildRecipeMeta("apiKey", { ...fields, location: "header", headerName: "X-Key" }),
        ).toEqual({ location: "header", headerName: "X-Key" });
    });
    it("apiKey (query) carries location + query name", () => {
        expect(
            buildRecipeMeta("apiKey", { ...fields, location: "query", queryName: "api_key" }),
        ).toEqual({ location: "query", queryName: "api_key" });
    });
});

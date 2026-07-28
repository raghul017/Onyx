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

// =============================================================================
// T8b — dynamic types (loginRequest + oauth2ClientCredentials): object secrets,
// meta assembly, edit-keep-blank, and JSON/placeholder helpers.
// =============================================================================

import {
    buildRecipeSecret,
    isSecretBlank,
    isValidJson,
    extractPlaceholders,
    validateMetaForType,
    EMPTY_FIELDS,
    type RecipeFormFields,
} from "@/components/AuthRecipesPanel";

const f = (over: Partial<RecipeFormFields>): RecipeFormFields => ({ ...EMPTY_FIELDS, ...over });

describe("buildRecipeSecret — object secret for dynamic, string for static", () => {
    it("oauth2 → { clientSecret }", () => {
        expect(buildRecipeSecret("oauth2ClientCredentials", f({ clientSecret: "csec" }))).toEqual({
            clientSecret: "csec",
        });
    });

    it("loginRequest → placeholder map derived from the body template", () => {
        const fields = f({
            bodyTemplate: '{"u":"{{user}}","p":"{{password}}"}',
            secretValues: { user: "alice", password: "pw123" },
        });
        expect(buildRecipeSecret("loginRequest", fields)).toEqual({ user: "alice", password: "pw123" });
    });

    it("loginRequest — only template placeholders are included (stray values ignored)", () => {
        const fields = f({
            bodyTemplate: '{"p":"{{password}}"}',
            secretValues: { password: "pw", leftover: "x" },
        });
        expect(buildRecipeSecret("loginRequest", fields)).toEqual({ password: "pw" });
    });

    it("static types → the string secret verbatim", () => {
        expect(buildRecipeSecret("bearer", f({ secret: "tok" }))).toBe("tok");
        expect(buildRecipeSecret("header", f({ secret: "hv" }))).toBe("hv");
    });
});

describe("buildRecipeMeta — dynamic meta matches server field names", () => {
    it("oauth2 carries tokenUrl/clientId/injectAs (+ optional scope/tokenResponseField)", () => {
        const meta = buildRecipeMeta(
            "oauth2ClientCredentials",
            f({ tokenUrl: "https://idp/token", clientId: "cid", scope: "read", tokenResponseField: "jwt" }),
        );
        expect(meta).toEqual({
            tokenUrl: "https://idp/token",
            clientId: "cid",
            injectAs: "bearer",
            scope: "read",
            tokenResponseField: "jwt",
        });
    });

    it("oauth2 omits empty optionals", () => {
        const meta = buildRecipeMeta("oauth2ClientCredentials", f({ tokenUrl: "https://idp/token", clientId: "cid" }));
        expect(meta).toEqual({ tokenUrl: "https://idp/token", clientId: "cid", injectAs: "bearer" });
    });

    it("loginRequest carries method/url/bodyTemplate/tokenPath/injectAs + headers", () => {
        const meta = buildRecipeMeta(
            "loginRequest",
            f({
                method: "POST",
                url: "https://api/login",
                bodyTemplate: '{"p":"{{pw}}"}',
                tokenPath: "data.token",
                injectMode: "header",
                injectHeaderName: "X-Auth",
                headerPairs: [{ key: "X-Tenant", value: "acme" }],
            }),
        );
        expect(meta).toEqual({
            method: "POST",
            url: "https://api/login",
            bodyTemplate: '{"p":"{{pw}}"}',
            tokenPath: "data.token",
            injectAs: "header:X-Auth",
            headers: { "X-Tenant": "acme" },
        });
    });
});

describe("isSecretBlank / edit keeps secret when blank (object-aware)", () => {
    it("blank string is blank", () => {
        expect(isSecretBlank("")).toBe(true);
        expect(isSecretBlank("   ")).toBe(true);
    });
    it("object with all-empty values is blank", () => {
        expect(isSecretBlank({ clientSecret: "" })).toBe(true);
        expect(isSecretBlank({ user: "", pass: "  " })).toBe(true);
        expect(isSecretBlank({})).toBe(true);
    });
    it("object with any value is NOT blank", () => {
        expect(isSecretBlank({ clientSecret: "x" })).toBe(false);
    });

    it("buildRecipeUpdatePayload omits an all-blank object secret (keep current)", () => {
        const payload = buildRecipeUpdatePayload({
            name: "oauth",
            meta: { tokenUrl: "https://idp/token", clientId: "cid" },
            secret: { clientSecret: "" },
        });
        expect("secret" in payload).toBe(false);
        expect(payload.meta).toEqual({ tokenUrl: "https://idp/token", clientId: "cid" });
    });

    it("buildRecipeUpdatePayload includes a filled object secret (rotate)", () => {
        const payload = buildRecipeUpdatePayload({
            name: "oauth",
            meta: {},
            secret: { clientSecret: "new" },
        });
        expect(payload.secret).toEqual({ clientSecret: "new" });
    });
});

describe("JSON + placeholder helpers", () => {
    it("isValidJson", () => {
        expect(isValidJson('{"a":1}')).toBe(true);
        expect(isValidJson("{bad}")).toBe(false);
    });
    it("extractPlaceholders finds unique {{names}}", () => {
        expect(extractPlaceholders('{"a":"{{x}}","b":"{{y}}","c":"{{x}}"}')).toEqual(["x", "y"]);
        expect(extractPlaceholders("{}")).toEqual([]);
    });
    it("validateMetaForType flags invalid loginRequest JSON / missing placeholder", () => {
        expect(validateMetaForType("loginRequest", f({ url: "https://a", bodyTemplate: "{bad}", tokenPath: "t" }))).toMatch(/valid JSON/);
        expect(validateMetaForType("loginRequest", f({ url: "https://a", bodyTemplate: "{}", tokenPath: "t" }))).toMatch(/placeholder/);
        expect(validateMetaForType("loginRequest", f({ url: "https://a", bodyTemplate: '{"p":"{{pw}}"}', tokenPath: "data.token" }))).toBeNull();
    });
    it("validateMetaForType flags missing oauth2 fields", () => {
        expect(validateMetaForType("oauth2ClientCredentials", f({ clientId: "cid" }))).toMatch(/Token URL/);
        expect(validateMetaForType("oauth2ClientCredentials", f({ tokenUrl: "https://idp" }))).toMatch(/Client ID/);
        expect(validateMetaForType("oauth2ClientCredentials", f({ tokenUrl: "https://idp", clientId: "cid" }))).toBeNull();
    });
});

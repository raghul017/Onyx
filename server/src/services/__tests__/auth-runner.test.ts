// =============================================================================
// Tests for the auth-runner (T8a) — dynamic token resolution. HTTP + SSRF are
// mocked; no real network. Verifies oauth2 + loginRequest, dot-path/regex token
// extraction, placeholder substitution, injectAs, and the SSRF block.
// =============================================================================

import { describe, it, expect, vi, beforeEach } from "vitest";

// SSRF guard is mocked so we can assert it's called and force a block.
const { assertNotSSRF } = vi.hoisted(() => ({ assertNotSSRF: vi.fn() }));
vi.mock("../../lib/ssrf-guard.js", () => ({ assertNotSSRF }));

import {
    resolveDynamicCredential,
    AuthRunnerError,
    substitutePlaceholders,
    extractToken,
} from "../auth-runner.js";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

function mockJson(body: unknown, ok = true, status = 200) {
    return {
        ok,
        status,
        json: async () => body,
        text: async () => JSON.stringify(body),
    } as unknown as Response;
}
function mockText(text: string, ok = true, status = 200) {
    return { ok, status, json: async () => JSON.parse(text), text: async () => text } as unknown as Response;
}

beforeEach(() => {
    fetchMock.mockReset();
    assertNotSSRF.mockReset();
    assertNotSSRF.mockResolvedValue(undefined); // allow by default
});

describe("auth-runner — oauth2ClientCredentials", () => {
    it("POSTs the token URL and returns a bearer credential", async () => {
        fetchMock.mockResolvedValue(mockJson({ access_token: "tok_abc", token_type: "Bearer" }));
        const cred = await resolveDynamicCredential({
            type: "oauth2ClientCredentials",
            meta: { tokenUrl: "https://idp.example.com/token", clientId: "cid" },
            secret: { clientSecret: "csecret" },
        });
        expect(cred).toEqual({ type: "bearer", secret: "tok_abc" });
        // SSRF-guarded + urlencoded grant.
        expect(assertNotSSRF).toHaveBeenCalledWith("https://idp.example.com/token");
        const [, init] = fetchMock.mock.calls[0]!;
        expect(init.method).toBe("POST");
        expect(init.headers["Content-Type"]).toBe("application/x-www-form-urlencoded");
        expect(init.body).toContain("grant_type=client_credentials");
        expect(init.body).toContain("client_id=cid");
    });

    it("honors a custom tokenResponseField", async () => {
        fetchMock.mockResolvedValue(mockJson({ jwt: "tok_custom" }));
        const cred = await resolveDynamicCredential({
            type: "oauth2ClientCredentials",
            meta: { tokenUrl: "https://idp.example.com/token", clientId: "cid", tokenResponseField: "jwt" },
            secret: { clientSecret: "csecret" },
        });
        expect(cred.secret).toBe("tok_custom");
    });

    it("throws on a non-2xx token endpoint", async () => {
        fetchMock.mockResolvedValue(mockJson({ error: "invalid_client" }, false, 401));
        await expect(
            resolveDynamicCredential({
                type: "oauth2ClientCredentials",
                meta: { tokenUrl: "https://idp.example.com/token", clientId: "cid" },
                secret: { clientSecret: "csecret" },
            }),
        ).rejects.toBeInstanceOf(AuthRunnerError);
    });

    it("throws when the token field is missing", async () => {
        fetchMock.mockResolvedValue(mockJson({ not_a_token: "x" }));
        await expect(
            resolveDynamicCredential({
                type: "oauth2ClientCredentials",
                meta: { tokenUrl: "https://idp.example.com/token", clientId: "cid" },
                secret: { clientSecret: "csecret" },
            }),
        ).rejects.toThrow(/token field/);
    });
});

describe("auth-runner — loginRequest", () => {
    it("substitutes placeholders and extracts via dot-path", async () => {
        fetchMock.mockResolvedValue(mockJson({ data: { token: "login_tok" } }));
        const cred = await resolveDynamicCredential({
            type: "loginRequest",
            meta: {
                method: "POST",
                url: "https://api.example.com/login",
                bodyTemplate: '{"username":"{{user}}","password":"{{pass}}"}',
                tokenPath: "data.token",
                injectAs: "bearer",
            },
            secret: { user: "alice", pass: 'p"wd' },
        });
        expect(cred).toEqual({ type: "bearer", secret: "login_tok" });
        const [, init] = fetchMock.mock.calls[0]!;
        // Placeholders substituted; the quote in the password is JSON-escaped.
        expect(init.body).toContain('"username":"alice"');
        expect(init.body).toContain('\\"wd'); // escaped quote survived
        expect(JSON.parse(init.body)).toEqual({ username: "alice", password: 'p"wd' });
    });

    it("extracts a token via a regex tokenPath", async () => {
        fetchMock.mockResolvedValue(mockText('SET-COOKIE token="regtok999"; path=/'));
        const cred = await resolveDynamicCredential({
            type: "loginRequest",
            meta: {
                method: "POST",
                url: "https://api.example.com/login",
                bodyTemplate: "{}",
                tokenPath: '/token="([^"]+)"/',
                injectAs: "header:X-Auth-Token",
            },
            secret: { any: "v" },
        });
        expect(cred).toEqual({ type: "header", secret: "regtok999", headerName: "X-Auth-Token" });
    });

    it("throws when no token can be extracted", async () => {
        fetchMock.mockResolvedValue(mockJson({ nope: true }));
        await expect(
            resolveDynamicCredential({
                type: "loginRequest",
                meta: { method: "POST", url: "https://api.example.com/login", bodyTemplate: "{}", tokenPath: "data.token", injectAs: "bearer" },
                secret: { x: "y" },
            }),
        ).rejects.toThrow(/could not extract/);
    });
});

describe("auth-runner — SSRF guard", () => {
    it("blocks a private/internal login URL and makes NO request", async () => {
        assertNotSSRF.mockRejectedValue(new Error("SSRF blocked: private IP"));
        await expect(
            resolveDynamicCredential({
                type: "loginRequest",
                meta: { method: "POST", url: "http://169.254.169.254/latest", bodyTemplate: "{}", tokenPath: "t", injectAs: "bearer" },
                secret: { x: "y" },
            }),
        ).rejects.toBeInstanceOf(AuthRunnerError);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("blocks an oauth2 token URL that resolves internal", async () => {
        assertNotSSRF.mockRejectedValue(new Error("SSRF blocked"));
        await expect(
            resolveDynamicCredential({
                type: "oauth2ClientCredentials",
                meta: { tokenUrl: "http://127.0.0.1/token", clientId: "c" },
                secret: { clientSecret: "s" },
            }),
        ).rejects.toBeInstanceOf(AuthRunnerError);
        expect(fetchMock).not.toHaveBeenCalled();
    });
});

describe("auth-runner — pure helpers", () => {
    it("substitutePlaceholders JSON-escapes values", () => {
        const out = substitutePlaceholders('{"p":"{{pass}}"}', { pass: 'a"b\\c' });
        expect(JSON.parse(out).p).toBe('a"b\\c');
    });
    it("substitutePlaceholders leaves unknown placeholders empty", () => {
        expect(substitutePlaceholders('{"x":"{{missing}}"}', {})).toBe('{"x":""}');
    });
    it("extractToken dot-path", () => {
        expect(extractToken('{"a":{"b":"T"}}', "a.b")).toBe("T");
        expect(extractToken('{"a":{}}', "a.b")).toBeNull();
    });
    it("extractToken regex (capture group)", () => {
        expect(extractToken("prefix TOKEN=abc123 suffix", "/TOKEN=(\\w+)/")).toBe("abc123");
    });
    it("extractToken regex (full match when no group)", () => {
        expect(extractToken("xx-42-yy", "/\\d+/")).toBe("42");
    });
});

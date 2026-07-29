// =============================================================================
// Tests for the API-token service (T10a) — mint / hash / mask helpers.
// =============================================================================

import { describe, it, expect } from "vitest";
import {
    generateApiToken,
    hashApiToken,
    isApiToken,
    maskApiToken,
    API_TOKEN_PREFIX,
} from "../api-token.service.js";

describe("generateApiToken", () => {
    it("mints a prefixed, high-entropy base62 token with a matching hash + last4", () => {
        const { token, tokenHash, last4 } = generateApiToken();
        expect(token.startsWith(API_TOKEN_PREFIX)).toBe(true);
        const secret = token.slice(API_TOKEN_PREFIX.length);
        expect(secret).toMatch(/^[0-9A-Za-z]{43}$/); // base62, ~256 bits
        expect(tokenHash).toBe(hashApiToken(token)); // stored hash == hash(plaintext)
        expect(tokenHash).toMatch(/^[0-9a-f]{64}$/); // sha256 hex
        expect(last4).toBe(secret.slice(-4));
        // The stored hash never contains the plaintext.
        expect(tokenHash).not.toContain(secret);
    });

    it("produces a unique token each call", () => {
        const a = generateApiToken();
        const b = generateApiToken();
        expect(a.token).not.toBe(b.token);
        expect(a.tokenHash).not.toBe(b.tokenHash);
    });
});

describe("hashApiToken", () => {
    it("is deterministic (same token → same hash) for indexed lookup", () => {
        expect(hashApiToken("onyx_abc")).toBe(hashApiToken("onyx_abc"));
    });
    it("differs for a different token (wrong token won't match)", () => {
        expect(hashApiToken("onyx_abc")).not.toBe(hashApiToken("onyx_abd"));
    });
});

describe("isApiToken / maskApiToken", () => {
    it("recognizes onyx_ tokens and not JWTs", () => {
        expect(isApiToken("onyx_xyz")).toBe(true);
        expect(isApiToken("eyJhbGciOi.abc.def")).toBe(false);
    });
    it("masks to a safe display form without the secret", () => {
        expect(maskApiToken("wxyz")).toBe("onyx_••••wxyz");
    });
});

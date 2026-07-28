// =============================================================================
// Tests for the auth-recipe service — encryption on store, MASKED public view
// (no plaintext or ciphertext leak), and in-memory decrypt for attachment.
// =============================================================================

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import crypto from "node:crypto";
import {
    buildRecipeStorage,
    maskRecipe,
    toAttachedCredential,
    isDynamicType,
    type AuthRecipeRow,
} from "../auth-recipe.service.js";

const KEY = crypto.randomBytes(32).toString("base64");

beforeEach(() => {
    process.env.CREDENTIAL_ENC_KEY = KEY;
});
afterEach(() => {
    delete process.env.CREDENTIAL_ENC_KEY;
});

describe("buildRecipeStorage — encrypts + records last4", () => {
    it("stores ciphertext (not plaintext) and a last4 hint", () => {
        const secret = "sk_live_SUPERSECRET1234";
        const { secretEnc, meta } = buildRecipeStorage(
            { headerName: "X-Api-Key" },
            secret,
        );
        expect(secretEnc).not.toContain(secret); // encrypted
        expect(secretEnc).toMatch(/^v1:/);
        expect(meta.last4).toBe("1234");
        expect(meta.headerName).toBe("X-Api-Key");
    });
});

describe("maskRecipe — never leaks the secret or ciphertext", () => {
    it("returns type + non-secret meta + masked hint only", () => {
        const secret = "bearer-token-XYZ7890";
        const { secretEnc, meta } = buildRecipeStorage(
            { location: "header", headerName: "Authorization" },
            secret,
        );
        const row: AuthRecipeRow = {
            id: "r1", userId: "u1", orgId: null,
            name: "prod token", type: "bearer",
            meta, secretEnc,
            createdAt: new Date(), updatedAt: new Date(),
        };
        const masked = maskRecipe(row);
        // The full secret and the ciphertext must not appear anywhere.
        const serialized = JSON.stringify(masked);
        expect(serialized).not.toContain(secret);
        expect(serialized).not.toContain(secretEnc);
        expect(serialized).not.toMatch(/secretEnc/);
        // But the masked hint + descriptors ARE present.
        expect(masked.secretMasked).toBe("••••7890");
        expect(masked.type).toBe("bearer");
        expect(masked.meta.headerName).toBe("Authorization");
    });

    it("masks short secrets without exposing them", () => {
        const { meta } = buildRecipeStorage({}, "ab");
        const masked = maskRecipe({
            id: "r", userId: "u", orgId: null, name: "n", type: "header",
            meta, secretEnc: "v1:xxx", createdAt: new Date(), updatedAt: new Date(),
        });
        expect(masked.secretMasked).not.toContain("ab");
    });
});

describe("toAttachedCredential — decrypts for in-memory attachment", () => {
    it("round-trips the secret and carries the descriptors", () => {
        const secret = "cookie-session-value-999";
        const { secretEnc, meta } = buildRecipeStorage(
            { cookieName: "sid" },
            secret,
        );
        const cred = toAttachedCredential({ type: "cookie", meta, secretEnc });
        expect(cred.type).toBe("cookie");
        expect(cred.secret).toBe(secret); // decrypted in-memory
        expect(cred.cookieName).toBe("sid");
    });
});

describe("dynamic recipes (T8a) — masking never leaks the secret", () => {
    it("stores an encrypted JSON secret with NO last4, masks generically", () => {
        const secretObj = { clientSecret: "super-secret-value-9999" };
        const { secretEnc, meta } = buildRecipeStorage(
            { tokenUrl: "https://idp/token", clientId: "public-client-id" },
            JSON.stringify(secretObj),
            { includeLast4: false },
        );
        // No last4 → no fragment of the secret in meta.
        expect(meta.last4).toBeUndefined();
        expect(secretEnc).not.toContain("super-secret");

        const masked = maskRecipe({
            id: "r", userId: "u", orgId: null, name: "oauth", type: "oauth2ClientCredentials",
            meta, secretEnc, createdAt: new Date(), updatedAt: new Date(),
        });
        const serialized = JSON.stringify(masked);
        expect(serialized).not.toContain("super-secret");
        expect(masked.secretMasked).toBe("••••••"); // generic, no last4
        // Non-secret config passes through for the UI (T8b).
        expect(masked.meta.tokenUrl).toBe("https://idp/token");
        expect(masked.meta.clientId).toBe("public-client-id");
    });
});

describe("isDynamicType", () => {
    it("classifies types correctly", () => {
        expect(isDynamicType("bearer")).toBe(false);
        expect(isDynamicType("loginRequest")).toBe(true);
        expect(isDynamicType("oauth2ClientCredentials")).toBe(true);
    });
});

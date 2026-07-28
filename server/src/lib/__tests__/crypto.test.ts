// =============================================================================
// Tests for the AES-256-GCM credential encryption helper.
// =============================================================================

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import crypto from "node:crypto";
import {
    encryptSecret,
    decryptSecret,
    isEncryptionConfigured,
} from "../crypto.js";

const KEY_B64 = crypto.randomBytes(32).toString("base64");
const KEY_HEX = crypto.randomBytes(32).toString("hex");

describe("crypto — encrypt/decrypt round-trip", () => {
    beforeEach(() => {
        process.env.CREDENTIAL_ENC_KEY = KEY_B64;
    });
    afterEach(() => {
        delete process.env.CREDENTIAL_ENC_KEY;
    });

    it("round-trips a secret (base64 key)", () => {
        const secret = "Bearer sk_live_abcdef1234567890";
        const blob = encryptSecret(secret);
        expect(blob).toMatch(/^v1:/);
        expect(blob).not.toContain(secret); // ciphertext, not plaintext
        expect(decryptSecret(blob)).toBe(secret);
    });

    it("round-trips with a hex key too", () => {
        process.env.CREDENTIAL_ENC_KEY = KEY_HEX;
        const blob = encryptSecret("my-api-key-value");
        expect(decryptSecret(blob)).toBe("my-api-key-value");
    });

    it("produces a different blob each time (random IV), both decrypt equal", () => {
        const a = encryptSecret("same");
        const b = encryptSecret("same");
        expect(a).not.toBe(b);
        expect(decryptSecret(a)).toBe("same");
        expect(decryptSecret(b)).toBe("same");
    });

    it("isEncryptionConfigured is true with a valid key", () => {
        expect(isEncryptionConfigured()).toBe(true);
    });
});

describe("crypto — tamper detection", () => {
    beforeEach(() => {
        process.env.CREDENTIAL_ENC_KEY = KEY_B64;
    });
    afterEach(() => {
        delete process.env.CREDENTIAL_ENC_KEY;
    });

    it("a tampered ciphertext fails to decrypt", () => {
        const blob = encryptSecret("do-not-tamper");
        const [, b64] = blob.split(":");
        const buf = Buffer.from(b64!, "base64");
        buf[buf.length - 1] ^= 0xff; // flip a ciphertext byte
        const tampered = `v1:${buf.toString("base64")}`;
        expect(() => decryptSecret(tampered)).toThrow();
    });

    it("a malformed blob throws", () => {
        expect(() => decryptSecret("not-a-valid-blob")).toThrow();
        expect(() => decryptSecret("v1:@@@")).toThrow();
    });

    it("a blob encrypted with a different key fails", () => {
        const blob = encryptSecret("cross-key");
        process.env.CREDENTIAL_ENC_KEY = crypto.randomBytes(32).toString("base64");
        expect(() => decryptSecret(blob)).toThrow();
    });
});

describe("crypto — missing key fails loudly", () => {
    beforeEach(() => {
        delete process.env.CREDENTIAL_ENC_KEY;
    });

    it("encrypt throws a clear error when the key is unset", () => {
        expect(() => encryptSecret("x")).toThrow(/CREDENTIAL_ENC_KEY is not set/);
    });

    it("decrypt throws when the key is unset", () => {
        expect(() => decryptSecret("v1:AAAA")).toThrow(/CREDENTIAL_ENC_KEY is not set/);
    });

    it("isEncryptionConfigured is false with no key", () => {
        expect(isEncryptionConfigured()).toBe(false);
    });

    it("a key of the wrong length is rejected", () => {
        process.env.CREDENTIAL_ENC_KEY = Buffer.from("tooshort").toString("base64");
        expect(() => encryptSecret("x")).toThrow(/32 bytes/);
        delete process.env.CREDENTIAL_ENC_KEY;
    });
});

// =============================================================================
// Credential encryption — AES-256-GCM (authenticated) for auth-recipe secrets.
//
// Secrets (bearer tokens, API keys, cookies) MUST be encrypted at rest. The key
// comes from CREDENTIAL_ENC_KEY (32 bytes as base64 or hex). The key is loaded
// LAZILY (per call), so:
//   - importing this module never crashes boot (a server with no recipes runs
//     fine without the key), and
//   - the moment anyone tries to create/use a recipe without a key, it fails
//     LOUDLY with a clear message — we NEVER silently store plaintext or
//     auto-generate an ephemeral key (which would make ciphertext undecryptable
//     after a restart).
//
// Blob format: "v1:" + base64( iv(12) || tag(16) || ciphertext ). GCM's auth tag
// makes tampering detectable — decrypt throws on any modification.
// =============================================================================

import crypto from "node:crypto";

const ALGO = "aes-256-gcm";
const IV_LEN = 12; // GCM standard nonce length
const TAG_LEN = 16;
const VERSION = "v1";

const KEY_HELP =
    'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))" and set CREDENTIAL_ENC_KEY.';

/** Load + validate the 32-byte key. Throws loudly when unset/invalid. */
function loadKey(): Buffer {
    const raw = process.env.CREDENTIAL_ENC_KEY?.trim();
    if (!raw) {
        throw new Error(
            `CREDENTIAL_ENC_KEY is not set — auth-recipe encryption requires a 32-byte key. ${KEY_HELP}`,
        );
    }
    const key = /^[0-9a-fA-F]{64}$/.test(raw)
        ? Buffer.from(raw, "hex")
        : Buffer.from(raw, "base64");
    if (key.length !== 32) {
        throw new Error(
            `CREDENTIAL_ENC_KEY must decode to exactly 32 bytes (got ${key.length}). Provide a 32-byte key as base64 or hex. ${KEY_HELP}`,
        );
    }
    return key;
}

/** True when a usable encryption key is configured (does not throw). */
export function isEncryptionConfigured(): boolean {
    try {
        loadKey();
        return true;
    } catch {
        return false;
    }
}

/** Encrypt a UTF-8 secret → packed base64 blob. Throws if the key is missing. */
export function encryptSecret(plaintext: string): string {
    const key = loadKey();
    const iv = crypto.randomBytes(IV_LEN);
    const cipher = crypto.createCipheriv(ALGO, key, iv);
    const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${VERSION}:${Buffer.concat([iv, tag, ct]).toString("base64")}`;
}

/** Decrypt a blob produced by encryptSecret. Throws on missing key or tamper. */
export function decryptSecret(blob: string): string {
    const key = loadKey();
    const [version, b64] = blob.split(":");
    if (version !== VERSION || !b64) {
        throw new Error("Malformed encrypted credential blob");
    }
    const buf = Buffer.from(b64, "base64");
    if (buf.length < IV_LEN + TAG_LEN + 1) {
        throw new Error("Malformed encrypted credential blob");
    }
    const iv = buf.subarray(0, IV_LEN);
    const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
    const ct = buf.subarray(IV_LEN + TAG_LEN);
    const decipher = crypto.createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(tag);
    // .final() throws if the auth tag doesn't verify (tampered blob / wrong key).
    return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}

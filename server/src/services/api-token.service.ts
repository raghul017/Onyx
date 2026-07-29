// =============================================================================
// API Token service (T10a) — mint / hash / mask helpers for long-lived tokens.
//
// Security model:
//   - Format: "onyx_" + 43 base62 chars (~256 bits of entropy).
//   - We store ONLY a SHA-256 hash for deterministic, indexed lookup — never the
//     plaintext. (bcrypt can't be used: we need to find a row by hash. SHA-256 of
//     a 256-bit random token is preimage-infeasible, so a keyed HMAC isn't
//     required; kept dependency-free with no new env var.)
//   - The plaintext is returned ONCE on creation and never again / never logged.
//
// Pure + prisma-free so it's trivially unit-testable; the middleware/controller
// do the DB work using hashApiToken().
// =============================================================================

import crypto from "node:crypto";

export const API_TOKEN_PREFIX = "onyx_";

const BASE62 = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
/** # of base62 chars in the random part → 62^43 ≈ 2^256. */
const SECRET_LEN = 43;

/** Cryptographically-random base62 string, rejection-sampled (no modulo bias). */
function randomBase62(len: number): string {
    const out: string[] = [];
    while (out.length < len) {
        const buf = crypto.randomBytes(len);
        for (const b of buf) {
            // 248 = 62 * 4 — keep only the uniform range so every char is equally likely.
            if (b < 248) out.push(BASE62[b % 62]!);
            if (out.length === len) break;
        }
    }
    return out.join("");
}

/** SHA-256 (hex) of the full plaintext token — the value we store + look up by. */
export function hashApiToken(token: string): string {
    return crypto.createHash("sha256").update(token, "utf8").digest("hex");
}

export interface GeneratedApiToken {
    /** The plaintext token — returned ONCE, never stored/logged. */
    token: string;
    /** SHA-256 hex of the token (stored, unique-indexed). */
    tokenHash: string;
    /** Last 4 chars of the random part, for masked display. */
    last4: string;
}

/** Mint a new token + its stored hash + display last4. */
export function generateApiToken(): GeneratedApiToken {
    const secret = randomBase62(SECRET_LEN);
    const token = `${API_TOKEN_PREFIX}${secret}`;
    return {
        token,
        tokenHash: hashApiToken(token),
        last4: secret.slice(-4),
    };
}

/** True when a bearer value looks like an Onyx API token (vs a JWT). */
export function isApiToken(value: string): boolean {
    return value.startsWith(API_TOKEN_PREFIX);
}

/** Masked display form, e.g. "onyx_••••abcd". Never contains the real secret. */
export function maskApiToken(last4: string): string {
    return `${API_TOKEN_PREFIX}••••${last4}`;
}

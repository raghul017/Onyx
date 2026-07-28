// =============================================================================
// Auth Recipe service (T7a) — the crypto/masking/attach helpers for static
// credentials. Deliberately prisma-free and pure(ish): the controller does the
// DB work and calls these to encrypt/mask; the worker calls toAttachedCredential
// to decrypt in-memory at request time. The plaintext secret NEVER leaves this
// boundary via a masked view.
// =============================================================================

import { encryptSecret, decryptSecret } from "../lib/crypto.js";
import type { AttachedCredential } from "./request-builder.js";
import type { AuthRecipeMetaInput } from "../validators/schemas.js";

export type AuthRecipeType = "bearer" | "apiKey" | "header" | "cookie";

/** Non-secret descriptors persisted in AuthRecipe.meta (plus a masking hint). */
export interface AuthRecipeMeta extends AuthRecipeMetaInput {
    /** Last 4 chars of the secret, kept for masked display only. */
    last4?: string;
}

/** The DB row shape this service reads (subset). */
export interface AuthRecipeRow {
    id: string;
    userId: string | null;
    orgId: string | null;
    name: string;
    type: string;
    meta: unknown;
    secretEnc?: string;
    createdAt: Date;
    updatedAt: Date;
}

/** The masked, safe-to-return public view — NEVER the secret or ciphertext. */
export interface MaskedAuthRecipe {
    id: string;
    userId: string | null;
    orgId: string | null;
    name: string;
    type: string;
    meta: { headerName?: string; queryName?: string; location?: "header" | "query"; cookieName?: string };
    secretMasked: string;
    createdAt: Date;
    updatedAt: Date;
}

function last4(secret: string): string {
    const s = secret ?? "";
    return s.length <= 4 ? "•".repeat(s.length) : s.slice(-4);
}

/**
 * Build the persisted fields for a recipe: the encrypted secret + a meta object
 * carrying only non-secret descriptors and a last4 masking hint. Throws (via
 * encryptSecret) if the encryption key is not configured.
 */
export function buildRecipeStorage(
    meta: AuthRecipeMetaInput,
    secret: string,
): { secretEnc: string; meta: AuthRecipeMeta } {
    return {
        secretEnc: encryptSecret(secret),
        meta: { ...meta, last4: last4(secret) },
    };
}

/** Convert a row into the masked public view. Does NOT decrypt. */
export function maskRecipe(row: AuthRecipeRow): MaskedAuthRecipe {
    const meta = (row.meta ?? {}) as AuthRecipeMeta;
    return {
        id: row.id,
        userId: row.userId,
        orgId: row.orgId,
        name: row.name,
        type: row.type,
        meta: {
            headerName: meta.headerName,
            queryName: meta.queryName,
            location: meta.location,
            cookieName: meta.cookieName,
        },
        secretMasked: `••••${meta.last4 ?? ""}`,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
    };
}

/**
 * Decrypt a recipe into an in-memory credential for request-time attachment.
 * ONLY the worker calls this. Throws if the key is missing or the blob is
 * tampered. The returned secret must never be persisted or logged.
 */
export function toAttachedCredential(row: {
    type: string;
    meta: unknown;
    secretEnc: string;
}): AttachedCredential {
    const meta = (row.meta ?? {}) as AuthRecipeMeta;
    return {
        type: row.type as AuthRecipeType,
        secret: decryptSecret(row.secretEnc),
        headerName: meta.headerName,
        queryName: meta.queryName,
        location: meta.location,
        cookieName: meta.cookieName,
    };
}

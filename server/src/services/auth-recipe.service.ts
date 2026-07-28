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

export type AuthRecipeType =
    | "bearer"
    | "apiKey"
    | "header"
    | "cookie"
    | "loginRequest"
    | "oauth2ClientCredentials";

/** Dynamic types obtain a token at scan time (T8a) rather than storing a static value. */
const DYNAMIC_TYPES = new Set<string>(["loginRequest", "oauth2ClientCredentials"]);
export function isDynamicType(type: string): boolean {
    return DYNAMIC_TYPES.has(type);
}

/** Non-secret descriptors persisted in AuthRecipe.meta (plus a masking hint). */
export interface AuthRecipeMeta extends AuthRecipeMetaInput {
    /** Last 4 chars of the secret, kept for masked display only (static types only). */
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
    /** All NON-secret meta descriptors (static + dynamic), minus the last4 hint. */
    meta: Record<string, unknown>;
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
 * carrying only non-secret descriptors. For STATIC types we add a last4 hint for
 * masked display; DYNAMIC types (whose secret is a JSON blob) get NO last4, so
 * no fragment of a secret value leaks. Throws (via encryptSecret) if the key is
 * not configured.
 */
export function buildRecipeStorage(
    meta: AuthRecipeMetaInput,
    secretPlain: string,
    opts: { includeLast4?: boolean } = {},
): { secretEnc: string; meta: AuthRecipeMeta } {
    const includeLast4 = opts.includeLast4 ?? true;
    return {
        secretEnc: encryptSecret(secretPlain),
        meta: includeLast4 ? { ...meta, last4: last4(secretPlain) } : { ...meta },
    };
}

/** Convert a row into the masked public view. Does NOT decrypt. */
export function maskRecipe(row: AuthRecipeRow): MaskedAuthRecipe {
    const meta = (row.meta ?? {}) as AuthRecipeMeta;
    // Return every meta field EXCEPT the last4 hint. meta is non-secret by
    // contract (secrets live only in secretEnc), so this is safe to expose.
    const { last4: _last4, ...publicMeta } = meta;
    return {
        id: row.id,
        userId: row.userId,
        orgId: row.orgId,
        name: row.name,
        type: row.type,
        meta: publicMeta as Record<string, unknown>,
        secretMasked: meta.last4 ? `••••${meta.last4}` : "••••••",
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
        // Static types only — dynamic types resolve via auth-runner.
        type: row.type as AttachedCredential["type"],
        secret: decryptSecret(row.secretEnc),
        headerName: meta.headerName,
        queryName: meta.queryName,
        location: meta.location,
        cookieName: meta.cookieName,
    };
}

// =============================================================================
// Scan identities (T13c) — the client-side model for the "Identities" section of
// the new-scan form, plus the pure builder that turns rows into the exact payload
// the backend expects.
//
// Server contract (server/src/validators/schemas.ts):
//   identities?: [{ label: string(1..40), authRecipeId?: uuid, isPrimary?: bool }]
//   • at most MAX_RUN_IDENTITIES (4), labels unique, at most ONE isPrimary
//   • authRecipeId is OMITTED (never null) for an anonymous identity
//   • omitting `identities` entirely + sending legacy `authRecipeId` is the
//     backward-compatible single-identity path — which is what we send for one row.
// =============================================================================

/** Max identities per run — mirrors the server's MAX_RUN_IDENTITIES. */
export const MAX_IDENTITIES = 4;

/** One row in the scan form's Identities list. */
export interface IdentityRow {
    /** Stable key for React list rendering. */
    key: string;
    label: string;
    /** "" = Anonymous (no credential). */
    authRecipeId: string;
    isPrimary: boolean;
}

/** The exact per-identity shape the API accepts. */
export interface IdentityPayload {
    label: string;
    authRecipeId?: string;
    isPrimary?: boolean;
}

/** What createTestRun should send, derived from the rows. */
export interface ScanIdentityPayload {
    /** Legacy single-recipe field — used when there's only ONE identity. */
    authRecipeId?: string;
    /** Sent only for 2+ identities (multi-identity / BOLA runs). */
    identities?: IdentityPayload[];
}

export function newIdentityRow(index: number, isPrimary = false): IdentityRow {
    return {
        key: `identity-${index}-${Math.random().toString(36).slice(2, 8)}`,
        label: index === 0 ? "User A" : `User ${String.fromCharCode(65 + index)}`,
        authRecipeId: "",
        isPrimary,
    };
}

/** True when the row has a real credential attached (not anonymous). */
export function isCredentialed(row: IdentityRow): boolean {
    return row.authRecipeId.trim() !== "";
}

/**
 * BOLA testing needs a credentialed PRIMARY (A owns objects) plus at least one
 * other identity to replay as. Drives the "BOLA enabled" hint on the form.
 */
export function isBolaEnabled(rows: IdentityRow[]): boolean {
    if (rows.length < 2) return false;
    const primary = rows.find((r) => r.isPrimary) ?? rows[0];
    if (!primary || !isCredentialed(primary)) return false;
    // At least one OTHER identity (credentialed or anonymous) to act as B.
    return rows.some((r) => r !== primary);
}

/**
 * Build the createTestRun payload from the form rows.
 *   • ONE row  → legacy shape (authRecipeId only, or nothing when anonymous), so
 *     a single-identity scan is byte-for-byte what we sent before T13c.
 *   • 2+ rows  → the `identities` array, trimmed labels, anonymous rows omit
 *     authRecipeId, and exactly one row is flagged primary.
 * Rows with an empty label are dropped (the UI also validates).
 */
export function buildIdentityPayload(rows: IdentityRow[]): ScanIdentityPayload {
    const usable = rows.filter((r) => r.label.trim() !== "");
    if (usable.length === 0) return {};

    // Backward-compatible single-identity path.
    if (usable.length === 1) {
        const only = usable[0]!;
        return isCredentialed(only) ? { authRecipeId: only.authRecipeId } : {};
    }

    const primaryIdx = Math.max(
        0,
        usable.findIndex((r) => r.isPrimary),
    );
    return {
        identities: usable.slice(0, MAX_IDENTITIES).map((r, i) => ({
            label: r.label.trim(),
            ...(isCredentialed(r) ? { authRecipeId: r.authRecipeId } : {}),
            ...(i === primaryIdx ? { isPrimary: true } : {}),
        })),
    };
}

/** Client-side validation mirroring the server's rules. Returns an error or null. */
export function validateIdentities(rows: IdentityRow[]): string | null {
    const usable = rows.filter((r) => r.label.trim() !== "");
    if (usable.length !== rows.length) return "Every identity needs a label.";
    if (usable.length > MAX_IDENTITIES) return `At most ${MAX_IDENTITIES} identities per scan.`;
    const labels = usable.map((r) => r.label.trim().toLowerCase());
    if (new Set(labels).size !== labels.length) return "Identity labels must be unique.";
    return null;
}

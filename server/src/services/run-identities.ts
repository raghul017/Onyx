// =============================================================================
// Run identities (T12) — pure helpers to normalize the create-run `identities`
// input into a canonical list, and to pick the primary. Kept DB-free so it's
// unit-testable and shared by the controller.
//
// SCOPE: this is the multi-identity FOUNDATION. The scan (baseline + attacks)
// still runs under the PRIMARY identity only — no attack fan-out. Secondaries
// are persisted + ownership-validated so T13 can resolve their credentials for
// targeted cross-identity (BOLA) replays.
// =============================================================================

import type { RunIdentityInput } from "../validators/schemas.js";

/** A normalized identity ready to persist as a RunIdentity row. */
export interface NormalizedIdentity {
    label: string;
    authRecipeId: string | null; // null = anonymous (no credential)
    isPrimary: boolean;
}

/**
 * Normalize the create-run request into a canonical identity list with EXACTLY
 * one primary, backward-compatible with the legacy single-recipe/anonymous flow:
 *
 *   - `identities` given  → use them; primary = the flagged one, else the first.
 *   - only `authRecipeId` → a single primary identity with that recipe.
 *   - neither             → a single anonymous primary identity ("primary").
 *
 * Labels are trimmed. The primary is always first in the returned array.
 */
export function normalizeIdentities(input: {
    authRecipeId?: string;
    identities?: RunIdentityInput[];
}): NormalizedIdentity[] {
    if (input.identities && input.identities.length > 0) {
        const flaggedIdx = input.identities.findIndex((i) => i.isPrimary);
        const primaryIdx = flaggedIdx >= 0 ? flaggedIdx : 0;
        const normalized = input.identities.map((i, idx) => ({
            label: i.label.trim(),
            authRecipeId: i.authRecipeId ?? null,
            isPrimary: idx === primaryIdx,
        }));
        // Primary first (stable order for the rest).
        return [
            normalized[primaryIdx]!,
            ...normalized.filter((_, idx) => idx !== primaryIdx),
        ];
    }

    // Legacy path: one identity mirroring authRecipeId (or anonymous).
    return [
        {
            label: input.authRecipeId ? "primary" : "anonymous",
            authRecipeId: input.authRecipeId ?? null,
            isPrimary: true,
        },
    ];
}

/** The recipe id the SCAN runs under = the primary identity's recipe (or null). */
export function primaryRecipeId(identities: NormalizedIdentity[]): string | null {
    return identities.find((i) => i.isPrimary)?.authRecipeId ?? null;
}

/** Distinct, non-null recipe ids across all identities (for ownership checks). */
export function distinctRecipeIds(identities: NormalizedIdentity[]): string[] {
    return [...new Set(identities.map((i) => i.authRecipeId).filter((r): r is string => r != null))];
}

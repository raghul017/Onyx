// =============================================================================
// Re-scan badge state (T15c) — pure mapping from a finding's persisted re-scan
// fields, and from a fresh rescan response, to what the UI should show.
//
// Kept free of React so the rules are unit-testable: the safety-critical one is
// that NOTHING except an explicit resolved outcome can ever show "Resolved".
// =============================================================================

import type { RescanOutcome } from "@/services/api";

export type BadgeState = "resolved" | "still_present" | "none";

export interface RescanFields {
    resolvedAt?: string | null;
    lastCheckedAt?: string | null;
}

/**
 * Badge to show on load, from the persisted fields:
 *   resolvedAt set                    → Resolved
 *   lastCheckedAt only (re-checked)   → Still present
 *   neither (never re-scanned)        → no badge
 */
export function badgeStateFor(fields: RescanFields | undefined | null): BadgeState {
    if (!fields) return "none";
    if (fields.resolvedAt) return "resolved";
    if (fields.lastCheckedAt) return "still_present";
    return "none";
}

/**
 * Badge to show after a re-scan response. Only an explicit "resolved" outcome
 * may show Resolved — "unsupported" and "error" must NEVER imply a fix.
 */
export function badgeStateForOutcome(outcome: RescanOutcome): BadgeState {
    if (outcome === "resolved") return "resolved";
    if (outcome === "still_present") return "still_present";
    return "none"; // unsupported | error → leave the badge alone
}

/** Can this finding type be re-scanned? (BOLA/BFLA need a live second identity.) */
export function isRescanSupported(attackType: string | undefined | null): boolean {
    if (!attackType) return true; // unknown type → let the backend decide
    return attackType !== "BOLA_REPLAY" && attackType !== "BFLA_PROBE";
}

/** Compact relative time ("just now", "5m ago", "3h ago", "2d ago"). */
export function relativeTime(iso: string | null | undefined, now: number = Date.now()): string {
    if (!iso) return "";
    const then = new Date(iso).getTime();
    if (Number.isNaN(then)) return "";
    const secs = Math.max(0, Math.round((now - then) / 1000));
    if (secs < 60) return "just now";
    const mins = Math.round(secs / 60);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.round(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.round(hours / 24)}d ago`;
}

// =============================================================================
// BFLA verdict (T14a) — decide whether a SECONDARY identity B was able to call a
// privileged/administrative function it should have been denied (OWASP API5).
//
// Mirrors the BOLA verdict's shape and its conservatism:
//   • B not 2xx (401/403/404/…)        → SAFE (properly denied / absent)
//   • endpoint not privileged           → SAFE (nothing to escalate to)
//   • A ALSO 404 / endpoint absent      → SAFE (can't attribute; may not exist)
//   • B 2xx on a privileged function    → CONFIRMED BFLA
// The LLM (optional) may only VETO a candidate — it never raises a finding on its
// own, and its absence/failure leaves the deterministic verdict standing.
// =============================================================================

import { logger } from "../lib/logger.js";
import type { FindingDetail, Confidence } from "./finding-analysis.js";
import type { SeverityLevel } from "../utils/severity.js";
import { DESTRUCTIVE_METHODS } from "./privileged-endpoint.js";

const log = logger.child({ component: "bfla-verdict" });

export interface BflaVerdictInput {
    method: string;
    path: string;
    /** Why the endpoint was flagged privileged (from the heuristic). */
    privilegedReason: string;
    aLabel: string; // primary / higher-privilege identity
    bLabel: string; // secondary identity that should be denied
    aStatus: number | null; // A's result on the same endpoint (context)
    bStatus: number;
    bBody: string; // B's response snippet (already redacted)
}

/** Asks the LLM whether this really is a privileged function. Veto-only. */
export type BflaJudge = (
    input: BflaVerdictInput,
) => Promise<{ isPrivileged: boolean; reason?: string } | null>;

export type BflaFinding = FindingDetail;

const isSuccess = (s: number | null): boolean => s != null && s >= 200 && s < 300;
/** 404/501 from BOTH sides means the function probably isn't there at all. */
const isAbsent = (s: number | null): boolean => s === 404 || s === 501;

function truncate(s: string, n: number): string {
    return s.length > n ? s.slice(0, n) + "…" : s;
}

/**
 * Decide the BFLA verdict for one (endpoint, identity B) probe.
 * Returns null when SAFE (no finding), else the finding to persist.
 */
export async function decideBflaVerdict(
    input: BflaVerdictInput,
    judge?: BflaJudge,
): Promise<BflaFinding | null> {
    // 1) B was denied (or errored) → the control worked. Never a finding.
    if (!isSuccess(input.bStatus)) return null;

    // 2) The endpoint must actually look privileged (planner already filtered,
    //    but never emit API5 without a stated reason).
    if (!input.privilegedReason) return null;

    // 3) If the function appears ABSENT for the privileged identity too, we can't
    //    claim an authorization failure (B may be hitting a catch-all/SPA route).
    if (isAbsent(input.aStatus)) return null;

    // 4) Candidate. The judge may VETO ("this isn't really administrative").
    let judged: { isPrivileged: boolean; reason?: string } | null = null;
    if (judge) {
        try {
            judged = await judge(input);
        } catch (err) {
            log.warn(
                { reason: err instanceof Error ? err.message : String(err) },
                "BFLA judge failed — falling back to the deterministic verdict",
            );
            judged = null;
        }
    }
    if (judged && judged.isPrivileged === false) return null;

    const destructive = DESTRUCTIVE_METHODS.has(input.method.toUpperCase());
    const severity: SeverityLevel = destructive ? "CRITICAL" : "HIGH";
    // "confirmed" only when the judge corroborates; else the deterministic "firm".
    const confidence: Confidence = judged?.isPrivileged ? "confirmed" : "firm";
    const endpoint = `${input.method.toUpperCase()} ${input.path}`;

    const evidence = [
        `B (${input.bLabel}) → ${endpoint} → ${input.bStatus} (allowed)`,
        `  ${truncate(input.bBody, 400)}`,
        `A (${input.aLabel}, higher privilege) → ${endpoint} → ${
            input.aStatus ?? "n/a"
        }`,
        `flagged privileged: ${input.privilegedReason}`,
    ].join("\n");

    return {
        severity,
        category: "Broken Function Level Authorization",
        title: `Privileged endpoint callable by ${input.bLabel}`,
        cause:
            `Secondary user ${input.bLabel} successfully called the privileged endpoint ${endpoint}, ` +
            `which should require elevated privileges (${input.privilegedReason}). The endpoint ` +
            `authenticated the caller but never checked whether that caller is authorized to invoke ` +
            `this function` +
            (destructive ? ", and the method is destructive." : ".") +
            (judged?.reason ? ` Analysis: ${judged.reason}` : ""),
        evidence,
        remediation:
            "Enforce a function-level authorization check on every privileged route: verify the caller's " +
            "role/scope server-side before executing the handler, not just that they are logged in. Deny " +
            "by default and apply the check in shared middleware so a new admin route can't forget it. " +
            "Never rely on the UI hiding an endpoint — the route itself must reject unauthorized callers.",
        confidence,
        owaspCategory: "API5_BFLA",
    };
}

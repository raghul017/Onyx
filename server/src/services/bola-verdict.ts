// =============================================================================
// BOLA verdict (T13b) — decide whether identity B received identity A's private
// object, and if so produce a persisted API1 finding.
//
// Conservative by design (no false positives). Deterministic gates run FIRST and
// can only ever REDUCE noise:
//   • B not 2xx (401/403/404/…)          → SAFE  (access properly denied)
//   • B 2xx but empty / error-shaped body → SAFE
//   • B 2xx and body clearly DIFFERS from A → SAFE (API scoped B to its own data)
//   • B 2xx and body substantially MATCHES A → CANDIDATE
// A candidate is then interpreted by Gemini (JSON mode, focused yes/no). Only a
// strong deterministic match AND Gemini agreement yields confidence "confirmed";
// if Gemini is unavailable or errors we FALL BACK to the deterministic verdict at
// confidence "firm" — the LLM can never crash or block the pipeline, and it is
// never the sole reason a finding is raised.
//
// The Gemini call receives only REDACTED, size-capped bodies (no credentials).
// =============================================================================

import { logger } from "../lib/logger.js";
import type { FindingDetail, Confidence } from "./finding-analysis.js";
import type { SeverityLevel } from "../utils/severity.js";

const log = logger.child({ component: "bola-verdict" });

/** Max chars of each body sent to the LLM (and used for similarity). */
export const MAX_BODY_CHARS = 2000;

export interface BolaVerdictInput {
    endpoint: string; // e.g. "GET /users/{id}"
    objectId: string; // A's object id that B requested
    aLabel: string; // identity A's human label
    bLabel: string; // identity B's human label
    aStatus: number;
    aBody: string; // A's response snippet (already redacted)
    bStatus: number;
    bBody: string; // B's response snippet (already redacted)
}

/** Asks the LLM: did B receive A's private object? Injected for testability. */
export type BolaJudge = (
    input: BolaVerdictInput,
) => Promise<{ isBola: boolean; reason?: string } | null>;

const isSuccess = (status: number) => status >= 200 && status < 300;

/** Error-shaped or empty bodies never evidence a successful cross-tenant read. */
function isEmptyOrError(body: string): boolean {
    const t = body.trim();
    if (t.length === 0) return true;
    if (t === "{}" || t === "[]" || t === "null") return true;
    // A JSON error envelope (no data) — e.g. {"error":"forbidden"}.
    return /^\s*\{\s*"(error|message|detail|code)"\s*:/i.test(t) && !/"(id|_id|uuid)"\s*:/i.test(t);
}

/** Extract identifying field values (id-ish + short scalars) for comparison. */
function identityFields(body: string): Map<string, string> {
    const fields = new Map<string, string>();
    try {
        const parsed = JSON.parse(body) as unknown;
        const obj = Array.isArray(parsed) ? parsed[0] : parsed;
        if (obj && typeof obj === "object") {
            for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
                if (v == null) continue;
                if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
                    fields.set(k, String(v));
                }
            }
        }
    } catch {
        // Non-JSON — fall back to raw comparison via the caller's similarity.
    }
    return fields;
}

/** Jaccard-ish similarity over normalized tokens; cheap and dependency-free. */
function textSimilarity(a: string, b: string): number {
    const norm = (s: string) =>
        new Set(
            s
                .toLowerCase()
                .replace(/[^a-z0-9_":,.-]/g, " ")
                .split(/\s+/)
                .filter((t) => t.length > 1),
        );
    const sa = norm(a);
    const sb = norm(b);
    if (sa.size === 0 && sb.size === 0) return 1;
    if (sa.size === 0 || sb.size === 0) return 0;
    let inter = 0;
    for (const t of sa) if (sb.has(t)) inter++;
    return inter / (sa.size + sb.size - inter);
}

export interface BodyMatch {
    /** "strong" = same resource; "weak"/"none" = different data. */
    strength: "strong" | "weak" | "none";
    similarity: number;
    /** Identifying fields present in BOTH bodies with the SAME value. */
    sharedFields: string[];
}

/**
 * Compare B's body against A's. Strong = B returned the SAME resource A did
 * (identical identifying field values, or very high textual similarity).
 */
export function compareBodies(aBody: string, bBody: string): BodyMatch {
    const similarity = textSimilarity(aBody, bBody);

    const aFields = identityFields(aBody);
    const bFields = identityFields(bBody);
    const sharedFields: string[] = [];
    for (const [k, v] of aFields) {
        if (bFields.get(k) === v) sharedFields.push(k);
    }
    // An id-ish field matching exactly is the strongest single signal.
    const idMatched = sharedFields.some((k) => /^(id|_id|uuid|guid)$/i.test(k));

    if (aBody.trim() === bBody.trim() && aBody.trim().length > 0) {
        return { strength: "strong", similarity: 1, sharedFields };
    }
    if (idMatched && sharedFields.length >= 2) {
        return { strength: "strong", similarity, sharedFields };
    }
    if (similarity >= 0.85) return { strength: "strong", similarity, sharedFields };
    if (similarity >= 0.5) return { strength: "weak", similarity, sharedFields };
    return { strength: "none", similarity, sharedFields };
}

/** The persisted BOLA finding (a FindingDetail with API1 attached). */
export type BolaFinding = FindingDetail;

function buildFinding(
    input: BolaVerdictInput,
    match: BodyMatch,
    confidence: Confidence,
    judgeReason?: string,
): BolaFinding {
    const severity: SeverityLevel = confidence === "confirmed" ? "CRITICAL" : "HIGH";
    const shared = match.sharedFields.length > 0 ? match.sharedFields.join(", ") : "the same payload";

    // Evidence shows BOTH requests side by side with their statuses.
    const evidence = [
        `A (${input.aLabel}) → ${input.endpoint} [id=${input.objectId}] → ${input.aStatus}`,
        `  ${truncate(input.aBody, 400)}`,
        `B (${input.bLabel}) → ${input.endpoint} [id=${input.objectId}] → ${input.bStatus}`,
        `  ${truncate(input.bBody, 400)}`,
        `similarity=${match.similarity.toFixed(2)} sharedFields=[${match.sharedFields.join(", ")}]`,
    ].join("\n");

    const cause =
        `User ${input.bLabel} requested user ${input.aLabel}'s object ${input.objectId} on ${input.endpoint} ` +
        `and received ${input.aLabel}'s data (matching ${shared}). The endpoint returned the object without ` +
        `verifying that the caller owns it — it authenticated the request but never authorized the object.` +
        (judgeReason ? ` Analysis: ${judgeReason}` : "");

    return {
        severity,
        category: "Broken Object Level Authorization",
        title: `Object ${input.objectId} readable by another user`,
        cause,
        evidence,
        remediation:
            "Enforce an ownership check on every object lookup: after loading the object, verify it belongs to " +
            "the authenticated caller (or that the caller holds an explicit grant) before returning it. Apply the " +
            "check in a shared data-access layer so no endpoint can forget it, and prefer non-guessable ids " +
            "(UUIDs) as defense in depth — ids alone are not authorization.",
        confidence,
        owaspCategory: "API1_BOLA",
    };
}

function truncate(s: string, n: number): string {
    return s.length > n ? s.slice(0, n) + "…" : s;
}

/**
 * Decide the BOLA verdict for one (endpoint, objectId) A/B pair.
 * Returns null when SAFE (no finding), else the finding to persist.
 */
export async function decideBolaVerdict(
    input: BolaVerdictInput,
    judge?: BolaJudge,
): Promise<BolaFinding | null> {
    // 1) B was denied → the control worked. Never a finding.
    if (!isSuccess(input.bStatus)) return null;

    // 2) B got a 2xx but nothing meaningful → no evidence of data exposure.
    if (isEmptyOrError(input.bBody)) return null;

    // 3) A itself must have gotten the object; if A couldn't read it, we have no
    //    ground truth to compare against (avoids false positives on public data).
    if (!isSuccess(input.aStatus) || isEmptyOrError(input.aBody)) return null;

    // 4) Deterministic comparison.
    const match = compareBodies(input.aBody, input.bBody);
    if (match.strength !== "strong") return null; // B saw different data → safe

    // 5) Candidate. Ask the LLM to interpret; never let it crash or block.
    let judged: { isBola: boolean; reason?: string } | null = null;
    if (judge) {
        try {
            judged = await judge(input);
        } catch (err) {
            log.warn(
                { reason: err instanceof Error ? err.message : String(err) },
                "BOLA judge failed — falling back to deterministic verdict",
            );
            judged = null;
        }
    }

    // Gemini explicitly says "not BOLA" → trust it and stay silent (conservative).
    if (judged && judged.isBola === false) return null;

    // Confirmed only when the strong match is corroborated by the judge;
    // otherwise (judge unavailable/errored) fall back to a "firm" verdict.
    const confidence: Confidence = judged?.isBola ? "confirmed" : "firm";
    return buildFinding(input, match, confidence, judged?.reason);
}

// =============================================================================
// Excessive Data Exposure (T14c, OWASP API3) — detect sensitive/internal
// properties an API returns that a client should never see.
//
// Analyzes RESPONSES the scan ALREADY collected — no new attack traffic.
//
// Design notes:
//  • VALUE-AWARE. A key alone never counts: `{"error":"password required"}` is
//    not an exposure. Each field must carry a plausible value (right shape where
//    checkable — SSN/card/JWT/hash regexes), so error strings and empty/redacted
//    placeholders are ignored.
//  • COMPLEMENTS the T1 SECRET_LEAK rule rather than duplicating it. SECRET_LEAK
//    already flags api_key/secret/private-key/access_token/password patterns as
//    CRITICAL "Sensitive Data Exposure"; callers skip this detector for those
//    bodies (see hasSecretLeak) so one response never yields two findings.
//  • PII is treated CONSERVATIVELY to limit noise: a single `email` on what is
//    plausibly the caller's own record is NOT flagged; PII only counts in bulk
//    (a LIST of other people's records) or alongside a stronger signal.
// =============================================================================

import type { FindingDetail } from "./finding-analysis.js";
import type { SeverityLevel } from "../utils/severity.js";

/** How sensitive a field is — drives severity + whether PII rules apply. */
export type FieldGrade = "credential" | "pii" | "internal";

interface FieldRule {
    grade: FieldGrade;
    /** Value must match to count (guards against key-only mentions). */
    plausible: (v: unknown) => boolean;
}

const nonEmptyString = (v: unknown): v is string =>
    typeof v === "string" && v.trim().length > 0;

/** A value that looks like a real secret, not a placeholder/redaction. */
const secretish = (v: unknown): boolean => {
    if (!nonEmptyString(v)) return false;
    const s = v.trim();
    if (s.length < 6) return false;
    // Ignore our own redaction + common placeholders.
    if (/^\*+$/.test(s)) return false;
    if (/REDACTED|^null$|^none$|^n\/a$|^string$|^test$|^changeme$/i.test(s)) return false;
    return true;
};

/** bcrypt / argon / MD5-SHA hex — a stored password hash. */
const hashish = (v: unknown): boolean =>
    nonEmptyString(v) &&
    (/^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(v) || // bcrypt
        /^\$argon2[id]{1,2}\$/.test(v) ||
        /^[a-f0-9]{32,128}$/i.test(v.trim())); // md5/sha hex

/** JWT or a long opaque token. */
const tokenish = (v: unknown): boolean =>
    nonEmptyString(v) &&
    (/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(v.trim()) || // JWT
        (secretish(v) && v.trim().length >= 16));

const ssnish = (v: unknown): boolean =>
    nonEmptyString(v) && /^\d{3}-?\d{2}-?\d{4}$/.test(v.trim());

/** 13-19 digits (optionally spaced/dashed) — a full card number. */
const cardish = (v: unknown): boolean => {
    if (typeof v === "number") return /^\d{13,19}$/.test(String(v));
    if (!nonEmptyString(v)) return false;
    const digits = v.replace(/[ -]/g, "");
    return /^\d{13,19}$/.test(digits);
};

const cvvish = (v: unknown): boolean =>
    /^\d{3,4}$/.test(typeof v === "number" ? String(v) : nonEmptyString(v) ? v.trim() : "");

const emailish = (v: unknown): boolean =>
    nonEmptyString(v) && /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(v.trim());

const phoneish = (v: unknown): boolean =>
    nonEmptyString(v) && /^[+]?[\d ()-]{9,}$/.test(v.trim()) && (v.match(/\d/g) ?? []).length >= 9;

const trueFlag = (v: unknown): boolean => v === true || v === "true";

/**
 * The curated field list. Key match is case-insensitive and WHOLE-KEY (after
 * stripping _ and -), so `passwordHint` or `tokenCount` don't match.
 */
const FIELD_RULES: Record<string, FieldRule> = {
    // ---- credential-grade (CRITICAL) ----
    password: { grade: "credential", plausible: secretish },
    passwordhash: { grade: "credential", plausible: (v) => hashish(v) || secretish(v) },
    passwd: { grade: "credential", plausible: secretish },
    pwd: { grade: "credential", plausible: secretish },
    hash: { grade: "credential", plausible: hashish },
    salt: { grade: "credential", plausible: secretish },
    token: { grade: "credential", plausible: tokenish },
    accesstoken: { grade: "credential", plausible: tokenish },
    refreshtoken: { grade: "credential", plausible: tokenish },
    secret: { grade: "credential", plausible: secretish },
    apikey: { grade: "credential", plausible: secretish },
    privatekey: { grade: "credential", plausible: secretish },
    ssn: { grade: "credential", plausible: ssnish },
    socialsecurity: { grade: "credential", plausible: ssnish },
    socialsecuritynumber: { grade: "credential", plausible: ssnish },
    creditcard: { grade: "credential", plausible: cardish },
    cardnumber: { grade: "credential", plausible: cardish },
    cvv: { grade: "credential", plausible: cvvish },
    pin: { grade: "credential", plausible: cvvish },

    // ---- internal flags / notes (HIGH) ----
    isadmin: { grade: "internal", plausible: trueFlag },
    internalnotes: { grade: "internal", plausible: nonEmptyString },
    internal: { grade: "internal", plausible: (v) => trueFlag(v) || nonEmptyString(v) },
    debug: { grade: "internal", plausible: (v) => trueFlag(v) || nonEmptyString(v) },

    // ---- PII (HIGH, but only counted in bulk — see analyzeResponseExposure) ----
    email: { grade: "pii", plausible: emailish },
    phone: { grade: "pii", plausible: phoneish },
    dob: { grade: "pii", plausible: nonEmptyString },
    dateofbirth: { grade: "pii", plausible: nonEmptyString },
};

/** Normalize a JSON key for whole-key matching: lowercase, strip _ and -. */
function normalizeKey(key: string): string {
    return key.toLowerCase().replace(/[_-]/g, "");
}

export interface ExposedField {
    /** The key exactly as it appeared in the response. */
    field: string;
    grade: FieldGrade;
}

/** How many distinct records the body looks like it contains (for PII bulk). */
function countRecords(parsed: unknown): number {
    if (Array.isArray(parsed)) return parsed.length;
    if (parsed && typeof parsed === "object") {
        for (const v of Object.values(parsed as Record<string, unknown>)) {
            if (Array.isArray(v) && v.length > 0 && typeof v[0] === "object") return v.length;
        }
    }
    return 1;
}

/** Walk the parsed body collecting sensitive fields carrying plausible values. */
function collectFields(node: unknown, out: Map<string, ExposedField>, depth = 0): void {
    if (depth > 6 || node == null) return;
    if (Array.isArray(node)) {
        for (const item of node) collectFields(item, out, depth + 1);
        return;
    }
    if (typeof node !== "object") return;

    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
        const rule = FIELD_RULES[normalizeKey(key)];
        if (rule && rule.plausible(value)) {
            if (!out.has(key)) out.set(key, { field: key, grade: rule.grade });
        }
        collectFields(value, out, depth + 1);
    }
}

/**
 * True when the T1 SECRET_LEAK rule already covers this body. Callers skip the
 * exposure detector then, so a single response never yields two findings.
 * (Kept in sync with finding-analysis.ts's SECRET_LEAK pattern.)
 */
export function hasSecretLeak(body: string): boolean {
    return /(-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----|aws_secret_access_key|"(?:api[_-]?key|secret|password|passwd|access[_-]?token|private[_-]?key)"\s*:\s*"[^"]{6,})/i.test(
        body,
    );
}

export interface ExposureAnalysis {
    fields: ExposedField[];
    /** Highest grade present — drives severity. */
    topGrade: FieldGrade | null;
}

/**
 * Analyze ONE response body for excessive data exposure.
 * Returns an empty result (no finding) when the body isn't 2xx JSON, when
 * SECRET_LEAK already covers it, or when nothing plausible is found.
 */
export function analyzeResponseExposure(
    statusCode: number,
    body: string | null | undefined,
): ExposureAnalysis {
    const empty: ExposureAnalysis = { fields: [], topGrade: null };
    if (statusCode < 200 || statusCode >= 300) return empty; // only successful reads
    if (!body || body.trim().length === 0) return empty;
    // Complement, don't duplicate, the T1 SECRET_LEAK rule.
    if (hasSecretLeak(body)) return empty;

    let parsed: unknown;
    try {
        parsed = JSON.parse(body);
    } catch {
        return empty; // structured detection only — non-JSON is out of scope
    }
    if (parsed == null || typeof parsed !== "object") return empty;

    const found = new Map<string, ExposedField>();
    collectFields(parsed, found);
    let fields = [...found.values()];
    if (fields.length === 0) return empty;

    // PII is noisy: a single record's own email/phone is normal for "GET /me".
    // Count PII only in BULK (a list of several records) or when a stronger
    // credential/internal signal is present in the same body.
    const hasStrong = fields.some((f) => f.grade !== "pii");
    const records = countRecords(parsed);
    if (!hasStrong && records < 3) {
        fields = fields.filter((f) => f.grade !== "pii");
    }
    if (fields.length === 0) return empty;

    const topGrade: FieldGrade = fields.some((f) => f.grade === "credential")
        ? "credential"
        : fields.some((f) => f.grade === "internal")
          ? "internal"
          : "pii";

    return { fields, topGrade };
}

/** Optional LLM veto for borderline PII. May only REJECT, never raise. */
export type ExposureJudge = (input: {
    method: string;
    path: string;
    fields: string[];
    bodySnippet: string;
}) => Promise<{ isSensitive: boolean; reason?: string } | null>;

export type ExposureFinding = FindingDetail;

/**
 * Build the finding for an analyzed response. `bodySnippet` MUST already be
 * T3-redacted by the caller — evidence names the exposed FIELDS and shows the
 * redacted shape, never a raw secret value.
 */
export async function decideExposureVerdict(
    input: {
        method: string;
        path: string;
        statusCode: number;
        /** ALREADY-REDACTED response snippet. */
        bodySnippet: string;
    },
    analysis: ExposureAnalysis,
    judge?: ExposureJudge,
): Promise<ExposureFinding | null> {
    if (analysis.fields.length === 0 || analysis.topGrade == null) return null;

    // Borderline PII-only findings may be vetoed by the judge.
    if (analysis.topGrade === "pii" && judge) {
        let judged: { isSensitive: boolean; reason?: string } | null = null;
        try {
            judged = await judge({
                method: input.method,
                path: input.path,
                fields: analysis.fields.map((f) => f.field),
                bodySnippet: input.bodySnippet,
            });
        } catch {
            judged = null; // never crash or block on the LLM
        }
        if (judged && judged.isSensitive === false) return null;
    }

    const names = analysis.fields.map((f) => f.field);
    const severity: SeverityLevel = analysis.topGrade === "credential" ? "CRITICAL" : "HIGH";
    const endpoint = `${input.method.toUpperCase()} ${input.path}`;

    return {
        severity,
        category: "Excessive Data Exposure",
        title: `Response exposes sensitive field${names.length > 1 ? "s" : ""}: ${names
            .slice(0, 4)
            .join(", ")}`,
        cause: `The response exposes sensitive field(s) ${names.join(
            ", ",
        )} that should not be returned to clients. ${endpoint} returned ${
            input.statusCode
        } with these properties present in the payload, so every caller of this endpoint receives them.`,
        evidence: [
            `${endpoint} → ${input.statusCode}`,
            `exposed fields: ${names.join(", ")}`,
            `redacted body shape: ${input.bodySnippet.slice(0, 400)}`,
        ].join("\n"),
        remediation:
            "Return an explicit response DTO containing only the properties the client needs, rather " +
            "than serializing the whole database model. Strip credential material (hashes, tokens, " +
            "salts), internal flags, and PII the caller isn't entitled to, and add a test that asserts " +
            "the response shape so new model columns can't leak automatically.",
        confidence: "firm",
        owaspCategory: "API3_BROKEN_OBJECT_PROPERTY_LEVEL_AUTHORIZATION",
    };
}

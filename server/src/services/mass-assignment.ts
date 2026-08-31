// =============================================================================
// Mass assignment (T14b, OWASP API3) — pure helpers for the probe + its verdict.
//
// Mass assignment = a client can set object properties it shouldn't by adding
// extra fields to a write request (e.g. "role":"admin"). We build a VALID body
// from the endpoint's requestBodySchema, ADD a curated set of privileged fields
// with recognizable probe values, and fire it as the run's PRIMARY identity.
//
// CONFIRMED only when the write SUCCEEDS (2xx) and the response REFLECTS one of
// the injected privileged fields WITH OUR EXACT PROBE VALUE — i.e. the server
// accepted a property the client should never control. A 4xx (rejected), or a
// 2xx where the field is ignored, is SAFE and produces nothing.
//
// v1 signal is response REFLECTION. A follow-up GET to prove persistence is a
// future refinement (noted in the ticket summary) — reflection alone already
// requires the server to have bound the field into the object it echoes back.
// =============================================================================

import type { FindingDetail, Confidence } from "./finding-analysis.js";

/** Recognizable probe values — distinctive enough that a reflection is ours. */
export const PROBE_STRING = "onyx_admin_probe";
export const PROBE_NUMBER = 999999;

/**
 * Curated privileged fields — properties that grant privilege, ownership, or
 * monetary value if a client can set them. Deliberately TIGHT: every entry here
 * is a field whose client-controllability is a real finding. Anything broader
 * (name, description, tags…) is normal client input and must never be flagged.
 */
export const PRIVILEGED_FIELDS: Record<string, unknown> = {
    // Privilege / authorization
    role: PROBE_STRING,
    roles: [PROBE_STRING],
    isAdmin: true,
    is_admin: true,
    admin: true,
    permissions: [PROBE_STRING],
    scope: PROBE_STRING,
    scopes: [PROBE_STRING],
    // Account state that gates access
    isVerified: true,
    verified: true,
    isActive: true,
    // Commercial value
    plan: PROBE_STRING,
    isPremium: true,
    balance: PROBE_NUMBER,
    credit: PROBE_NUMBER,
    price: PROBE_NUMBER,
    // Ownership / tenancy — setting these reassigns the object
    ownerId: PROBE_STRING,
    userId: PROBE_STRING,
    accountId: PROBE_STRING,
    createdBy: PROBE_STRING,
};

export const PRIVILEGED_FIELD_NAMES = Object.keys(PRIVILEGED_FIELDS);

/** Methods that carry a body and can create/modify an object. */
const WRITE_METHODS = new Set(["POST", "PUT", "PATCH"]);

export interface MassAssignmentCandidate {
    method: string;
    requestBodySchema?: Record<string, unknown> | null;
}

/**
 * A candidate endpoint = a WRITE with an object-shaped JSON body schema. Without
 * a body schema we can't build a valid base body, so we'd be guessing.
 */
export function isMassAssignmentCandidate(ep: MassAssignmentCandidate): boolean {
    if (!WRITE_METHODS.has((ep.method || "").toUpperCase())) return false;
    const s = ep.requestBodySchema;
    return !!s && s.type === "object" && !!s.properties;
}

/** Schema-shaped dummy value, mirroring the request-builder's benign dummies. */
function dummyFor(propSchema: Record<string, unknown> | undefined): unknown {
    const type = propSchema?.type;
    if (type === "integer" || type === "number") return 1;
    if (type === "boolean") return true;
    if (type === "array") return [];
    if (type === "object") return {};
    return "test";
}

/**
 * Build the probe body: a VALID schema-shaped body PLUS the privileged fields.
 * Fields already declared by the schema are NOT injected — a property the API
 * openly accepts isn't mass assignment, and overwriting it would be a false
 * positive. Returns the JSON string and which fields were actually injected.
 */
export function buildMassAssignmentBody(
    schema: Record<string, unknown> | null | undefined,
): { body: string; injected: string[] } {
    const obj: Record<string, unknown> = {};
    const declared = new Set<string>();

    if (schema && schema.type === "object" && schema.properties) {
        const props = schema.properties as Record<string, Record<string, unknown>>;
        for (const [key, propSchema] of Object.entries(props)) {
            obj[key] = dummyFor(propSchema);
            declared.add(key);
        }
    }

    const injected: string[] = [];
    for (const [field, value] of Object.entries(PRIVILEGED_FIELDS)) {
        if (declared.has(field)) continue; // declared by the spec → not an injection
        obj[field] = value;
        injected.push(field);
    }

    return { body: JSON.stringify(obj), injected };
}

// ---------------------------------------------------------------------------
// Verdict
// ---------------------------------------------------------------------------

export interface MassAssignmentVerdictInput {
    method: string;
    path: string;
    statusCode: number;
    /** The response body (already redacted). */
    responseSnippet: string;
    /** The request body we sent (for evidence). */
    requestBody: string;
    /** Which privileged fields we injected. */
    injectedFields: string[];
}

/** Optional LLM veto — may only REJECT a candidate, never raise one. */
export type MassAssignmentJudge = (
    input: MassAssignmentVerdictInput & { reflectedField: string },
) => Promise<{ isSensitive: boolean; reason?: string } | null>;

const isSuccess = (s: number) => s >= 200 && s < 300;

/**
 * Find an injected privileged field that the response reflects WITH OUR PROBE
 * VALUE. Matching on the value (not just the key) is what makes this safe: an
 * API that merely *mentions* "role" in an error string is not a finding.
 */
export function findReflectedField(
    responseSnippet: string,
    injectedFields: string[],
): string | null {
    if (!responseSnippet) return null;

    // Prefer a structural match on parsed JSON — most precise.
    try {
        const parsed = JSON.parse(responseSnippet) as unknown;
        const roots: unknown[] = Array.isArray(parsed) ? parsed : [parsed];
        for (const root of roots) {
            const found = findInObject(root, injectedFields);
            if (found) return found;
        }
    } catch {
        // Non-JSON response — fall through to the textual check below.
    }

    // Textual fallback: the field name AND our probe value must both appear.
    for (const field of injectedFields) {
        const expected = PRIVILEGED_FIELDS[field];
        const needle =
            typeof expected === "string"
                ? expected
                : Array.isArray(expected)
                  ? String(expected[0])
                  : String(expected);
        if (responseSnippet.includes(field) && responseSnippet.includes(needle)) {
            return field;
        }
    }
    return null;
}

/** Recursively look for an injected field carrying our probe value. */
function findInObject(node: unknown, injectedFields: string[], depth = 0): string | null {
    if (depth > 5 || node == null || typeof node !== "object") return null;
    const obj = node as Record<string, unknown>;

    for (const field of injectedFields) {
        if (!(field in obj)) continue;
        if (valueMatchesProbe(obj[field], PRIVILEGED_FIELDS[field])) return field;
    }
    for (const v of Object.values(obj)) {
        const found = findInObject(v, injectedFields, depth + 1);
        if (found) return found;
    }
    return null;
}

/** Does the reflected value equal the probe value we sent? */
function valueMatchesProbe(actual: unknown, expected: unknown): boolean {
    if (Array.isArray(expected)) {
        return Array.isArray(actual) && actual.some((a) => a === expected[0]);
    }
    return actual === expected;
}

export type MassAssignmentFinding = FindingDetail;

function truncate(s: string, n: number): string {
    return s.length > n ? s.slice(0, n) + "…" : s;
}

/**
 * Decide the mass-assignment verdict. Returns null when SAFE (no finding).
 */
export async function decideMassAssignmentVerdict(
    input: MassAssignmentVerdictInput,
    judge?: MassAssignmentJudge,
): Promise<MassAssignmentFinding | null> {
    // 1) The write must have SUCCEEDED — a 4xx means input validation worked.
    if (!isSuccess(input.statusCode)) return null;
    if (input.injectedFields.length === 0) return null;

    // 2) A privileged field must be reflected back WITH our probe value.
    const reflectedField = findReflectedField(input.responseSnippet, input.injectedFields);
    if (!reflectedField) return null; // server ignored it → safe

    // 3) Optional LLM veto for borderline "is this field actually sensitive".
    let judged: { isSensitive: boolean; reason?: string } | null = null;
    if (judge) {
        try {
            judged = await judge({ ...input, reflectedField });
        } catch {
            judged = null; // never crash or block on the LLM
        }
    }
    if (judged && judged.isSensitive === false) return null;

    const endpoint = `${input.method.toUpperCase()} ${input.path}`;
    const confidence: Confidence = judged?.isSensitive ? "confirmed" : "firm";

    return {
        severity: "HIGH",
        category: "Mass Assignment",
        title: `Client-settable privileged field "${reflectedField}"`,
        cause:
            `The endpoint accepted and reflected the client-supplied privileged field ` +
            `"${reflectedField}", which should not be settable by clients. We sent ${endpoint} ` +
            `with "${reflectedField}" added to an otherwise valid body, the write returned ` +
            `${input.statusCode}, and the response echoed our value back — so the server bound ` +
            `an unvetted client property onto the object.` +
            (judged?.reason ? ` Analysis: ${judged.reason}` : ""),
        evidence: [
            `request  → ${endpoint}`,
            `  ${truncate(input.requestBody, 400)}`,
            `response ← ${input.statusCode} (reflects "${reflectedField}")`,
            `  ${truncate(input.responseSnippet, 400)}`,
            `injected fields: ${input.injectedFields.join(", ")}`,
        ].join("\n"),
        remediation:
            "Never bind request bodies straight onto your models. Use an explicit allow-list " +
            "(a DTO / schema with only client-writable properties) and drop everything else, " +
            "rather than a deny-list. Set privilege, ownership, and billing fields server-side " +
            "only, and assert them against the authenticated caller.",
        confidence,
        owaspCategory: "API3_BROKEN_OBJECT_PROPERTY_LEVEL_AUTHORIZATION",
    };
}

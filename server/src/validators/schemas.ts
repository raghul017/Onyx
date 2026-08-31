// =============================================================================
// Zod Validation Schemas
// =============================================================================

import { z } from "zod";

// ---------------------------------------------------------------------------
// REST API Requests
// ---------------------------------------------------------------------------

/** One identity a run can attack as (T12). authRecipeId omitted = anonymous. */
export const runIdentityInputSchema = z.object({
    label: z.string().trim().min(1, "label is required").max(40, "label too long"),
    authRecipeId: z.string().uuid("authRecipeId must be a UUID").optional(),
    /** Marks the primary identity; if none flagged, the first is primary. */
    isPrimary: z.boolean().optional(),
});

export type RunIdentityInput = z.infer<typeof runIdentityInputSchema>;

/** Max identities per run (primary + secondaries) — bounds T13's replay fan-out. */
export const MAX_RUN_IDENTITIES = 4;

export const createTestRunSchema = z.object({
    specUrl: z
        .string()
        .url("Must be a valid URL")
        .refine(
            (url) => url.startsWith("http://") || url.startsWith("https://"),
            "URL must use http:// or https:// protocol",
        ),
    // Optional static credential to attach to every request in this run (T7a).
    // Backward-compatible: when `identities` is omitted, this becomes the run's
    // single PRIMARY identity (or anonymous if also omitted).
    authRecipeId: z.string().uuid("authRecipeId must be a UUID").optional(),
    // T12: optionally define 2+ identities (a primary + secondaries). The scan
    // still runs under the primary only; secondaries are stored + resolvable for
    // T13's cross-identity replays. Unique labels; at most MAX_RUN_IDENTITIES.
    identities: z
        .array(runIdentityInputSchema)
        .min(1, "identities must not be empty when provided")
        .max(MAX_RUN_IDENTITIES, `at most ${MAX_RUN_IDENTITIES} identities per run`)
        .refine(
            (ids) => new Set(ids.map((i) => i.label.trim())).size === ids.length,
            "identity labels must be unique",
        )
        .refine(
            (ids) => ids.filter((i) => i.isPrimary).length <= 1,
            "at most one identity may be marked primary",
        )
        .optional(),
});

export type CreateTestRunInput = z.infer<typeof createTestRunSchema>;

export const authSchema = z.object({
    email: z.string().email("Invalid email format").min(1, "Email is required"),
    password: z.string().min(8, "Password must be at least 8 characters long"),
});

export type AuthInput = z.infer<typeof authSchema>;

// ---------------------------------------------------------------------------
// AI Payload Response Validation
// ---------------------------------------------------------------------------

const attackTypeEnum = z.enum([
    "SQL_INJECTION",
    "XSS",
    "BOUNDARY",
    "MISSING_AUTH",
    "PATH_TRAVERSAL",
    "OVERSIZED_PAYLOAD",
    "TYPE_CONFUSION",
    "RATE_LIMIT",
    // Cross-identity probes (T13a/T14a). These ride the "replay" job kind and
    // carry no attack payload; they were previously missing from this enum, so
    // every replay job failed validation in the worker and was dropped.
    "BOLA_REPLAY",
    "BFLA_PROBE",
    "UNKNOWN",
]);

const generatedPayloadSchema = z.object({
    payload: z.union([z.string(), z.record(z.unknown())]),
    attackType: attackTypeEnum,
    description: z.string().optional(),
});

export const aiPayloadArraySchema = z
    .array(generatedPayloadSchema)
    .min(1)
    .max(25);

export type GeneratedPayload = z.infer<typeof generatedPayloadSchema>;

// ---------------------------------------------------------------------------
// WebSocket Client Messages
// ---------------------------------------------------------------------------

export const wsClientMessageSchema = z.discriminatedUnion("type", [
    z.object({
        type: z.literal("SUBSCRIBE"),
        testRunId: z.string().uuid(),
    }),
    z.object({
        type: z.literal("UNSUBSCRIBE"),
        testRunId: z.string().uuid(),
    }),
]);

// ---------------------------------------------------------------------------
// Job Data Validation
// ---------------------------------------------------------------------------

/** A single OpenAPI parameter definition carried on the job so the worker's
 *  request-builder knows where the payload can be injected (path/query/header). */
export const parsedParameterSchema = z.object({
    name: z.string(),
    in: z.enum(["query", "header", "path", "cookie"]),
    required: z.boolean().default(false),
    schema: z.record(z.unknown()).nullable().default(null),
});

export type ParsedParameterInput = z.infer<typeof parsedParameterSchema>;

export const attackJobDataSchema = z.object({
    testRunId: z.string().uuid(),
    endpointId: z.string().uuid(),
    method: z.enum(["GET", "POST", "PUT", "DELETE", "PATCH"]),
    path: z.string(),
    baseUrl: z.string().url(),
    payload: z.string(),
    attackType: attackTypeEnum,
    // Optional + defaulted so jobs enqueued before T4 (no params on them) still
    // validate and behave like a bare request (path resolved, no param injection).
    parameters: z.array(parsedParameterSchema).optional().default([]),
    requestBodySchema: z.record(z.unknown()).nullable().optional().default(null),
    // Job kind (T5/T13a). "attack" fires a payload; "baseline" fires ONE benign
    // control request and stores a BaselineResponse; "replay" (T13a) re-requests
    // a detail endpoint with identity A's object id while attached to identity B
    // (BOLA machinery). Defaults to "attack" so all pre-T5 jobs keep behavior.
    kind: z.enum(["attack", "baseline", "replay"]).optional().default("attack"),
    // ── Replay-only fields (T13a) — present only when kind === "replay". ──
    /** The object id acquired AS identity A, injected into the detail path. */
    objectId: z.string().optional(),
    /** Identity A — whose object id this is (the resource owner). */
    sourceIdentityId: z.string().uuid().optional(),
    /** Identity B — who we replay AS (the potential cross-tenant accessor). */
    targetIdentityId: z.string().uuid().optional(),
    /** The path param name that carries the object id (e.g. "id", "userId"). */
    idParamName: z.string().optional(),
    /**
     * Which cross-identity check this replay performs (T14a). "bola" re-requests
     * A's object id AS B (needs objectId/idParamName); "bfla" calls a PRIVILEGED
     * endpoint AS B to see whether a lower-privileged identity is wrongly allowed
     * (needs no objectId). Defaults to "bola" so every T13a job keeps behaving
     * exactly as before. Reusing the "replay" kind means the existing replay
     * counters + completion gate cover BFLA with no schema change.
     */
    checkType: z.enum(["bola", "bfla"]).optional().default("bola"),
    /** BFLA-only: why the endpoint was flagged privileged (for the finding). */
    privilegedReason: z.string().optional(),
});

export type AttackJobData = z.infer<typeof attackJobDataSchema>;

// ---------------------------------------------------------------------------
// Domain Verification
// ---------------------------------------------------------------------------

export const initiateVerificationSchema = z.object({
    specUrl: z
        .string()
        .url("Must be a valid URL")
        .refine(
            (url) => url.startsWith("http://") || url.startsWith("https://"),
            "URL must use http:// or https:// protocol",
        ),
});

export const checkVerificationSchema = z.object({
    domain: z.string().min(1, "Domain is required"),
});

// ---------------------------------------------------------------------------
// Billing
// ---------------------------------------------------------------------------

export const subscribeSchema = z.object({
    planId: z.string().min(1, "planId is required").max(200),
});

export const verifySubscriptionSchema = z.object({
    subscriptionId: z.string().min(1, "subscriptionId is required").max(200),
});

// ---------------------------------------------------------------------------
// Organizations
// ---------------------------------------------------------------------------

const orgRoleEnum = z.enum(["OWNER", "ADMIN", "VIEWER"]);

export const createOrgSchema = z.object({
    name: z.string().trim().min(2, "Name must be at least 2 characters").max(60),
});

export const updateOrgSchema = z.object({
    name: z.string().trim().min(2, "Name must be at least 2 characters").max(60),
});

export const createInviteSchema = z.object({
    email: z.string().email("Invalid email format").max(254),
    role: orgRoleEnum.default("VIEWER"),
});

export const updateMemberRoleSchema = z.object({
    role: orgRoleEnum,
});

export const acceptInviteSchema = z.object({
    token: z.string().min(1, "token is required"),
});

// ---------------------------------------------------------------------------
// User Profile
// ---------------------------------------------------------------------------

export const updateUserSchema = z.object({
    name: z
        .string()
        .trim()
        .min(1, "Name cannot be empty")
        .max(80, "Name must be 80 characters or fewer")
        .optional(),
});

export type UpdateUserInput = z.infer<typeof updateUserSchema>;

// ---------------------------------------------------------------------------
// Auth Recipes (T7a) — static credentials attached to a scan run.
// ---------------------------------------------------------------------------

// Static (T7a) + dynamic (T8a) credential types.
export const authRecipeTypeEnum = z.enum([
    "bearer",
    "apiKey",
    "header",
    "cookie",
    "loginRequest",
    "oauth2ClientCredentials",
]);

/** NON-secret descriptors only — never a secret value. Covers static (T7a) AND
 *  dynamic (T8a) config. Secret fields live in `secret`, encrypted separately. */
export const authRecipeMetaSchema = z
    .object({
        // Static
        headerName: z.string().trim().min(1).max(120).optional(),
        queryName: z.string().trim().min(1).max(120).optional(),
        location: z.enum(["header", "query"]).optional(),
        cookieName: z.string().trim().min(1).max(120).optional(),
        // oauth2ClientCredentials (clientSecret is a SECRET → goes in `secret`)
        tokenUrl: z.string().url().max(2000).optional(),
        clientId: z.string().min(1).max(500).optional(),
        scope: z.string().max(1000).optional(),
        tokenResponseField: z.string().min(1).max(200).optional(),
        // loginRequest
        method: z.enum(["GET", "POST", "PUT", "PATCH"]).optional(),
        url: z.string().url().max(2000).optional(),
        headers: z.record(z.string().max(2000)).optional(), // non-secret headers only
        bodyTemplate: z.string().max(8192).optional(), // JSON with {{placeholders}}
        tokenPath: z.string().min(1).max(500).optional(), // dot-path OR /regex/
        // shared: "bearer" | "header:<Name>"
        injectAs: z.string().min(1).max(200).optional(),
    })
    .strict();

/** Secret is a string for STATIC types, or an object of fields for DYNAMIC ones
 *  (e.g. { clientSecret } for oauth2, or {{placeholder}} values for loginRequest). */
const secretSchema = z.union([
    z.string().min(1).max(8192),
    z.record(z.string().max(8192)),
]);

const DYNAMIC_TYPES = new Set(["loginRequest", "oauth2ClientCredentials"]);

/** Enforce the meta + secret shape each credential type needs. */
function requireMetaForType(
    data: {
        type: z.infer<typeof authRecipeTypeEnum>;
        meta?: z.infer<typeof authRecipeMetaSchema>;
        secret?: z.infer<typeof secretSchema>;
    },
    ctx: z.RefinementCtx,
): void {
    const meta = data.meta ?? {};
    const type = data.type;
    const isDynamic = DYNAMIC_TYPES.has(type);
    const secretIsObject = data.secret != null && typeof data.secret === "object";
    const need = (path: (string | number)[], message: string) =>
        ctx.addIssue({ code: "custom", message, path });

    // Static types require a STRING secret.
    if (!isDynamic && data.secret != null && typeof data.secret !== "string") {
        need(["secret"], `${type} credential requires a string secret`);
    }
    if (type === "header" && !meta.headerName) need(["meta", "headerName"], "header credential requires meta.headerName");
    if (type === "cookie" && !meta.cookieName) need(["meta", "cookieName"], "cookie credential requires meta.cookieName");
    if (type === "apiKey") {
        const loc = meta.location ?? "header";
        if (loc === "header" && !meta.headerName) need(["meta", "headerName"], "apiKey (header) requires meta.headerName");
        if (loc === "query" && !meta.queryName) need(["meta", "queryName"], "apiKey (query) requires meta.queryName");
    }

    // Dynamic types require an OBJECT secret + specific meta.
    if (type === "oauth2ClientCredentials") {
        if (!meta.tokenUrl) need(["meta", "tokenUrl"], "oauth2 requires meta.tokenUrl");
        if (!meta.clientId) need(["meta", "clientId"], "oauth2 requires meta.clientId");
        if (!secretIsObject || !(data.secret as Record<string, string>)?.clientSecret) {
            need(["secret"], "oauth2 requires secret.clientSecret");
        }
    }
    if (type === "loginRequest") {
        if (!meta.url) need(["meta", "url"], "loginRequest requires meta.url");
        if (!meta.method) need(["meta", "method"], "loginRequest requires meta.method");
        if (!meta.bodyTemplate) need(["meta", "bodyTemplate"], "loginRequest requires meta.bodyTemplate");
        if (!meta.tokenPath) need(["meta", "tokenPath"], "loginRequest requires meta.tokenPath");
        if (!meta.injectAs) need(["meta", "injectAs"], "loginRequest requires meta.injectAs");
        if (!secretIsObject || Object.keys((data.secret as Record<string, string>) ?? {}).length === 0) {
            need(["secret"], "loginRequest requires a non-empty secret object");
        }
    }
}

export const createAuthRecipeSchema = z
    .object({
        name: z.string().trim().min(1, "name is required").max(80),
        type: authRecipeTypeEnum,
        secret: secretSchema,
        meta: authRecipeMetaSchema.optional().default({}),
    })
    .superRefine(requireMetaForType);

export const updateAuthRecipeSchema = z
    .object({
        name: z.string().trim().min(1).max(80).optional(),
        secret: secretSchema.optional(),
        meta: authRecipeMetaSchema.optional(),
    })
    .refine(
        (d) => d.name !== undefined || d.secret !== undefined || d.meta !== undefined,
        "At least one of name, secret, or meta must be provided",
    );

export type CreateAuthRecipeInput = z.infer<typeof createAuthRecipeSchema>;
export type UpdateAuthRecipeInput = z.infer<typeof updateAuthRecipeSchema>;
export type AuthRecipeMetaInput = z.infer<typeof authRecipeMetaSchema>;
export type AuthRecipeSecretInput = z.infer<typeof secretSchema>;

// ---------------------------------------------------------------------------
// API Tokens (T10a) — long-lived credentials for non-interactive REST access.
// ---------------------------------------------------------------------------

export const createApiTokenSchema = z.object({
    name: z.string().trim().min(1, "name is required").max(80),
});

export type CreateApiTokenInput = z.infer<typeof createApiTokenSchema>;

// ---------------------------------------------------------------------------
// OWASP API Security Top 10 (2023) — category codes (T9)
// ---------------------------------------------------------------------------

export const owaspApiCategoryEnum = z.enum([
    "API1_BOLA",
    "API2_BROKEN_AUTHENTICATION",
    "API3_BROKEN_OBJECT_PROPERTY_LEVEL_AUTHORIZATION",
    "API4_UNRESTRICTED_RESOURCE_CONSUMPTION",
    "API5_BFLA",
    "API6_UNRESTRICTED_ACCESS_TO_SENSITIVE_BUSINESS_FLOWS",
    "API7_SSRF",
    "API8_SECURITY_MISCONFIGURATION",
    "API9_IMPROPER_INVENTORY_MANAGEMENT",
    "API10_UNSAFE_CONSUMPTION_OF_APIS",
]);

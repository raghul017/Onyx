// =============================================================================
// Zod Validation Schemas
// =============================================================================

import { z } from "zod";

// ---------------------------------------------------------------------------
// REST API Requests
// ---------------------------------------------------------------------------

export const createTestRunSchema = z.object({
    specUrl: z
        .string()
        .url("Must be a valid URL")
        .refine(
            (url) => url.startsWith("http://") || url.startsWith("https://"),
            "URL must use http:// or https:// protocol",
        ),
    // Optional static credential to attach to every request in this run (T7a).
    authRecipeId: z.string().uuid("authRecipeId must be a UUID").optional(),
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
    // Job kind (T5). "attack" fires a payload; "baseline" fires ONE benign
    // control request and stores a BaselineResponse. Defaults to "attack" so all
    // pre-T5 jobs (which have no `kind`) keep their exact behavior.
    kind: z.enum(["attack", "baseline"]).optional().default("attack"),
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

export const authRecipeTypeEnum = z.enum(["bearer", "apiKey", "header", "cookie"]);

/** NON-secret descriptors only — never the secret value. */
export const authRecipeMetaSchema = z
    .object({
        headerName: z.string().trim().min(1).max(120).optional(),
        queryName: z.string().trim().min(1).max(120).optional(),
        location: z.enum(["header", "query"]).optional(),
        cookieName: z.string().trim().min(1).max(120).optional(),
    })
    .strict();

/** Enforce the meta a given credential type needs (e.g. header type needs a name). */
function requireMetaForType(
    data: { type: z.infer<typeof authRecipeTypeEnum>; meta?: z.infer<typeof authRecipeMetaSchema> },
    ctx: z.RefinementCtx,
): void {
    const meta = data.meta ?? {};
    if (data.type === "header" && !meta.headerName) {
        ctx.addIssue({ code: "custom", message: "header credential requires meta.headerName", path: ["meta", "headerName"] });
    }
    if (data.type === "cookie" && !meta.cookieName) {
        ctx.addIssue({ code: "custom", message: "cookie credential requires meta.cookieName", path: ["meta", "cookieName"] });
    }
    if (data.type === "apiKey") {
        const loc = meta.location ?? "header";
        if (loc === "header" && !meta.headerName) {
            ctx.addIssue({ code: "custom", message: "apiKey (header) requires meta.headerName", path: ["meta", "headerName"] });
        }
        if (loc === "query" && !meta.queryName) {
            ctx.addIssue({ code: "custom", message: "apiKey (query) requires meta.queryName", path: ["meta", "queryName"] });
        }
    }
}

export const createAuthRecipeSchema = z
    .object({
        name: z.string().trim().min(1, "name is required").max(80),
        type: authRecipeTypeEnum,
        secret: z.string().min(1, "secret is required").max(8192),
        meta: authRecipeMetaSchema.optional().default({}),
    })
    .superRefine(requireMetaForType);

export const updateAuthRecipeSchema = z
    .object({
        name: z.string().trim().min(1).max(80).optional(),
        secret: z.string().min(1).max(8192).optional(),
        meta: authRecipeMetaSchema.optional(),
    })
    .refine(
        (d) => d.name !== undefined || d.secret !== undefined || d.meta !== undefined,
        "At least one of name, secret, or meta must be provided",
    );

export type CreateAuthRecipeInput = z.infer<typeof createAuthRecipeSchema>;
export type UpdateAuthRecipeInput = z.infer<typeof updateAuthRecipeSchema>;
export type AuthRecipeMetaInput = z.infer<typeof authRecipeMetaSchema>;

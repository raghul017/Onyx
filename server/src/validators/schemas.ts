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

export const attackJobDataSchema = z.object({
    testRunId: z.string().uuid(),
    endpointId: z.string().uuid(),
    method: z.enum(["GET", "POST", "PUT", "DELETE", "PATCH"]),
    path: z.string(),
    baseUrl: z.string().url(),
    payload: z.string(),
    attackType: attackTypeEnum,
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

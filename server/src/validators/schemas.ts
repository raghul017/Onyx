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
    .max(100);

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

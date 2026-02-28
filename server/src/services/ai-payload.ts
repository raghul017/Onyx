// =============================================================================
// AI Payload Generation Service — Gemini Integration
// =============================================================================

import { GoogleGenAI } from "@google/genai";
import type { ParsedEndpoint } from "./openapi-parser.js";
import {
    aiPayloadArraySchema,
    type GeneratedPayload,
} from "../validators/schemas.js";

// ---------------------------------------------------------------------------
// Gemini Client
// ---------------------------------------------------------------------------

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

let ai: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI | null {
    if (!GEMINI_API_KEY || GEMINI_API_KEY === "your-gemini-api-key-here") {
        return null;
    }
    if (!ai) {
        ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    }
    return ai;
}

// ---------------------------------------------------------------------------
// LLM Response Generator
// ---------------------------------------------------------------------------

/**
 * Sends a prompt to Gemini 2.5 Flash and returns the raw text response.
 * Falls back to returning fallback payloads if no API key is configured.
 */
export async function generateAIResponse(prompt: string): Promise<string> {
    const client = getGeminiClient();

    if (!client) {
        console.log(
            "[AI] No GEMINI_API_KEY configured — using fallback payloads",
        );
        return JSON.stringify(FALLBACK_PAYLOADS);
    }

    try {
        console.log(
            `[AI] Sending prompt to Gemini 2.5 Flash (${prompt.length} chars)...`,
        );

        const response = await client.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                temperature: 0.8,
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

        // Fall back gracefully on any API error
        return JSON.stringify(FALLBACK_PAYLOADS);
    }
}

// ---------------------------------------------------------------------------
// Prompt Builder
// ---------------------------------------------------------------------------

/**
 * Constructs a detailed prompt that instructs the LLM to generate
 * malicious payloads tailored to a specific API endpoint.
 */
export function buildPayloadPrompt(endpoint: ParsedEndpoint): string {
    const schemaBlock = endpoint.requestBodySchema
        ? `\nThe endpoint accepts a JSON request body with this schema:\n\`\`\`json\n${JSON.stringify(endpoint.requestBodySchema, null, 2)}\n\`\`\``
        : "\nThis endpoint does not have a documented request body.";

    const paramBlock =
        endpoint.parameters.length > 0
            ? `\nThe endpoint accepts these parameters:\n${endpoint.parameters
                  .map(
                      (p) =>
                          `- "${p.name}" (in: ${p.in}, required: ${p.required}${p.schema ? `, type: ${JSON.stringify(p.schema)}` : ""})`,
                  )
                  .join("\n")}`
            : "";

    return `You are an expert API security tester and penetration testing specialist.

Your task is to generate exactly 50 malicious test payloads for the following API endpoint:

**Endpoint:** ${endpoint.method} ${endpoint.path}
**Operation ID:** ${endpoint.operationId ?? "N/A"}
${schemaBlock}
${paramBlock}

Generate payloads spanning these attack categories:
1. **SQL Injection** — Classic SQLi, blind SQLi, UNION-based, time-based
2. **XSS (Cross-Site Scripting)** — Reflected XSS, stored XSS, DOM-based
3. **Boundary Testing** — Integer overflow, empty strings, extremely long strings, null bytes, special unicode
4. **Missing Auth / Privilege Escalation** — Missing auth headers, forged roles, IDOR attempts
5. **Path Traversal** — Directory traversal, file inclusion
6. **Oversized Payloads** — Payloads exceeding normal limits, deeply nested JSON, array bombs
7. **Type Confusion** — Wrong types for fields (string where int expected, arrays where objects expected)
8. **Rate Limit Testing** — Rapid repeated requests simulation markers

**CRITICAL INSTRUCTIONS:**
- Return ONLY a valid JSON array, no markdown, no explanations.
- Each element must be an object with exactly these fields:
  - "payload": The malicious payload as a string (or JSON object for request bodies).
  - "attackType": One of: "SQL_INJECTION", "XSS", "BOUNDARY", "MISSING_AUTH", "PATH_TRAVERSAL", "OVERSIZED_PAYLOAD", "TYPE_CONFUSION", "RATE_LIMIT"
  - "description": A brief description of what this payload tests.
- If the endpoint has a request body schema, the payload MUST conform to the schema structure but with malicious values.
- If the endpoint has no request body, provide payloads as query parameter strings or header values.
- Ensure diversity: at least 5 payloads per attack category where applicable.

Example format:
[
  {
    "payload": "' OR 1=1; DROP TABLE users; --",
    "attackType": "SQL_INJECTION",
    "description": "Classic SQL injection with table drop"
  }
]

Generate the 50 payloads now:`;
}

// ---------------------------------------------------------------------------
// Payload Generator
// ---------------------------------------------------------------------------

/**
 * Generates malicious payloads for a given parsed endpoint using Gemini.
 * Falls back to a default set if the LLM response is invalid.
 */
export async function generatePayloadsForEndpoint(
    endpoint: ParsedEndpoint,
): Promise<GeneratedPayload[]> {
    const prompt = buildPayloadPrompt(endpoint);

    try {
        const rawResponse = await generateAIResponse(prompt);

        // Try to extract JSON from the response (LLMs sometimes wrap in markdown)
        const jsonString = extractJson(rawResponse);
        const parsed = JSON.parse(jsonString);
        const validated = aiPayloadArraySchema.safeParse(parsed);

        if (validated.success) {
            console.log(
                `[AI] Generated ${validated.data.length} payloads for ${endpoint.method} ${endpoint.path}`,
            );
            return validated.data;
        }

        console.warn(
            `[AI] LLM response failed validation for ${endpoint.method} ${endpoint.path}:`,
            validated.error.issues.slice(0, 3),
        );
        return FALLBACK_PAYLOADS;
    } catch (err) {
        console.error(
            `[AI] Failed to generate payloads for ${endpoint.method} ${endpoint.path}:`,
            err instanceof Error ? err.message : err,
        );
        return FALLBACK_PAYLOADS;
    }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract JSON array from a response that might be wrapped in markdown fences. */
function extractJson(text: string): string {
    // Try to find JSON array in markdown code block
    const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (codeBlockMatch) {
        return codeBlockMatch[1]!.trim();
    }

    // Try to find raw JSON array
    const arrayMatch = text.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
        return arrayMatch[0];
    }

    return text.trim();
}

// ---------------------------------------------------------------------------
// Fallback Payloads (used when LLM is unavailable or returns invalid data)
// ---------------------------------------------------------------------------

const FALLBACK_PAYLOADS: GeneratedPayload[] = [
    // SQL Injection
    {
        payload: "' OR 1=1; --",
        attackType: "SQL_INJECTION",
        description: "Classic OR-based SQLi",
    },
    {
        payload: "'; DROP TABLE users; --",
        attackType: "SQL_INJECTION",
        description: "Table drop SQLi",
    },
    {
        payload: "' UNION SELECT NULL,NULL,NULL--",
        attackType: "SQL_INJECTION",
        description: "UNION-based SQLi",
    },
    {
        payload: "1' AND SLEEP(5)--",
        attackType: "SQL_INJECTION",
        description: "Time-based blind SQLi",
    },
    {
        payload: "admin'--",
        attackType: "SQL_INJECTION",
        description: "Auth bypass SQLi",
    },
    {
        payload: "1; EXEC xp_cmdshell('whoami')",
        attackType: "SQL_INJECTION",
        description: "Command execution SQLi",
    },
    {
        payload: "' OR '1'='1' /*",
        attackType: "SQL_INJECTION",
        description: "Comment-based SQLi",
    },

    // XSS
    {
        payload: "<script>alert('XSS')</script>",
        attackType: "XSS",
        description: "Basic reflected XSS",
    },
    {
        payload: "<img src=x onerror=alert(1)>",
        attackType: "XSS",
        description: "Image onerror XSS",
    },
    {
        payload: "javascript:alert(document.cookie)",
        attackType: "XSS",
        description: "JavaScript protocol XSS",
    },
    {
        payload: "<svg/onload=alert('XSS')>",
        attackType: "XSS",
        description: "SVG onload XSS",
    },
    {
        payload: "'\"><script>alert(1)</script>",
        attackType: "XSS",
        description: "Context-breaking XSS",
    },
    {
        payload: "<body onload=alert(1)>",
        attackType: "XSS",
        description: "Body onload XSS",
    },

    // Boundary Testing
    { payload: "", attackType: "BOUNDARY", description: "Empty string" },
    {
        payload: "a".repeat(100000),
        attackType: "BOUNDARY",
        description: "Very long string (100k chars)",
    },
    {
        payload: String.fromCharCode(0),
        attackType: "BOUNDARY",
        description: "Null byte",
    },
    { payload: "-1", attackType: "BOUNDARY", description: "Negative number" },
    {
        payload: "99999999999999999999",
        attackType: "BOUNDARY",
        description: "Integer overflow",
    },
    { payload: "NaN", attackType: "BOUNDARY", description: "NaN value" },
    {
        payload: "undefined",
        attackType: "BOUNDARY",
        description: "Undefined string",
    },

    // Missing Auth
    {
        payload: "[No Authorization Header]",
        attackType: "MISSING_AUTH",
        description: "Missing auth header",
    },
    {
        payload: '{"role":"admin","is_superuser":true}',
        attackType: "MISSING_AUTH",
        description: "Privilege escalation via role field",
    },
    {
        payload: "Bearer invalidtoken123",
        attackType: "MISSING_AUTH",
        description: "Invalid JWT token",
    },
    {
        payload: "Bearer eyJhbGciOiJub25lIn0.eyJyb2xlIjoiYWRtaW4ifQ.",
        attackType: "MISSING_AUTH",
        description: "None-algorithm JWT",
    },

    // Path Traversal
    {
        payload: "../../../etc/passwd",
        attackType: "PATH_TRAVERSAL",
        description: "Unix path traversal",
    },
    {
        payload: "..\\..\\..\\windows\\system32\\config\\sam",
        attackType: "PATH_TRAVERSAL",
        description: "Windows path traversal",
    },
    {
        payload: "%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd",
        attackType: "PATH_TRAVERSAL",
        description: "URL-encoded traversal",
    },
    {
        payload: "....//....//....//etc/passwd",
        attackType: "PATH_TRAVERSAL",
        description: "Double-dot bypass traversal",
    },

    // Oversized Payloads
    {
        payload: JSON.stringify({ data: Array(10000).fill("x") }),
        attackType: "OVERSIZED_PAYLOAD",
        description: "Large array payload",
    },
    {
        payload: JSON.stringify({
            a: { b: { c: { d: { e: { f: { g: "deep" } } } } } },
        }),
        attackType: "OVERSIZED_PAYLOAD",
        description: "Deeply nested object",
    },

    // Type Confusion
    {
        payload: '{"id":"not_a_number"}',
        attackType: "TYPE_CONFUSION",
        description: "String where int expected",
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
        description: "Null value",
    },

    // Rate Limit
    {
        payload: "[RATE_LIMIT_TEST]",
        attackType: "RATE_LIMIT",
        description: "Rate limit burst test marker",
    },
];

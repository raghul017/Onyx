// =============================================================================
// BOLA judge (T13b) — the Gemini interpretation step for a BOLA candidate.
// Reuses the same client + JSON-mode pattern as ai-payload.ts.
//
// It is asked ONE focused question: did user B receive user A's private object
// (rather than B's own data or a public resource)? It can only CONFIRM or VETO a
// candidate that the deterministic comparison already flagged — it never raises a
// finding on its own. Returns null when unavailable/unparseable so the caller
// falls back to the deterministic verdict.
//
// SAFETY: only redacted, size-capped response bodies are sent. No credentials,
// tokens, headers, or URLs with secrets ever reach the model.
// =============================================================================

import { GoogleGenAI } from "@google/genai";
import { logger } from "../lib/logger.js";
import { GEMINI_MODEL, GEMINI_THINKING_CONFIG } from "../lib/gemini.js";
import { MAX_BODY_CHARS, type BolaJudge, type BolaVerdictInput } from "./bola-verdict.js";

const log = logger.child({ component: "bola-judge" });

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

let ai: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI | null {
    if (!GEMINI_API_KEY || GEMINI_API_KEY === "your-gemini-api-key-here") {
        return null;
    }
    if (!ai) ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    return ai;
}

const SYSTEM_PROMPT = `You are an API security analyst judging a possible BOLA / IDOR (Broken Object Level Authorization) finding.

Two different authenticated users requested THE SAME object id on the same endpoint:
- User A is the owner of the object.
- User B is a DIFFERENT user who should NOT be able to read A's object.

Decide ONE thing: did user B receive user A's private object, rather than B's own data or a public/shared resource?

Answer "isBola": true ONLY if B's response clearly contains the SAME object A received (A's data).
Answer false if: B got its own different data, the resource is obviously public/non-sensitive (e.g. a static catalog item, health check, public listing), or the bodies represent different objects.

Be conservative — when genuinely unsure, answer false.

Respond ONLY with JSON: {"isBola": boolean, "reason": "one short sentence"}`;

function cap(s: string): string {
    return s.length > MAX_BODY_CHARS ? s.slice(0, MAX_BODY_CHARS) + "…" : s;
}

/**
 * The production judge. Returns null when Gemini isn't configured, errors, or
 * returns something unparseable — the caller then uses the deterministic verdict.
 */
export const geminiBolaJudge: BolaJudge = async (input: BolaVerdictInput) => {
    const client = getGeminiClient();
    if (!client) {
        log.info("No GEMINI_API_KEY configured — deterministic BOLA verdict only");
        return null;
    }

    const prompt = [
        `Endpoint: ${input.endpoint}`,
        `Object id: ${input.objectId}`,
        ``,
        `User A (${input.aLabel}) response — HTTP ${input.aStatus}:`,
        cap(input.aBody),
        ``,
        `User B (${input.bLabel}) response — HTTP ${input.bStatus}:`,
        cap(input.bBody),
    ].join("\n");

    try {
        const response = await client.models.generateContent({
            model: GEMINI_MODEL,
            contents: prompt,
            config: {
                systemInstruction: SYSTEM_PROMPT,
                thinkingConfig: GEMINI_THINKING_CONFIG,
                temperature: 0, // deterministic judgement
                maxOutputTokens: 256,
                responseMimeType: "application/json",
            },
        });

        const text = response.text ?? "";
        if (!text) return null;

        const parsed = JSON.parse(text) as { isBola?: unknown; reason?: unknown };
        if (typeof parsed.isBola !== "boolean") return null;

        return {
            isBola: parsed.isBola,
            reason: typeof parsed.reason === "string" ? parsed.reason : undefined,
        };
    } catch (err) {
        // Never crash or block the pipeline on the LLM.
        log.warn(
            { reason: err instanceof Error ? err.message : String(err) },
            "Gemini BOLA judge failed — deterministic fallback",
        );
        return null;
    }
};

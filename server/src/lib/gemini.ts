// =============================================================================
// Gemini model config — the single place the model id + thinking level live.
// Shared by ai-payload.ts (payload generation) and bola-judge.ts (BOLA verdict).
//
// Default: gemini-3.5-flash-lite — free tier, fast (~1-2s per call). Override
// with GEMINI_MODEL (e.g. gemini-3.8-flash) without a code change.
//
// Gemini 3.x thinks by default and thought tokens count against
// maxOutputTokens, so a small cap (the BOLA judge's 256) would be eaten by
// reasoning and come back truncated/empty. We pin the lowest level each model
// supports. 2.x models don't accept thinkingLevel, so they get no override.
// =============================================================================

import { ThinkingLevel, type ThinkingConfig } from "@google/genai";

export const GEMINI_MODEL = process.env.GEMINI_MODEL?.trim() || "gemini-3.5-flash-lite";

// 3.x models whose lowest supported level is LOW (no MINIMAL).
const NO_MINIMAL = ["gemini-3.8-flash", "gemini-3.1-pro", "gemini-3-pro"];

function thinkingConfigFor(model: string): ThinkingConfig | undefined {
    if (!model.startsWith("gemini-3")) return undefined;
    const level = NO_MINIMAL.some((m) => model.startsWith(m))
        ? ThinkingLevel.LOW
        : ThinkingLevel.MINIMAL;
    return { thinkingLevel: level };
}

export const GEMINI_THINKING_CONFIG = thinkingConfigFor(GEMINI_MODEL);

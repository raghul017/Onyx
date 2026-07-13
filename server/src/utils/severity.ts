// =============================================================================
// CVSS-inspired severity scoring for attack log results
// =============================================================================

import { analyzeFinding } from "../services/finding-analysis.js";

export type SeverityLevel = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";

export type ScoreLabel = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "CLEAN";

/**
 * Severity for a single result. Thin wrapper over analyzeFinding() so severity
 * is computed ONE way across the whole app (list, report, live stream). Callers
 * that also want the explanation (title/cause/evidence/remediation) should call
 * analyzeFinding directly. Reflection-based XSS detection needs the payload, so
 * paths that don't pass it (e.g. the run list) simply won't upgrade on that
 * single signal — every other signal still applies.
 */
export function getSeverity(
    attackType: string,
    statusCode: number,
    responseSnippet: string,
): SeverityLevel {
    return analyzeFinding({ attackType, statusCode, responseSnippet }).severity;
}

export interface ScoredLog {
    severity: SeverityLevel;
}

export function getOverallScore(logs: ScoredLog[]): number {
    if (logs.length === 0) return 100;

    const deductions = logs.reduce((acc, l) => {
        switch (l.severity) {
            case "CRITICAL": return acc + 25;
            case "HIGH":     return acc + 15;
            case "MEDIUM":   return acc + 8;
            case "LOW":      return acc + 3;
            default:         return acc;
        }
    }, 0);

    return Math.max(0, 100 - deductions);
}

export function getScoreLabel(score: number): ScoreLabel {
    if (score <= 25)  return "CRITICAL";
    if (score <= 50)  return "HIGH";
    if (score <= 75)  return "MEDIUM";
    if (score <= 99)  return "LOW";
    return "CLEAN";
}

// =============================================================================
// CVSS-inspired severity scoring for attack log results
// =============================================================================

export type SeverityLevel = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";

export type ScoreLabel = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "CLEAN";

const CRITICAL_ATTACK_KEYWORDS = ["injection", "sqli", "auth"];

const CRITICAL_RESPONSE_KEYWORDS = [
    "password",
    "token",
    "secret",
    "database error",
    "ora-",
    "mysql",
    "syntax error",
];

const INFO_LEAK_KEYWORDS = [
    "error",
    "exception",
    "stack",
    "trace",
    "invalid",
    "unexpected",
];

export function getSeverity(
    attackType: string,
    statusCode: number,
    responseSnippet: string,
): SeverityLevel {
    const attack = attackType.toLowerCase();
    const snippet = (responseSnippet ?? "").toLowerCase();

    // CRITICAL: 500+ with a high-risk attack type
    if (
        statusCode >= 500 &&
        CRITICAL_ATTACK_KEYWORDS.some((k) => attack.includes(k))
    ) {
        return "CRITICAL";
    }

    // CRITICAL: response leaks sensitive data regardless of status code
    if (CRITICAL_RESPONSE_KEYWORDS.some((k) => snippet.includes(k))) {
        return "CRITICAL";
    }

    // HIGH: any other 500+
    if (statusCode >= 500) {
        return "HIGH";
    }

    // HIGH: auth-related 401 / 403
    if (
        (statusCode === 401 || statusCode === 403) &&
        (attack.includes("auth") || attack.includes("bypass"))
    ) {
        return "HIGH";
    }

    // MEDIUM: 4xx that leaks server internals
    if (
        statusCode >= 400 &&
        statusCode < 500 &&
        INFO_LEAK_KEYWORDS.some((k) => snippet.includes(k))
    ) {
        return "MEDIUM";
    }

    // LOW: generic 4xx
    if (statusCode >= 400 && statusCode < 500) {
        return "LOW";
    }

    // INFO: 2xx, 3xx, no status
    return "INFO";
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

// =============================================================================
// Types mirroring the Onyx REST API contract (kept in sync with the server).
// =============================================================================

export type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";

export type RunStatus =
    | "PENDING"
    | "PARSING"
    | "GENERATING"
    | "ATTACKING"
    | "COMPLETED"
    | "FAILED";

export const TERMINAL_STATUSES: RunStatus[] = ["COMPLETED", "FAILED"];

/** POST /api/test-runs */
export interface CreateRunResponse {
    testRunId: string;
    status: string;
    message: string;
}

export interface Finding {
    severity: Severity;
    category: string;
    title: string;
    cause: string;
    evidence: string | null;
    remediation: string;
    confidence: string;
    owaspCategory?: string | null;
}

export interface AttackResult {
    id: string;
    method: string;
    endpoint: string;
    statusCode: number;
    responseTime: number;
    attackType: string;
    severity: Severity;
    finding?: Finding;
}

export interface SeverityBreakdown {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
}

export interface RunSummary {
    id: string;
    specUrl: string;
    status: RunStatus;
    totalEndpoints: number;
    totalAttacks: number;
    completedAttacks: number;
    overallScore: number;
    scoreLabel: string;
    severityBreakdown: SeverityBreakdown;
}

/** GET /api/test-runs/:id — returns the summary AND all logs. */
export interface GetRunResponse {
    summary: RunSummary;
    logs: AttackResult[];
}

/** A flattened finding used by the formatters (table/json/sarif). */
export interface NormalizedFinding {
    method: string;
    endpoint: string;
    statusCode: number;
    severity: Severity;
    category: string;
    title: string;
    /** Short OWASP code (e.g. "API8") or null. */
    owaspCode: string | null;
    /** Full label (e.g. "API8:2023 Security Misconfiguration") or "Unmapped". */
    owaspLabel: string;
    owaspCategory: string | null;
}

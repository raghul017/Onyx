// =============================================================================
// Onyx — Shared Types
// Canonical source of truth. Also exported from <root>/shared-types.ts
// for frontend consumption.
// =============================================================================

// ---------------------------------------------------------------------------
// Enums & Literals
// ---------------------------------------------------------------------------

export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

export type TestRunStatus =
    | "PENDING"
    | "PARSING"
    | "GENERATING"
    | "ATTACKING"
    | "COMPLETED"
    | "FAILED";

export type AttackType =
    | "SQL_INJECTION"
    | "XSS"
    | "BOUNDARY"
    | "MISSING_AUTH"
    | "PATH_TRAVERSAL"
    | "OVERSIZED_PAYLOAD"
    | "TYPE_CONFUSION"
    | "RATE_LIMIT"
    | "UNKNOWN";

export type SeverityLevel = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";

export type ScoreLabel = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "CLEAN";

export type FindingConfidence = "confirmed" | "firm" | "tentative" | "info";

/** The explained finding for a single attack result (what / why / cause / fix). */
export interface FindingDetail {
    severity: SeverityLevel;
    category: string;
    title: string;
    cause: string;
    evidence: string | null;
    remediation: string;
    confidence: FindingConfidence;
}

export interface SeverityBreakdown {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
}

// ---------------------------------------------------------------------------
// Core Data Shapes
// ---------------------------------------------------------------------------

export interface AttackResult {
    id: string;
    testRunId: string;
    method: HttpMethod;
    endpoint: string;
    statusCode: number;
    responseTime: number;
    payload: string;
    responseSnippet: string;
    attackType: AttackType;
    timestamp: string;
    severity: SeverityLevel;
    /** Explained finding (category, cause, evidence, remediation). Present on
     *  the live stream and the report; omitted from the lightweight run list. */
    finding?: FindingDetail;
}

export interface TestRunSummary {
    id: string;
    specUrl: string;
    status: TestRunStatus;
    totalEndpoints: number;
    totalAttacks: number;
    completedAttacks: number;
    criticalFailures: number;
    avgLatencyMs: number;
    createdAt: string;
    completedAt: string | null;
    overallScore: number;
    scoreLabel: ScoreLabel;
    severityBreakdown: SeverityBreakdown;
}

// ---------------------------------------------------------------------------
// REST API Contracts
// ---------------------------------------------------------------------------

export interface CreateTestRunRequest {
    specUrl: string;
}

export interface CreateTestRunResponse {
    testRunId: string;
    status: TestRunStatus;
    message: string;
}

export interface GetTestRunResponse {
    summary: TestRunSummary;
    logs: AttackResult[];
}

export interface PaginatedLogsResponse {
    logs: AttackResult[];
    total: number;
    page: number;
    pageSize: number;
}

// ---------------------------------------------------------------------------
// WebSocket Message Protocol
// ---------------------------------------------------------------------------

export interface WsAttackResultMessage {
    type: "ATTACK_RESULT";
    data: AttackResult;
}

export interface WsTestRunStatusMessage {
    type: "TEST_RUN_STATUS";
    data: {
        testRunId: string;
        status: TestRunStatus;
        completedAttacks: number;
        totalAttacks: number;
    };
}

export interface WsErrorMessage {
    type: "ERROR";
    data: {
        testRunId: string;
        message: string;
        code: string;
    };
}

export type WsServerMessage =
    | WsAttackResultMessage
    | WsTestRunStatusMessage
    | WsErrorMessage;

export interface WsSubscribeMessage {
    type: "SUBSCRIBE";
    testRunId: string;
}

export interface WsUnsubscribeMessage {
    type: "UNSUBSCRIBE";
    testRunId: string;
}

export type WsClientMessage = WsSubscribeMessage | WsUnsubscribeMessage;

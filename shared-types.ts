// =============================================================================
// Onyx — Shared Types
// Shared between the React frontend and the Node.js backend.
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

// ---------------------------------------------------------------------------
// Core Data Shapes
// ---------------------------------------------------------------------------

/** A single attack result — streamed live via WebSocket and rendered in the
 *  Dashboard event-stream table. Field names mirror the existing frontend
 *  `ChaosResult` interface so the Dashboard can consume them without changes. */
export interface AttackResult {
    id: string;
    testRunId: string;
    method: HttpMethod;
    endpoint: string;
    statusCode: number;
    responseTime: number; // latency in ms
    payload: string;
    responseSnippet: string;
    attackType: AttackType;
    timestamp: string; // ISO-8601
}

/** Aggregate metrics for a test run. */
export interface TestRunSummary {
    id: string;
    specUrl: string;
    status: TestRunStatus;
    totalEndpoints: number;
    totalAttacks: number;
    completedAttacks: number;
    criticalFailures: number; // status >= 500
    avgLatencyMs: number;
    createdAt: string;
    completedAt: string | null;
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

/** Discriminated union of all server → client WebSocket messages. */
export type WsServerMessage =
    | WsAttackResultMessage
    | WsTestRunStatusMessage
    | WsErrorMessage;

/** Client → server WebSocket messages. */
export interface WsSubscribeMessage {
    type: "SUBSCRIBE";
    testRunId: string;
}

export interface WsUnsubscribeMessage {
    type: "UNSUBSCRIBE";
    testRunId: string;
}

export type WsClientMessage = WsSubscribeMessage | WsUnsubscribeMessage;

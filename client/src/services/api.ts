// =============================================================================
// API Service — Frontend HTTP client for Onyx backend
// =============================================================================

const API_BASE = "/api";

export interface CreateTestRunResponse {
    testRunId: string;
    status: string;
    message: string;
}

export interface TestRunSummary {
    id: string;
    specUrl: string;
    status: string;
    totalEndpoints: number;
    totalAttacks: number;
    completedAttacks: number;
    criticalFailures: number;
    avgLatencyMs: number;
    createdAt: string;
    completedAt: string | null;
}

export interface AttackResult {
    id: string;
    testRunId: string;
    method: string;
    endpoint: string;
    statusCode: number;
    responseTime: number;
    payload: string;
    responseSnippet: string;
    attackType: string;
    timestamp: string;
}

export interface GetTestRunResponse {
    summary: TestRunSummary;
    logs: AttackResult[];
}

/**
 * Create a new test run by submitting an OpenAPI spec URL.
 */
export async function createTestRun(
    specUrl: string,
): Promise<CreateTestRunResponse> {
    const res = await fetch(`${API_BASE}/test-runs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ specUrl }),
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Request failed" }));
        throw new Error(err.error || err.message || `HTTP ${res.status}`);
    }

    return res.json();
}

/**
 * Get a test run's summary and all attack logs.
 */
export async function getTestRun(
    testRunId: string,
): Promise<GetTestRunResponse> {
    const res = await fetch(`${API_BASE}/test-runs/${testRunId}`);

    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Request failed" }));
        throw new Error(err.error || err.message || `HTTP ${res.status}`);
    }

    return res.json();
}

/**
 * Health check.
 */
export async function healthCheck(): Promise<{ status: string }> {
    const res = await fetch(`${API_BASE}/health`);
    return res.json();
}

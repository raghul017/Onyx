// =============================================================================
// API Service — Frontend HTTP client for Onyx backend
// =============================================================================

import axios from "axios";
import { useAuthStore } from "../store/useAuthStore";

const API_BASE = "/api";

export const api = axios.create({
    baseURL: API_BASE,
});

// Auto-inject JWT token into every request
api.interceptors.request.use((config) => {
    const token = useAuthStore.getState().token;
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Auto-logout on 401 or 403
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401 || error.response?.status === 403) {
            useAuthStore.getState().logout();
            // Optional: force a page reload to clear memory and hit React Router's ProtectedRoute
            window.location.href = "/signin";
        }
        return Promise.reject(error);
    },
);

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

export interface GetAllTestRunsResponse {
    testRuns: {
        id: string;
        specUrl: string;
        status: string;
        totalEndpoints: number;
        totalAttacks: number;
        completedAttacks: number;
        createdAt: string;
        completedAt: string | null;
    }[];
}

/**
 * Get all historical test runs explicitly for the current authenticated user.
 */
export async function getAllTestRuns(): Promise<GetAllTestRunsResponse> {
    const res = await api.get("/test-runs");
    return res.data;
}

/**
 * Create a new test run by submitting an OpenAPI spec URL.
 */
export async function createTestRun(
    specUrl: string,
): Promise<CreateTestRunResponse> {
    const res = await api.post("/test-runs", { specUrl });
    return res.data;
}

/**
 * Get a test run's summary and all attack logs.
 */
export async function getTestRun(
    testRunId: string,
): Promise<GetTestRunResponse> {
    const res = await api.get(`/test-runs/${testRunId}`);
    return res.data;
}

/**
 * Health check.
 */
export async function healthCheck(): Promise<{ status: string }> {
    const res = await api.get("/health");
    return res.data;
}

/**
 * Abort an in-progress test run. Drains pending BullMQ jobs.
 */
export async function abortTestRun(
    testRunId: string,
): Promise<{ status: string; removedJobs: number; message: string }> {
    const res = await api.post(`/test-runs/${testRunId}/abort`);
    return res.data;
}

/**
 * Delete a historical test run entirely.
 */
export async function deleteTestRun(testRunId: string): Promise<void> {
    await api.delete(`/test-runs/${testRunId}`);
}

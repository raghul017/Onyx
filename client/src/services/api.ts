// =============================================================================
// API Service — Frontend HTTP client for Onyx backend
// =============================================================================

import axios from "axios";
import { useAuthStore } from "../store/useAuthStore";

let API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

// Ensure the base URL ends with /api to match the backend router prefix
if (API_BASE_URL && !API_BASE_URL.endsWith("/api")) {
    if (API_BASE_URL.endsWith("/")) {
        API_BASE_URL = API_BASE_URL.slice(0, -1);
    }
    API_BASE_URL += "/api";
}

export const api = axios.create({
    baseURL: API_BASE_URL,
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

            // Only force a reload if we are not already on the auth pages
            // This prevents a reload loop when trying to log in with wrong credentials
            const currentPath = window.location.pathname;
            if (
                currentPath !== "/signin" &&
                currentPath !== "/signup" &&
                currentPath !== "/"
            ) {
                window.location.href = "/signin";
            }
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

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
    timeout: 30_000, // 30s — generous enough for Render cold-start scenarios
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

export type SeverityLevel = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";
export type ScoreLabel = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "CLEAN";

export interface SeverityBreakdown {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
}

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
    overallScore: number;
    scoreLabel: ScoreLabel;
    severityBreakdown: SeverityBreakdown;
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
    severity: SeverityLevel;
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
        overallScore: number;
        scoreLabel: ScoreLabel;
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

// ---------------------------------------------------------------------------
// Billing
// ---------------------------------------------------------------------------

export type Plan = "FREE" | "PRO" | "TEAM" | "ENTERPRISE";

export interface CurrentUser {
    id: string;
    email: string;
    plan: Plan;
    planExpiresAt: string | null;
}

export async function getCurrentUser(): Promise<CurrentUser> {
    const res = await api.get("/user/me");
    return res.data;
}

export async function subscribeToPlan(planId: string): Promise<{ subscriptionId: string; shortUrl: string }> {
    const res = await api.post("/billing/subscribe", { planId });
    return res.data;
}

export async function cancelSubscription(): Promise<void> {
    await api.post("/billing/cancel");
}

export async function verifySubscription(subscriptionId: string): Promise<{ plan: Plan }> {
    const res = await api.post("/billing/verify", { subscriptionId });
    return res.data;
}

// ---------------------------------------------------------------------------
// PDF Export
// ---------------------------------------------------------------------------

/**
 * Downloads the PDF report for a completed test run.
 * Uses fetch directly (bypasses the axios interceptor) so a 403 PLAN_REQUIRED
 * can be handled without triggering the global logout flow.
 *
 * Returns 'plan_required' if the user's plan doesn't include PDF export.
 */
export async function exportTestRunPDF(id: string): Promise<"ok" | "plan_required"> {
    const token = useAuthStore.getState().token;
    const baseUrl = api.defaults.baseURL ?? "";

    const res = await fetch(`${baseUrl}/test-runs/${id}/export/pdf`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

    if (res.status === 403) {
        const body = await res.json().catch(() => ({}));
        if (body.error === "PLAN_REQUIRED") return "plan_required";
    }

    if (!res.ok) throw new Error("PDF export failed");

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `onyx-report-${id}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return "ok";
}

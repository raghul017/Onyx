// =============================================================================
// API Service — Frontend HTTP client for Onyx backend
// =============================================================================

import axios from "axios";
import { useAuthStore } from "../store/useAuthStore";
import { useOrgStore } from "../store/useOrgStore";

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

// Exposed for full-page OAuth redirects (not axios — the browser must navigate
// to the provider). Locally this resolves to "/api" via the Vite proxy.
export const API_ORIGIN = API_BASE_URL;

/** Full-page navigate to start a server-side OAuth flow. */
export function startOAuth(provider: "google" | "github"): void {
    window.location.href = `${API_ORIGIN}/auth/${provider}`;
}

// Auto-inject JWT token and active org into every request
api.interceptors.request.use((config) => {
    const token = useAuthStore.getState().token;
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    const activeOrg = useOrgStore.getState().activeOrg;
    if (activeOrg) {
        config.headers["x-org-id"] = activeOrg.id;
    }
    return config;
});

// Auto-logout ONLY when the session itself is invalid.
// Important: a 403 can be a normal business rule (e.g. DOMAIN_NOT_VERIFIED, or an
// org-permission denial) — those must NOT log the user out. We only treat a 403 as
// an auth failure when the backend explicitly says the token is bad.
api.interceptors.response.use(
    (response) => response,
    (error) => {
        const status = error.response?.status;
        const errCode = error.response?.data?.error;

        const isSessionInvalid =
            status === 401 ||
            (status === 403 &&
                (errCode === "Invalid or expired token" ||
                    errCode === "Authentication required"));

        if (isSessionInvalid) {
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

export type FindingConfidence = "confirmed" | "firm" | "tentative" | "info";

/** OWASP API Security Top 10 (2023) codes — must match the server enum exactly. */
export type OwaspApiCategory =
    | "API1_BOLA"
    | "API2_BROKEN_AUTHENTICATION"
    | "API3_BROKEN_OBJECT_PROPERTY_LEVEL_AUTHORIZATION"
    | "API4_UNRESTRICTED_RESOURCE_CONSUMPTION"
    | "API5_BFLA"
    | "API6_UNRESTRICTED_ACCESS_TO_SENSITIVE_BUSINESS_FLOWS"
    | "API7_SSRF"
    | "API8_SECURITY_MISCONFIGURATION"
    | "API9_IMPROPER_INVENTORY_MANAGEMENT"
    | "API10_UNSAFE_CONSUMPTION_OF_APIS";

/** Canonical ordered list (for the coverage section). */
export const OWASP_API_CATEGORIES: OwaspApiCategory[] = [
    "API1_BOLA",
    "API2_BROKEN_AUTHENTICATION",
    "API3_BROKEN_OBJECT_PROPERTY_LEVEL_AUTHORIZATION",
    "API4_UNRESTRICTED_RESOURCE_CONSUMPTION",
    "API5_BFLA",
    "API6_UNRESTRICTED_ACCESS_TO_SENSITIVE_BUSINESS_FLOWS",
    "API7_SSRF",
    "API8_SECURITY_MISCONFIGURATION",
    "API9_IMPROPER_INVENTORY_MANAGEMENT",
    "API10_UNSAFE_CONSUMPTION_OF_APIS",
];

/** Display lookup — mirrors server/src/services/owasp-mapping.ts labels. */
export const OWASP_LABELS: Record<OwaspApiCategory, { code: string; title: string; label: string }> = {
    API1_BOLA: { code: "API1:2023", title: "Broken Object Level Authorization", label: "API1:2023 Broken Object Level Authorization" },
    API2_BROKEN_AUTHENTICATION: { code: "API2:2023", title: "Broken Authentication", label: "API2:2023 Broken Authentication" },
    API3_BROKEN_OBJECT_PROPERTY_LEVEL_AUTHORIZATION: { code: "API3:2023", title: "Broken Object Property Level Authorization", label: "API3:2023 Broken Object Property Level Authorization" },
    API4_UNRESTRICTED_RESOURCE_CONSUMPTION: { code: "API4:2023", title: "Unrestricted Resource Consumption", label: "API4:2023 Unrestricted Resource Consumption" },
    API5_BFLA: { code: "API5:2023", title: "Broken Function Level Authorization", label: "API5:2023 Broken Function Level Authorization" },
    API6_UNRESTRICTED_ACCESS_TO_SENSITIVE_BUSINESS_FLOWS: { code: "API6:2023", title: "Unrestricted Access to Sensitive Business Flows", label: "API6:2023 Unrestricted Access to Sensitive Business Flows" },
    API7_SSRF: { code: "API7:2023", title: "Server Side Request Forgery", label: "API7:2023 Server Side Request Forgery" },
    API8_SECURITY_MISCONFIGURATION: { code: "API8:2023", title: "Security Misconfiguration", label: "API8:2023 Security Misconfiguration" },
    API9_IMPROPER_INVENTORY_MANAGEMENT: { code: "API9:2023", title: "Improper Inventory Management", label: "API9:2023 Improper Inventory Management" },
    API10_UNSAFE_CONSUMPTION_OF_APIS: { code: "API10:2023", title: "Unsafe Consumption of APIs", label: "API10:2023 Unsafe Consumption of APIs" },
};

/** Short code ("API8") for a category, or "Unmapped" when null/absent. */
export function owaspShortCode(code?: OwaspApiCategory | null): string {
    return code ? OWASP_LABELS[code].code.split(":")[0] : "Unmapped";
}

/** Full label ("API8:2023 Security Misconfiguration") or "Unmapped". */
export function owaspLabel(code?: OwaspApiCategory | null): string {
    return code ? OWASP_LABELS[code].label : "Unmapped";
}

/** Count findings per OWASP category (all 10 present, 0 where none) + Unmapped. */
export function owaspCoverage(
    categories: Array<OwaspApiCategory | null | undefined>,
): { counts: Record<OwaspApiCategory, number>; unmapped: number } {
    const counts = Object.fromEntries(
        OWASP_API_CATEGORIES.map((c) => [c, 0]),
    ) as Record<OwaspApiCategory, number>;
    let unmapped = 0;
    for (const c of categories) {
        if (c && c in counts) counts[c] += 1;
        else unmapped += 1;
    }
    return { counts, unmapped };
}

export interface FindingDetail {
    severity: SeverityLevel;
    category: string;
    title: string;
    cause: string;
    evidence: string | null;
    remediation: string;
    confidence: FindingConfidence;
    /** OWASP API Top 10 (2023) code (T9) — additive context; null/absent = Unmapped. */
    owaspCategory?: OwaspApiCategory | null;
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
    finding?: FindingDetail;
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
 * Create a new test run by submitting an OpenAPI spec URL. Optionally attach a
 * static credential (auth recipe) so every request in the run carries it (T7).
 */
export async function createTestRun(
    specUrl: string,
    authRecipeId?: string,
): Promise<CreateTestRunResponse> {
    const body: { specUrl: string; authRecipeId?: string } = { specUrl };
    if (authRecipeId) body.authRecipeId = authRecipeId;
    const res = await api.post("/test-runs", body);
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
export type OrgRole = "OWNER" | "ADMIN" | "VIEWER";

export interface OrgSummary {
    id: string;
    name: string;
    slug: string;
    plan: Plan;
    role: OrgRole;
}

export interface CurrentUser {
    id: string;
    email: string;
    name: string | null;
    plan: Plan;
    planExpiresAt: string | null;
    orgs: OrgSummary[];
}

export async function getCurrentUser(): Promise<CurrentUser> {
    const res = await api.get("/user/me");
    return res.data;
}

export async function updateCurrentUser(data: { name?: string }): Promise<CurrentUser> {
    const res = await api.patch("/user/me", data);
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
// Organizations
// ---------------------------------------------------------------------------

export interface OrgMember {
    id: string;
    userId: string;
    email: string;
    role: OrgRole;
    joinedAt: string;
}

export interface OrgInvite {
    id: string;
    email: string;
    role: OrgRole;
    expiresAt: string;
    acceptedAt: string | null;
    createdAt: string;
    inviteUrl?: string;
}

export async function getMyOrgs(): Promise<{ orgs: OrgSummary[] }> {
    const res = await api.get("/orgs");
    return res.data;
}

export async function createOrgApi(name: string): Promise<{ org: OrgSummary }> {
    const res = await api.post("/orgs", { name });
    return res.data;
}

export async function getOrgMembers(orgId: string): Promise<{ members: OrgMember[] }> {
    const res = await api.get(`/orgs/${orgId}/members`);
    return res.data;
}

export async function updateMemberRoleApi(orgId: string, userId: string, role: OrgRole): Promise<void> {
    await api.patch(`/orgs/${orgId}/members/${userId}`, { role });
}

export async function removeMemberApi(orgId: string, userId: string): Promise<void> {
    await api.delete(`/orgs/${orgId}/members/${userId}`);
}

export async function createInviteApi(
    orgId: string,
    email: string,
    role: OrgRole,
): Promise<{ invite: OrgInvite & { inviteUrl: string } }> {
    const res = await api.post(`/orgs/${orgId}/invites`, { email, role });
    return res.data;
}

export async function listInvitesApi(orgId: string): Promise<{ invites: OrgInvite[] }> {
    const res = await api.get(`/orgs/${orgId}/invites`);
    return res.data;
}

export async function revokeInviteApi(orgId: string, inviteId: string): Promise<void> {
    await api.delete(`/orgs/${orgId}/invites/${inviteId}`);
}

export async function acceptInviteApi(token: string): Promise<{ orgId: string; role: OrgRole }> {
    const res = await api.post("/invites/accept", { token });
    return res.data;
}

export async function deleteOrgApi(orgId: string): Promise<void> {
    await api.delete(`/orgs/${orgId}`);
}

// ---------------------------------------------------------------------------
// Domain Verification
// ---------------------------------------------------------------------------

export interface VerifiedTarget {
    id: string;
    domain: string;
    token: string | null;
    verifiedAt: string | null;
    createdAt: string;
}

export interface InitiateVerificationResponse {
    domain: string;
    token: string;
    verifiedAt: string | null;
    alreadyVerified: boolean;
}

export interface CheckVerificationResponse {
    verified: boolean;
    verifiedAt?: string;
    method?: "file" | "dns" | null;
}

export async function initiateVerification(
    specUrl: string,
): Promise<InitiateVerificationResponse> {
    const res = await api.post("/verify-target", { specUrl });
    return res.data;
}

export async function checkVerification(
    domain: string,
): Promise<CheckVerificationResponse> {
    const res = await api.post("/verify-target/check", { domain });
    return res.data;
}

export async function getVerifiedTargets(): Promise<{ targets: VerifiedTarget[] }> {
    const res = await api.get("/verify-target");
    return res.data;
}

// ---------------------------------------------------------------------------
// Auth Recipes (T7) — static credentials attached to a scan.
//
// Secrets are WRITE-ONLY: the API returns them masked as "••••<last4>", never in
// full. Mirrors the server Zod shapes (auth-recipe.service / validators).
// ---------------------------------------------------------------------------

export type AuthRecipeType =
    | "bearer"
    | "apiKey"
    | "header"
    | "cookie"
    | "loginRequest" // T8a dynamic
    | "oauth2ClientCredentials"; // T8a dynamic

/** Non-secret descriptors — static (T7a) + dynamic (T8a). Secrets live in `secret`. */
export interface AuthRecipeMeta {
    // static
    headerName?: string;
    queryName?: string;
    location?: "header" | "query";
    cookieName?: string;
    // oauth2ClientCredentials
    tokenUrl?: string;
    clientId?: string;
    scope?: string;
    tokenResponseField?: string;
    // loginRequest
    method?: string;
    url?: string;
    headers?: Record<string, string>;
    bodyTemplate?: string;
    tokenPath?: string;
    // shared dynamic: "bearer" | "header:<Name>"
    injectAs?: string;
}

/** The secret payload: a STRING for static types, an OBJECT for dynamic ones. */
export type AuthRecipeSecretInput = string | Record<string, string>;

/** Masked recipe as returned by the API — never contains the plaintext secret. */
export interface AuthRecipe {
    id: string;
    userId: string | null;
    orgId: string | null;
    name: string;
    type: AuthRecipeType;
    meta: AuthRecipeMeta;
    secretMasked: string; // e.g. "••••1234" (static) or "••••••" (dynamic)
    createdAt: string;
    updatedAt: string;
}

export interface CreateAuthRecipeInput {
    name: string;
    type: AuthRecipeType;
    secret: AuthRecipeSecretInput;
    meta?: AuthRecipeMeta;
}

/** Update: omit `secret` to KEEP the current one (we never fetch it back). */
export interface UpdateAuthRecipeInput {
    name?: string;
    secret?: AuthRecipeSecretInput;
    meta?: AuthRecipeMeta;
}

export async function listAuthRecipes(): Promise<{ recipes: AuthRecipe[] }> {
    const res = await api.get("/auth-recipes");
    return res.data;
}

export async function getAuthRecipe(id: string): Promise<AuthRecipe> {
    const res = await api.get(`/auth-recipes/${id}`);
    return res.data;
}

export async function createAuthRecipe(
    input: CreateAuthRecipeInput,
): Promise<AuthRecipe> {
    const res = await api.post("/auth-recipes", input);
    return res.data;
}

export async function updateAuthRecipe(
    id: string,
    input: UpdateAuthRecipeInput,
): Promise<AuthRecipe> {
    const res = await api.patch(`/auth-recipes/${id}`, input);
    return res.data;
}

export async function deleteAuthRecipe(id: string): Promise<void> {
    await api.delete(`/auth-recipes/${id}`);
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

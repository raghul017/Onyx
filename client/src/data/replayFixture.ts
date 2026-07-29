// =============================================================================
// replayFixture — curated, realistic rows for the homepage live-console replay
// (T21-demo). The shape mirrors the real console's AttackResult (method, endpoint,
// statusCode, responseTime, attackType, severity, owaspCode) so the replay reads
// as authentic. A mix of confirmed findings across severities plus handled 2xx
// probes — no invented schema, no live network.
// =============================================================================

export type ReplaySeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";

export interface ReplayRow {
    id: number;
    method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
    endpoint: string;
    statusCode: number;
    /** latency in ms */
    responseTime: number;
    attackType: string;
    severity: ReplaySeverity;
    /** OWASP API Top 10 (2023) code, when the finding maps to one. */
    owaspCode?: string;
}

export const REPLAY_ROWS: ReplayRow[] = [
    { id: 1, method: "POST", endpoint: "/v1/users/login", statusCode: 500, responseTime: 2340, attackType: "SQL_INJECTION", severity: "CRITICAL", owaspCode: "API8" },
    { id: 2, method: "GET", endpoint: "/v1/products?sort=name", statusCode: 200, responseTime: 41, attackType: "XSS", severity: "INFO" },
    { id: 3, method: "DELETE", endpoint: "/v1/admin/users/1", statusCode: 200, responseTime: 118, attackType: "MISSING_AUTH", severity: "HIGH", owaspCode: "API2" },
    { id: 4, method: "PATCH", endpoint: "/v1/users/profile", statusCode: 200, responseTime: 96, attackType: "MASS_ASSIGNMENT", severity: "HIGH", owaspCode: "API3" },
    { id: 5, method: "GET", endpoint: "/v1/orders/{id}", statusCode: 403, responseTime: 52, attackType: "BOLA", severity: "INFO" },
    { id: 6, method: "POST", endpoint: "/v1/checkout", statusCode: 500, responseTime: 8920, attackType: "OVERSIZED_PAYLOAD", severity: "MEDIUM", owaspCode: "API4" },
    { id: 7, method: "GET", endpoint: "/v1/search?q=%27", statusCode: 200, responseTime: 63, attackType: "SQL_INJECTION", severity: "MEDIUM", owaspCode: "API8" },
    { id: 8, method: "PUT", endpoint: "/v1/settings", statusCode: 200, responseTime: 74, attackType: "TYPE_CONFUSION", severity: "INFO" },
    { id: 9, method: "POST", endpoint: "/v1/upload", statusCode: 500, responseTime: 15200, attackType: "RATE_LIMIT", severity: "MEDIUM", owaspCode: "API4" },
    { id: 10, method: "GET", endpoint: "/v1/internal/config", statusCode: 200, responseTime: 58, attackType: "AUTH_BYPASS", severity: "CRITICAL", owaspCode: "API2" },
    { id: 11, method: "GET", endpoint: "/v1/health", statusCode: 200, responseTime: 12, attackType: "PATH_TRAVERSAL", severity: "INFO" },
    { id: 12, method: "POST", endpoint: "/v1/comments", statusCode: 200, responseTime: 88, attackType: "XSS", severity: "LOW", owaspCode: "API8" },
];

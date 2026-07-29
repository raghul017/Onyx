// =============================================================================
// OWASP API Top 10 (2023) labels — a standalone copy of the server's mapping
// labels (server/src/services/owasp-mapping.ts) so the CLI has no repo deps.
// =============================================================================

const OWASP_LABELS: Record<string, { code: string; title: string }> = {
    API1_BOLA: { code: "API1:2023", title: "Broken Object Level Authorization" },
    API2_BROKEN_AUTHENTICATION: { code: "API2:2023", title: "Broken Authentication" },
    API3_BROKEN_OBJECT_PROPERTY_LEVEL_AUTHORIZATION: { code: "API3:2023", title: "Broken Object Property Level Authorization" },
    API4_UNRESTRICTED_RESOURCE_CONSUMPTION: { code: "API4:2023", title: "Unrestricted Resource Consumption" },
    API5_BFLA: { code: "API5:2023", title: "Broken Function Level Authorization" },
    API6_UNRESTRICTED_ACCESS_TO_SENSITIVE_BUSINESS_FLOWS: { code: "API6:2023", title: "Unrestricted Access to Sensitive Business Flows" },
    API7_SSRF: { code: "API7:2023", title: "Server Side Request Forgery" },
    API8_SECURITY_MISCONFIGURATION: { code: "API8:2023", title: "Security Misconfiguration" },
    API9_IMPROPER_INVENTORY_MANAGEMENT: { code: "API9:2023", title: "Improper Inventory Management" },
    API10_UNSAFE_CONSUMPTION_OF_APIS: { code: "API10:2023", title: "Unsafe Consumption of APIs" },
};

/** Short code ("API8") for an OWASP category enum value, or null. */
export function owaspShortCode(category?: string | null): string | null {
    if (!category) return null;
    return OWASP_LABELS[category]?.code.split(":")[0] ?? null;
}

/** Full label ("API8:2023 Security Misconfiguration") or "Unmapped". */
export function owaspLabel(category?: string | null): string {
    if (!category) return "Unmapped";
    const e = OWASP_LABELS[category];
    return e ? `${e.code} ${e.title}` : "Unmapped";
}

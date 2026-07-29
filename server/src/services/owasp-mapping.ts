// =============================================================================
// OWASP API Security Top 10 (2023) mapping — single source of truth (T9).
//
// The 2023 taxonomy has NO standalone "injection" category: SQLi / XSS / path
// traversal / type confusion all fold under API8 (Security Misconfiguration).
// This module maps each finding (by its category signal, then by attack class)
// to exactly ONE OWASP code, or null ("Unmapped") when there's no clear fit.
// The OWASP code is ADDITIVE context — it never replaces the specific finding
// name (category/title/severity).
//
// Resolved table (finding category / attack type → code):
//   Sensitive Data Exposure ............................. API3
//   Broken Authentication / Access Control .............. API2
//   MISSING_AUTH / *BYPASS* attack (any result) ......... API2
//   OVERSIZED_PAYLOAD / RATE_LIMIT attack (any result) .. API4
//   Path Traversal / SQL Injection / Reflected XSS /
//     Blind/Time-Based Injection / Likely Blind Injection /
//     Unhandled Server Error / Verbose Error ............ API8
//   SQL_INJECTION / XSS / PATH_TRAVERSAL / TYPE_CONFUSION /
//     BOUNDARY attack (benign result) ................... API8
//   Request Error (transport failure) ................... null (Unmapped)
//   Handled / Access Control Enforced / Input Rejected
//     with an UNKNOWN attack type ....................... null (Unmapped)
//
// Reserved for later tickets (no current finding emits these): BOLA→API1,
// BFLA→API5, mass-assignment→API3/API6, SSRF→API7, API9/API10.
// =============================================================================

import type { OwaspApiCategory } from "../types/shared.js";

/** Canonical ordered list of the 10 categories (for display / coverage). */
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

export interface OwaspLabel {
    /** e.g. "API3:2023" */
    code: string;
    /** e.g. "Broken Object Property Level Authorization" */
    title: string;
    /** e.g. "API3:2023 Broken Object Property Level Authorization" */
    label: string;
}

const mk = (code: string, title: string): OwaspLabel => ({
    code,
    title,
    label: `${code} ${title}`,
});

/** Display lookup for each code (used by the PDF + client badges). */
export const OWASP_LABELS: Record<OwaspApiCategory, OwaspLabel> = {
    API1_BOLA: mk("API1:2023", "Broken Object Level Authorization"),
    API2_BROKEN_AUTHENTICATION: mk("API2:2023", "Broken Authentication"),
    API3_BROKEN_OBJECT_PROPERTY_LEVEL_AUTHORIZATION: mk(
        "API3:2023",
        "Broken Object Property Level Authorization",
    ),
    API4_UNRESTRICTED_RESOURCE_CONSUMPTION: mk("API4:2023", "Unrestricted Resource Consumption"),
    API5_BFLA: mk("API5:2023", "Broken Function Level Authorization"),
    API6_UNRESTRICTED_ACCESS_TO_SENSITIVE_BUSINESS_FLOWS: mk(
        "API6:2023",
        "Unrestricted Access to Sensitive Business Flows",
    ),
    API7_SSRF: mk("API7:2023", "Server Side Request Forgery"),
    API8_SECURITY_MISCONFIGURATION: mk("API8:2023", "Security Misconfiguration"),
    API9_IMPROPER_INVENTORY_MANAGEMENT: mk("API9:2023", "Improper Inventory Management"),
    API10_UNSAFE_CONSUMPTION_OF_APIS: mk("API10:2023", "Unsafe Consumption of APIs"),
};

/** Human label for a code or null → "Unmapped". */
export function owaspLabel(code: OwaspApiCategory | null | undefined): string {
    return code ? OWASP_LABELS[code].label : "Unmapped";
}

// Category signals that fold under API8 in the 2023 taxonomy.
const API8_CATEGORIES = new Set([
    "Path Traversal",
    "SQL Injection",
    "Reflected XSS",
    "Blind/Time-Based Injection",
    "Likely Blind Injection",
    "Unhandled Server Error",
    "Verbose Error / Info Disclosure",
]);

// Attack classes that fold under API8 (injection / input-handling / misconfig).
const API8_ATTACKS = new Set([
    "SQL_INJECTION",
    "XSS",
    "PATH_TRAVERSAL",
    "TYPE_CONFUSION",
    "BOUNDARY",
]);

/**
 * Deterministically map a finding to its OWASP API Top 10 (2023) code, or null.
 * Category signals win over attack class; a resource-consumption attack (whose
 * payload IS the stress) is attributed to API4 even for a 5xx/handled result.
 */
export function mapFindingToOwasp(
    finding: { category: string },
    attackType?: string,
): OwaspApiCategory | null {
    const category = finding.category;
    const at = (attackType ?? "").toUpperCase();

    // 0) Inconclusive transport failure — no security fit.
    if (category === "Request Error") return null;

    // 1) Definitive category signals (attack-type independent).
    if (category === "Sensitive Data Exposure")
        return "API3_BROKEN_OBJECT_PROPERTY_LEVEL_AUTHORIZATION";
    if (category === "Broken Authentication / Access Control")
        return "API2_BROKEN_AUTHENTICATION";

    // 2) Resource-consumption attack classes → API4 (even 5xx / handled).
    if (at === "OVERSIZED_PAYLOAD" || at === "RATE_LIMIT")
        return "API4_UNRESTRICTED_RESOURCE_CONSUMPTION";

    // 3) Missing / broken-auth probes → API2.
    if (at === "MISSING_AUTH" || at.includes("BYPASS")) return "API2_BROKEN_AUTHENTICATION";

    // 4) Injection / misconfig category signals → API8.
    if (API8_CATEGORIES.has(category)) return "API8_SECURITY_MISCONFIGURATION";

    // 5) Injection / input-handling attack classes → API8 (even on a benign result).
    if (API8_ATTACKS.has(at)) return "API8_SECURITY_MISCONFIGURATION";

    // 6) No clear fit (Handled / Access Control Enforced / Input Rejected with an
    //    UNKNOWN attack type) → Unmapped.
    return null;
}

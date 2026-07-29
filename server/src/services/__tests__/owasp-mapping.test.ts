// =============================================================================
// Tests for the OWASP API Top 10 (2023) mapping — the single source of truth.
// Verifies the resolved table: category signals win, resource attacks → API4,
// injection folds under API8 (no phantom injection category), and Unmapped.
// =============================================================================

import { describe, it, expect } from "vitest";
import { mapFindingToOwasp, OWASP_API_CATEGORIES, OWASP_LABELS, owaspLabel } from "../owasp-mapping.js";

describe("mapFindingToOwasp — representative mappings", () => {
    it("MISSING_AUTH broken-auth finding => API2", () => {
        expect(
            mapFindingToOwasp({ category: "Broken Authentication / Access Control" }, "MISSING_AUTH"),
        ).toBe("API2_BROKEN_AUTHENTICATION");
    });

    it("MISSING_AUTH that was correctly rejected still classes as API2 (probe class)", () => {
        expect(mapFindingToOwasp({ category: "Access Control Enforced" }, "MISSING_AUTH")).toBe(
            "API2_BROKEN_AUTHENTICATION",
        );
    });

    it("SQL injection (error disclosed) => API8 (2023 folds injection under misconfig)", () => {
        expect(mapFindingToOwasp({ category: "SQL Injection" }, "SQL_INJECTION")).toBe(
            "API8_SECURITY_MISCONFIGURATION",
        );
    });

    it("reflected XSS / path traversal / verbose error => API8", () => {
        expect(mapFindingToOwasp({ category: "Reflected XSS" }, "XSS")).toBe("API8_SECURITY_MISCONFIGURATION");
        expect(mapFindingToOwasp({ category: "Path Traversal" }, "PATH_TRAVERSAL")).toBe("API8_SECURITY_MISCONFIGURATION");
        expect(mapFindingToOwasp({ category: "Verbose Error / Info Disclosure" }, "TYPE_CONFUSION")).toBe("API8_SECURITY_MISCONFIGURATION");
    });

    it("time-based / likely-blind injection categories => API8", () => {
        expect(mapFindingToOwasp({ category: "Blind/Time-Based Injection" }, "SQL_INJECTION")).toBe("API8_SECURITY_MISCONFIGURATION");
        expect(mapFindingToOwasp({ category: "Likely Blind Injection" }, "SQL_INJECTION")).toBe("API8_SECURITY_MISCONFIGURATION");
    });

    it("secret / sensitive-data exposure => API3 (signal wins over attack type)", () => {
        expect(mapFindingToOwasp({ category: "Sensitive Data Exposure" }, "SQL_INJECTION")).toBe(
            "API3_BROKEN_OBJECT_PROPERTY_LEVEL_AUTHORIZATION",
        );
        // Even discovered via an oversized-payload probe, the leak signal wins.
        expect(mapFindingToOwasp({ category: "Sensitive Data Exposure" }, "OVERSIZED_PAYLOAD")).toBe(
            "API3_BROKEN_OBJECT_PROPERTY_LEVEL_AUTHORIZATION",
        );
    });

    it("OVERSIZED_PAYLOAD / RATE_LIMIT => API4 (even a 5xx crash or handled result)", () => {
        expect(mapFindingToOwasp({ category: "Unhandled Server Error" }, "OVERSIZED_PAYLOAD")).toBe(
            "API4_UNRESTRICTED_RESOURCE_CONSUMPTION",
        );
        expect(mapFindingToOwasp({ category: "Handled" }, "RATE_LIMIT")).toBe(
            "API4_UNRESTRICTED_RESOURCE_CONSUMPTION",
        );
    });

    it("non-resource 5xx crash => API8, not API4", () => {
        expect(mapFindingToOwasp({ category: "Unhandled Server Error" }, "TYPE_CONFUSION")).toBe(
            "API8_SECURITY_MISCONFIGURATION",
        );
    });

    it("injection attack class with a benign result still maps to API8 (coverage)", () => {
        expect(mapFindingToOwasp({ category: "Handled" }, "SQL_INJECTION")).toBe("API8_SECURITY_MISCONFIGURATION");
        expect(mapFindingToOwasp({ category: "Input Rejected" }, "BOUNDARY")).toBe("API8_SECURITY_MISCONFIGURATION");
    });

    it("unmapped cases => null", () => {
        expect(mapFindingToOwasp({ category: "Request Error" }, "SQL_INJECTION")).toBeNull(); // transport failure
        expect(mapFindingToOwasp({ category: "Handled" }, "UNKNOWN")).toBeNull();
        expect(mapFindingToOwasp({ category: "Handled" })).toBeNull();
    });
});

describe("OWASP labels + lookup", () => {
    it("has a label for every category (2023 codes)", () => {
        expect(OWASP_API_CATEGORIES).toHaveLength(10);
        for (const code of OWASP_API_CATEGORIES) {
            expect(OWASP_LABELS[code].code).toMatch(/^API\d+:2023$/);
            expect(OWASP_LABELS[code].label.startsWith(OWASP_LABELS[code].code)).toBe(true);
        }
        expect(OWASP_LABELS.API8_SECURITY_MISCONFIGURATION.label).toBe(
            "API8:2023 Security Misconfiguration",
        );
    });

    it("owaspLabel renders Unmapped for null", () => {
        expect(owaspLabel(null)).toBe("Unmapped");
        expect(owaspLabel("API2_BROKEN_AUTHENTICATION")).toBe("API2:2023 Broken Authentication");
    });
});

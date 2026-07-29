// =============================================================================
// Tests for the client OWASP helpers (T9b) — coverage reducer + label lookups.
// Pure logic, no DOM. Enum values/labels must mirror the server exactly.
// =============================================================================

import { describe, it, expect } from "vitest";
import {
    owaspCoverage,
    owaspShortCode,
    owaspLabel,
    OWASP_API_CATEGORIES,
    OWASP_LABELS,
    type OwaspApiCategory,
} from "@/services/api";

describe("owaspCoverage — per-category counts (all 10 present) + unmapped", () => {
    it("counts each category and treats null/undefined as unmapped", () => {
        const { counts, unmapped } = owaspCoverage([
            "API8_SECURITY_MISCONFIGURATION",
            "API8_SECURITY_MISCONFIGURATION",
            "API2_BROKEN_AUTHENTICATION",
            null,
            undefined,
        ]);
        expect(counts.API8_SECURITY_MISCONFIGURATION).toBe(2);
        expect(counts.API2_BROKEN_AUTHENTICATION).toBe(1);
        expect(unmapped).toBe(2);
    });

    it("always includes all 10 categories, 0 where none", () => {
        const { counts } = owaspCoverage([]);
        expect(Object.keys(counts)).toHaveLength(10);
        for (const code of OWASP_API_CATEGORIES) expect(counts[code]).toBe(0);
    });

    it("total across counts + unmapped equals input length", () => {
        const input: Array<OwaspApiCategory | null> = [
            "API3_BROKEN_OBJECT_PROPERTY_LEVEL_AUTHORIZATION",
            "API4_UNRESTRICTED_RESOURCE_CONSUMPTION",
            null,
        ];
        const { counts, unmapped } = owaspCoverage(input);
        const total = Object.values(counts).reduce((a, b) => a + b, 0) + unmapped;
        expect(total).toBe(input.length);
    });
});

describe("owasp label helpers", () => {
    it("owaspShortCode → API code or Unmapped", () => {
        expect(owaspShortCode("API8_SECURITY_MISCONFIGURATION")).toBe("API8");
        expect(owaspShortCode("API10_UNSAFE_CONSUMPTION_OF_APIS")).toBe("API10");
        expect(owaspShortCode(null)).toBe("Unmapped");
        expect(owaspShortCode(undefined)).toBe("Unmapped");
    });

    it("owaspLabel → full 2023 label or Unmapped", () => {
        expect(owaspLabel("API2_BROKEN_AUTHENTICATION")).toBe("API2:2023 Broken Authentication");
        expect(owaspLabel(null)).toBe("Unmapped");
    });

    it("every category has a well-formed label", () => {
        expect(OWASP_API_CATEGORIES).toHaveLength(10);
        for (const code of OWASP_API_CATEGORIES) {
            expect(OWASP_LABELS[code].code).toMatch(/^API\d+:2023$/);
            expect(OWASP_LABELS[code].label.startsWith(OWASP_LABELS[code].code)).toBe(true);
        }
    });
});

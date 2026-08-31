// =============================================================================
// Guards the homepage OWASP coverage grid (T21b): all 10 categories present with
// their real 2023 titles, and ONLY the codes Onyx actually detects today
// (API1/API2/API3/API4/API5/API8) are flagged detected — so the section never
// overclaims. API1 = BOLA (T13a/b), API5 = BFLA (T14a), API3 also covers mass
// assignment (T14b) + excessive data exposure (T14c).
// =============================================================================
import { describe, it, expect } from "vitest";
import { OWASP_CATEGORIES } from "../components/OwaspCoverage";

describe("OWASP_CATEGORIES", () => {
    it("lists all ten categories, API1…API10 in order", () => {
        expect(OWASP_CATEGORIES).toHaveLength(10);
        expect(OWASP_CATEGORIES.map((c) => c.code)).toEqual([
            "API1", "API2", "API3", "API4", "API5",
            "API6", "API7", "API8", "API9", "API10",
        ]);
    });

    it("marks exactly the actively-detected categories (no overclaim)", () => {
        const detected = OWASP_CATEGORIES.filter((c) => c.detected).map((c) => c.code);
        expect(detected).toEqual(["API1", "API2", "API3", "API4", "API5", "API8"]);
    });

    it("uses the real OWASP 2023 titles", () => {
        const byCode = Object.fromEntries(OWASP_CATEGORIES.map((c) => [c.code, c.title]));
        expect(byCode.API2).toBe("Broken Authentication");
        expect(byCode.API4).toBe("Unrestricted Resource Consumption");
        expect(byCode.API8).toBe("Security Misconfiguration");
        // every title is non-empty
        for (const c of OWASP_CATEGORIES) expect(c.title.length).toBeGreaterThan(0);
    });
});

// =============================================================================
// Guards the curated remediation library (T15a): keys must match the backend's
// finding category strings verbatim (a typo silently degrades every cell to the
// generic fallback), lookups behave, and every snippet is real content.
// =============================================================================
import { describe, it, expect } from "vitest";
import {
    REMEDIATION,
    FRAMEWORKS,
    getRemediationSnippet,
    frameworksWithSnippet,
    type Framework,
} from "../data/remediation";

/** Category strings the backend actually emits (grepped from the services). */
const BACKEND_CATEGORIES = [
    "SQL Injection",
    "Reflected XSS",
    "Path Traversal",
    "Blind/Time-Based Injection",
    "Broken Authentication / Access Control",
    "Broken Object Level Authorization",
    "Broken Function Level Authorization",
    "Mass Assignment",
    "Excessive Data Exposure",
    "Sensitive Data Exposure",
    "Verbose Error / Info Disclosure",
    "Unhandled Server Error",
    // Non-finding / informational categories — no snippets expected:
    "Access Control Enforced",
    "Handled",
    "Request Error",
    "Likely Blind Injection",
];

describe("library keys match backend categories", () => {
    it("every key is a real backend finding category (no typos)", () => {
        for (const key of Object.keys(REMEDIATION)) {
            expect(BACKEND_CATEGORIES).toContain(key);
        }
    });

    it("covers the high-value exploitable categories", () => {
        for (const c of [
            "SQL Injection",
            "Reflected XSS",
            "Broken Object Level Authorization",
            "Broken Function Level Authorization",
            "Mass Assignment",
            "Excessive Data Exposure",
        ]) {
            expect(Object.keys(REMEDIATION)).toContain(c);
        }
    });
});

describe("getRemediationSnippet", () => {
    it("returns a snippet for a known (category, framework)", () => {
        const s = getRemediationSnippet("SQL Injection", "express");
        expect(s).not.toBeNull();
        expect(s!.code).toContain("$1"); // parameterized, not concatenated
        expect(s!.summary.length).toBeGreaterThan(0);
        expect(s!.language).toBe("js");
    });

    it("returns null for an unknown category => generic fallback", () => {
        expect(getRemediationSnippet("Totally Unknown Category", "express")).toBeNull();
        expect(getRemediationSnippet("Handled", "express")).toBeNull();
    });

    it("returns null for 'generic' and for null/undefined categories", () => {
        expect(getRemediationSnippet("SQL Injection", "generic")).toBeNull();
        expect(getRemediationSnippet(null, "express")).toBeNull();
        expect(getRemediationSnippet(undefined, "express")).toBeNull();
    });

    it("returns null for a category/framework pair that was intentionally omitted", () => {
        // Omitted on purpose rather than guessed — must fall back, not throw.
        const omitted = getRemediationSnippet("Reflected XSS", "spring");
        expect(omitted).toBeNull();
    });
});

describe("every curated snippet is real content", () => {
    it("has a non-empty summary, code, and language", () => {
        for (const [category, byFramework] of Object.entries(REMEDIATION)) {
            for (const [fw, snippet] of Object.entries(byFramework)) {
                expect(snippet, `${category}/${fw}`).toBeTruthy();
                expect(snippet!.summary.trim().length, `${category}/${fw} summary`).toBeGreaterThan(10);
                expect(snippet!.code.trim().length, `${category}/${fw} code`).toBeGreaterThan(20);
                expect(snippet!.language.trim().length, `${category}/${fw} language`).toBeGreaterThan(0);
            }
        }
    });

    it("only uses the declared frameworks as keys", () => {
        const ids = FRAMEWORKS.map((f) => f.id);
        for (const byFramework of Object.values(REMEDIATION)) {
            for (const fw of Object.keys(byFramework)) {
                expect(ids).toContain(fw as Framework);
            }
        }
    });
});

describe("frameworksWithSnippet", () => {
    it("lists only frameworks that actually have a cell", () => {
        const fws = frameworksWithSnippet("SQL Injection");
        expect(fws).toContain("express");
        expect(fws.length).toBeGreaterThan(0);
        for (const f of fws) {
            expect(getRemediationSnippet("SQL Injection", f)).not.toBeNull();
        }
    });

    it("is empty for an unknown or snippet-less category", () => {
        expect(frameworksWithSnippet("Handled")).toEqual([]);
        expect(frameworksWithSnippet(null)).toEqual([]);
    });
});

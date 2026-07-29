// =============================================================================
// Guards the user-facing changelog (T21f): well-formed entries AND that no
// internal-log artifacts (ticket IDs, file paths, test counts) leak into the
// public page. docs/UPDATES.md stays internal; this data is what users see.
// =============================================================================
import { describe, it, expect } from "vitest";
import { CHANGELOG } from "../data/changelog";

const TAGS = new Set(["New", "Improved", "Fixed"]);

describe("CHANGELOG", () => {
    it("has entries, each well-formed", () => {
        expect(CHANGELOG.length).toBeGreaterThan(0);
        for (const e of CHANGELOG) {
            expect(e.title.length).toBeGreaterThan(0);
            expect(TAGS.has(e.tag)).toBe(true);
            expect(e.iso).toMatch(/^\d{4}-\d{2}-\d{2}$/);
            expect(e.date.length).toBeGreaterThan(0);
            expect(e.items.length).toBeGreaterThan(0);
            for (const item of e.items) expect(item.length).toBeGreaterThan(0);
        }
    });

    it("is sorted newest-first by date", () => {
        const isos = CHANGELOG.map((e) => e.iso);
        const sorted = [...isos].sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
        expect(isos).toEqual(sorted);
    });

    it("reads as user-facing — no ticket IDs, file paths, or test counts", () => {
        const blob = CHANGELOG.map((e) => [e.title, ...e.items].join(" ")).join(" ");
        // No ticket IDs like T7a / T21-demo.
        expect(blob).not.toMatch(/\bT\d+[a-z-]/i);
        // No source file paths.
        expect(blob).not.toMatch(/\.(ts|tsx|js|prisma)\b/);
        expect(blob).not.toMatch(/client\/src|server\/src/);
        // No "N tests" / "N/N green" internal metrics.
        expect(blob).not.toMatch(/\d+\s*tests?\b/i);
        expect(blob).not.toMatch(/\d+\/\d+\s*green/i);
    });
});

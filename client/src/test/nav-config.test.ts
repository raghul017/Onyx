// =============================================================================
// Guards the navbar mega-menu invariant (T21a): every internal nav href points
// at a route that App.tsx actually registers, or a homepage anchor — so no
// dropdown link 404s. Update KNOWN_ROUTES when you add a public route.
// =============================================================================
import { describe, it, expect } from "vitest";
import { NAV_GROUPS, NAV_PRICING, type NavItem } from "../components/nav-config";

// Public routes registered in App.tsx (keep in sync).
const KNOWN_ROUTES = new Set([
    "/",
    "/docs",
    "/pricing",
    "/security",
    "/changelog",
    "/privacy",
    "/terms",
    "/responsible-disclosure",
    "/signin",
    "/signup",
    // homepage anchors deep-link back to "/", so they route fine even before
    // the target section exists (forward anchors from T21b/T21c).
    "/dashboard",
    "/billing",
]);

const allItems: NavItem[] = [...NAV_GROUPS.flatMap((g) => g.items), NAV_PRICING];

describe("nav-config", () => {
    it("every item has a label, href, and description", () => {
        for (const item of allItems) {
            expect(item.label.length).toBeGreaterThan(0);
            expect(item.href.length).toBeGreaterThan(0);
            expect(item.desc.length).toBeGreaterThan(0);
        }
    });

    it("every internal href is a known route or a homepage anchor (no 404s)", () => {
        for (const item of allItems) {
            if (item.ext) {
                expect(item.href).toMatch(/^https?:\/\//);
                continue;
            }
            // "/#anchor" → resolves to the homepage; "/route" → must be registered.
            const routePart = item.href.startsWith("/#") ? "/" : item.href.split("#")[0];
            expect(KNOWN_ROUTES.has(routePart)).toBe(true);
        }
    });

    it("has exactly the three expected dropdown groups", () => {
        expect(NAV_GROUPS.map((g) => g.label)).toEqual(["Product", "Solutions", "Resources"]);
    });
});

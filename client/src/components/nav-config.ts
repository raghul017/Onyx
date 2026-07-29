// =============================================================================
// Marketing navbar information architecture (T21a).
// A single source of truth for the desktop mega-menu, the mobile menu, and any
// future nav test. Pure data — no React — so it's trivially testable.
//
// `href` conventions:
//   "/#anchor"  → homepage section anchor (React Router navigates home, then the
//                 Landing page scrolls to the hash — see useHashScroll).
//   "/route"    → an in-app route (react-router <Link>).
//   ext: true   → external URL (rendered as a plain <a target="_blank">).
// Some anchors (#authenticated/#owasp/#cicd/#demo) don't exist until T21b/T21c;
// the links resolve to "/" and simply won't scroll yet — they never 404.
// =============================================================================

export const GITHUB_URL = "https://github.com/raghul017/Onyx";

export interface NavItem {
    label: string;
    href: string;
    /** Short description shown under the label in the dropdown panels. */
    desc: string;
    /** External link → rendered as <a target="_blank"> instead of <Link>. */
    ext?: boolean;
}

export interface NavGroup {
    /** Trigger label, e.g. "Product". */
    label: string;
    items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
    {
        label: "Product",
        items: [
            { label: "How it works", href: "/#how-it-works", desc: "Spec in, live attacks out — the full flow." },
            { label: "Authenticated scanning", href: "/#authenticated", desc: "Test what's behind the login." },
            { label: "OWASP API Top 10 coverage", href: "/#owasp", desc: "Every finding mapped to API1–API10." },
            { label: "Live console", href: "/#demo", desc: "Watch payloads stream back in real time." },
            { label: "CLI & CI/CD", href: "/#cicd", desc: "One command, or a drop-in GitHub Action." },
        ],
    },
    {
        label: "Solutions",
        items: [
            { label: "Shift-left in CI/CD", href: "/#cicd", desc: "Break the build before attackers break in." },
            { label: "API security coverage", href: "/#owasp", desc: "Injection to broken auth, all named." },
            { label: "For developers", href: "/#authenticated", desc: "Auth-aware scans from your own spec." },
            { label: "For security teams", href: "/security", desc: "Safe-by-design posture and controls." },
        ],
    },
    {
        label: "Resources",
        items: [
            { label: "Docs", href: "/docs", desc: "How Onyx works, end to end." },
            { label: "Changelog", href: "/changelog", desc: "What shipped, and when." },
            { label: "OWASP API Top 10 guide", href: "/docs", desc: "The categories Onyx tests for." },
            { label: "GitHub", href: GITHUB_URL, desc: "Read the source, open an issue.", ext: true },
        ],
    },
];

/** Standalone routes rendered as flat links (not dropdowns). */
export const NAV_PRICING: NavItem = {
    label: "Pricing",
    href: "/pricing",
    desc: "Simple, transparent plans.",
};

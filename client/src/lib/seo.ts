// =============================================================================
// SEO constants (T21h). SITE_URL is the ONE place to change for a custom domain —
// canonical URLs, og:url, and sitemap.xml all derive from it.
// =============================================================================

// Production origin. Change this single constant when moving to a custom domain.
export const SITE_URL = "https://onyx-engine.vercel.app";

// Default social share image (already in client/public).
export const OG_IMAGE = "/og-image.png";

/** Absolute URL for a route path (e.g. "/pricing" → "https://…/pricing"). */
export function absoluteUrl(path: string): string {
    if (!path || path === "/") return SITE_URL + "/";
    return SITE_URL + (path.startsWith("/") ? path : `/${path}`);
}

export interface RouteSeo {
    path: string;
    title: string;
    description: string;
}

// Per-route metadata for every PUBLIC route. This same list drives the prerender
// crawl and sitemap.xml, so keep it the source of truth. Authed routes are NOT here.
export const PUBLIC_ROUTES: RouteSeo[] = [
    {
        path: "/",
        title: "Onyx · AI-Powered API Security Testing & Pentesting",
        description:
            "Paste an OpenAPI spec and Onyx auto-generates OWASP attack payloads, fires them safely, and streams severity-scored results live. AI-native API penetration testing. Start free.",
    },
    {
        path: "/pricing",
        title: "Pricing · Onyx",
        description:
            "Simple, transparent plans for Onyx API security testing. Start free — 5 scans/month, no credit card. Upgrade for more runs, larger specs, PDF reports, and SLA support.",
    },
    {
        path: "/security",
        title: "Security · Onyx",
        description:
            "How Onyx tests safely: domain-ownership verification, an SSRF guard, encrypted secrets, hashed tokens, and redacted evidence. Our real security posture, no overclaim.",
    },
    {
        path: "/changelog",
        title: "Changelog · Onyx",
        description:
            "What's new in Onyx — authenticated scanning, OWASP API Top 10 mapping, evidence-based detection, the CLI, and the GitHub Action. Product updates in plain language.",
    },
    {
        path: "/privacy",
        title: "Privacy Policy · Onyx",
        description:
            "How Onyx collects, uses, shares, and protects your data — account info, scan results, encrypted credentials, and the third-party processors we use.",
    },
    {
        path: "/terms",
        title: "Terms of Service · Onyx",
        description:
            "The terms that govern your use of Onyx, including authorization-first acceptable use: you may only scan APIs and domains you own or are explicitly authorized to test.",
    },
    {
        path: "/responsible-disclosure",
        title: "Responsible Disclosure · Onyx",
        description:
            "Found a security issue in Onyx? Report it privately. Our responsible-disclosure policy, safe-harbor terms, scope, and what to include.",
    },
    {
        path: "/docs",
        title: "Documentation · Onyx",
        description:
            "How Onyx works end to end — quick start, domain verification, the attack flow, CVSS scoring, the CLI, and architecture. Everything you need to run your first scan.",
    },
    {
        path: "/signin",
        title: "Sign In · Onyx",
        description:
            "Sign in to Onyx to launch API security scans, stream live results, and review your findings.",
    },
    {
        path: "/signup",
        title: "Sign Up · Onyx",
        description:
            "Create your Onyx account and start finding API vulnerabilities before attackers do. Free to start, no credit card required.",
    },
];

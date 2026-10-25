// =============================================================================
// Shared plan / quota constants (T21d) — single source of truth for the homepage
// PricingSection AND the standalone /pricing page, so tiers never drift.
//
// SOURCE OF TRUTH (verified, do not invent):
//   • Quotas — server/src/lib/plan-limits.ts PLAN_LIMITS (enforced per run):
//       FREE  5 runs/mo, 10 endpoints/run
//       PRO   100 runs/mo, 50 endpoints/run
//       TEAM  500 runs/mo, 200 endpoints/run (MAX_ENDPOINTS_PER_RUN)
//       ENTERPRISE — NOT sold via checkout, no client tier.
//   • Feature gates (server): PDF export is paid-only (routes/index.ts,
//     plan === "FREE" → 403 PLAN_REQUIRED); baseline capture is paid-only
//     (test-run.controller.ts, captureBaseline = plan !== "FREE").
//   • NOT gated by plan: every check type, organizations/workspaces, and API
//     tokens (CLI / CI) are available on every plan. Don't market them as
//     paid-only unless the server starts enforcing it.
//   • Prices/currency — client Billing.tsx + PricingSection: $0 / $9 (₹900) /
//     $18 (₹1800); "Priced in USD, billed in INR".
// =============================================================================

export interface PricingPlan {
    name: string;
    price: string;
    period: string;
    inrNote?: string;
    features: string[];
    cta: string;
    href: string;
    highlight: boolean;
}

// Tier cards — identical to the values Billing.tsx charges against.
export const pricingPlans: PricingPlan[] = [
    {
        name: "Free",
        price: "$0",
        period: "/mo",
        features: [
            "5 test runs / month",
            "10 endpoints per run",
            "Every check type",
            "Workspaces, API tokens & CLI",
            "Community support",
        ],
        cta: "Start free scan",
        href: "/dashboard",
        highlight: false,
    },
    {
        name: "Pro",
        price: "$9",
        period: "/mo",
        inrNote: "Billed in INR (₹900/mo)",
        features: [
            "100 test runs / month",
            "50 endpoints per run",
            "Baseline diffing",
            "PDF reports",
        ],
        cta: "Upgrade to Pro",
        href: "/billing",
        highlight: true,
    },
    {
        name: "Team",
        price: "$18",
        period: "/mo",
        inrNote: "Billed in INR (₹1800/mo)",
        features: [
            "500 test runs / month",
            "200 endpoints per run",
            "Everything in Pro",
        ],
        cta: "Upgrade to Team",
        href: "/billing",
        highlight: false,
    },
];

// -----------------------------------------------------------------------------
// Comparison matrix — one row per capability. `values` are keyed by tier name.
// A value is either a string (displayed as-is) or a boolean (✓ / ✗). Every row
// reflects real enforcement; nothing aspirational.
// -----------------------------------------------------------------------------
export type CellValue = string | boolean;

export interface CompareRow {
    label: string;
    /** [Free, Pro, Team] in column order. */
    values: [CellValue, CellValue, CellValue];
    note?: string;
}

export const PLAN_COLUMNS = ["Free", "Pro", "Team"] as const;

export const COMPARE_ROWS: CompareRow[] = [
    { label: "Test runs / month", values: ["5", "100", "500"] },
    { label: "Endpoints per run", values: ["10", "50", "200"] },
    { label: "Check types", values: ["All", "All", "All"] },
    { label: "Authenticated scanning", values: [true, true, true] },
    { label: "OWASP API Top 10 mapping", values: [true, true, true] },
    { label: "Live streaming console", values: [true, true, true] },
    // Paid-only gates (verified server-side).
    { label: "PDF report export", values: [false, true, true] },
    { label: "Baseline capture & diffing", values: [false, true, true] },
    { label: "Workspaces (organizations)", values: [true, true, true] },
    { label: "API tokens, CLI & GitHub Action", values: [true, true, true] },
];

// =============================================================================
// Curated, USER-FACING changelog (T21f). This — NOT docs/UPDATES.md — is the
// public source of truth for the /changelog page. UPDATES.md is the internal dev
// log (ticket IDs, file paths, test counts) and must never be rendered directly.
//
// Rules for entries here: plain, benefit-oriented language; only things that
// actually shipped; honest dates grouped from the real release history. No ticket
// IDs, file paths, or test counts.
// =============================================================================

export type ChangeTag = "New" | "Improved" | "Fixed";

export interface ChangelogEntry {
    /** Display date for the release block, e.g. "July 29, 2026". */
    date: string;
    /** Machine-sortable ISO date (newest first when sorted desc). */
    iso: string;
    title: string;
    tag: ChangeTag;
    items: string[];
}

// Newest first. Dates mirror the real ship dates from the internal log.
export const CHANGELOG: ChangelogEntry[] = [
    {
        date: "July 29, 2026",
        iso: "2026-07-29",
        title: "Refreshed site & navigation",
        tag: "New",
        items: [
            "A rebuilt marketing site with a dropdown mega-menu (Product, Solutions, Resources) and standalone Pricing, Security, and Changelog pages.",
            "New homepage sections walking through authenticated scanning, OWASP API Top 10 coverage, CI/CD, and a live console replay.",
        ],
    },
    {
        date: "July 29, 2026",
        iso: "2026-07-29",
        title: "CLI & GitHub Action",
        tag: "New",
        items: [
            "Run scans from your terminal with `onyx scan` — table, JSON, or SARIF output, and fail-on-severity gating for any CI.",
            "A GitHub Action that runs Onyx on your pull requests, comments findings inline, and ships SARIF straight to your GitHub Security tab.",
            "Long-lived API tokens you can mint and revoke for CI and automation.",
        ],
    },
    {
        date: "July 29, 2026",
        iso: "2026-07-29",
        title: "OWASP API Top 10 mapping",
        tag: "New",
        items: [
            "Every finding is now labeled with its OWASP API Security Top 10 (2023) category, API1 through API10.",
            "Reports and PDF exports include a coverage section so you can see what was tested at a glance.",
        ],
    },
    {
        date: "July 28, 2026",
        iso: "2026-07-28",
        title: "Authenticated scanning",
        tag: "New",
        items: [
            "Test what's behind the login: authenticate with a bearer token, API key, or cookie.",
            "Dynamic auth with OAuth2 client-credentials and full login flows, including automatic token refresh when a session expires mid-scan.",
            "Missing-auth probes that strip credentials on purpose to catch broken access control.",
            "Auth credentials are encrypted at rest and never written to logs.",
        ],
    },
    {
        date: "July 28, 2026",
        iso: "2026-07-28",
        title: "Evidence-based detection",
        tag: "Improved",
        items: [
            "Onyx now captures a benign baseline for each endpoint and diffs attack responses against it.",
            "This confirms time-based and blind injection with real evidence and cuts false positives.",
        ],
    },
    {
        date: "July 13, 2026",
        iso: "2026-07-13",
        title: "Broader attack coverage",
        tag: "Improved",
        items: [
            "Payloads now target GET and DELETE requests, not just bodies on writes.",
            "Query, path, and header parameters are tested — not only the request body.",
        ],
    },
    {
        date: "July 13, 2026",
        iso: "2026-07-13",
        title: "Reliability & safety",
        tag: "Improved",
        items: [
            "Structured logging and error tracking for faster diagnosis.",
            "Sensitive values are redacted from stored evidence, so secrets never land in your reports.",
            "Safer, versioned database migrations behind the scenes.",
        ],
    },
];

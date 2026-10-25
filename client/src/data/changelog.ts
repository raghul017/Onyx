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
        date: "October 25, 2026",
        iso: "2026-10-25",
        title: "Far fewer false positives, and plan limits that match pricing",
        tag: "Fixed",
        items: [
            "A normal error response, like a plain \"Not found\" or a standard validation error, is no longer reported as a finding. Onyx only flags an error response when it actually leaks internals, such as a stack trace, a database error, or a server file path.",
            "Requests your API correctly rejected (bad input, or 401/403 on a protected route) now count as healthy results. They no longer lower your score or show up as findings in the CLI and GitHub Action, so a well-behaved API scores well.",
            "Scores on older runs are recalculated with the new rules the next time you open your history.",
            "Endpoints per run now follow your plan: 10 on Free, 50 on Pro, and 200 on Team. Previously every run stopped at 20.",
            "Inside an organization, the owner's paid plan now applies, so Team owners keep their Team limits in their own workspace.",
            "Teammates in an organization can now watch each other's scans live.",
        ],
    },
    {
        date: "October 25, 2026",
        iso: "2026-10-25",
        title: "Sharper, faster AI-generated attacks",
        tag: "Fixed",
        items: [
            "Onyx now runs on Google's newer Gemini 3.5 Flash-Lite model, so payload generation is faster.",
            "Fixed a problem where the AI's payloads were being thrown away, so every endpoint got the same built-in set. Each endpoint now gets payloads written for its own parameters and fields.",
        ],
    },
    {
        date: "August 31, 2026",
        iso: "2026-08-31",
        title: "Authorization testing — the checks that actually matter",
        tag: "New",
        items: [
            "Onyx now checks whether one user can read another user's data: it picks up an object as one user, asks for it as a different user, and compares what comes back.",
            "It also tries privileged endpoints — admin routes, user management, destructive actions — as a lower-privileged user, to see whether the server actually enforces who may call what.",
            "New writes are probed for privilege escalation: Onyx adds fields like \"role\" or \"isAdmin\" to an otherwise-valid request and reports when the server accepts them.",
            "Responses are scanned for data you probably didn't mean to return — password hashes, tokens, card and SSN-shaped values, internal flags, and bulk personal data.",
            "Every one of these lands as a named OWASP API Top 10 finding with both requests shown as evidence.",
        ],
    },
    {
        date: "August 31, 2026",
        iso: "2026-08-31",
        title: "Verify a fix without re-running the whole scan",
        tag: "New",
        items: [
            "Each finding now has a \"Verify fix\" button that re-runs just that one check against your API.",
            "If it no longer reproduces, the finding is marked Resolved; if it does, it's marked still present with the time it was last checked.",
            "Cross-user findings can't be re-checked on their own yet — they need a second logged-in identity — and Onyx says so rather than guessing.",
        ],
    },
    {
        date: "August 31, 2026",
        iso: "2026-08-31",
        title: "Fix guidance for your framework",
        tag: "New",
        items: [
            "Findings can now show a concrete fix for Express, FastAPI, Spring, or Django — a short, copy-paste snippet instead of generic advice.",
            "The snippets are hand-written and reviewed, not generated, so you never get invented APIs. Where we don't have a vetted example, the general guidance is shown instead.",
        ],
    },
    {
        date: "August 31, 2026",
        iso: "2026-08-31",
        title: "Share a report with a link",
        tag: "New",
        items: [
            "Generate a read-only link to any report and send it to a teammate, a client, or a vendor — no Onyx account needed to view it.",
            "The shared page shows the score, findings and OWASP coverage only. It never exposes your credentials or who shared it.",
            "Revoke the link at any time and it stops working immediately.",
        ],
    },
    {
        date: "August 31, 2026",
        iso: "2026-08-31",
        title: "Sharper detection",
        tag: "Improved",
        items: [
            "A slow-injection payload that makes an endpoint hang past the timeout is now recognised as a likely time-based injection, instead of being written off as a network error.",
        ],
    },
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

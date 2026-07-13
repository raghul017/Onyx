// =============================================================================
// Behavior-lock tests for analyzeFinding() — the 11-rule detection engine.
//
// These assert the CURRENT output of every rule (category / severity /
// confidence), plus the "strongest evidence first" ordering that decides which
// rule wins when several could match. They are a safety net for later refactors
// (baseline diffing, OWASP mapping): if a change moves any of these, it's a
// deliberate decision, not a silent regression.
// =============================================================================

import { describe, it, expect } from "vitest";
import {
    analyzeFinding,
    type FindingInput,
    type FindingDetail,
} from "../finding-analysis.js";

interface Case {
    name: string;
    input: FindingInput;
    expect: {
        category: string;
        severity: FindingDetail["severity"];
        confidence: FindingDetail["confidence"];
    };
}

// One asserting case for EACH of the 11 rules (plus the edge cases the rules
// branch on). Order in this list mirrors the rule order in the source.
const CASES: Case[] = [
    // Rule 1 — FILE_LEAK body regex (path traversal, local file disclosed)
    {
        name: "1 · FILE_LEAK: /etc/passwd contents in body",
        input: {
            attackType: "PATH_TRAVERSAL",
            statusCode: 200,
            responseSnippet: "root:x:0:0:root:/root:/bin/bash\ndaemon:x:1:1:daemon:/usr/sbin:/usr/sbin/nologin",
        },
        expect: { category: "Path Traversal", severity: "CRITICAL", confidence: "confirmed" },
    },

    // Rule 2 — SECRET_LEAK body regex (private key / credential in body)
    {
        name: "2 · SECRET_LEAK: private key block in body",
        input: {
            attackType: "BOUNDARY",
            statusCode: 200,
            responseSnippet: "here is the key -----BEGIN RSA PRIVATE KEY-----\nMIIB...",
        },
        expect: { category: "Sensitive Data Exposure", severity: "CRITICAL", confidence: "confirmed" },
    },
    {
        name: "2 · SECRET_LEAK: api_key JSON value >= 6 chars",
        input: {
            attackType: "BOUNDARY",
            statusCode: 200,
            responseSnippet: '{"api_key":"sk_live_abcdef123456"}',
        },
        expect: { category: "Sensitive Data Exposure", severity: "CRITICAL", confidence: "confirmed" },
    },

    // Rule 3 — SQL_ERROR body regex (DB error reflected)
    {
        name: "3 · SQL_ERROR: MySQL syntax error in body",
        input: {
            attackType: "SQL_INJECTION",
            statusCode: 200,
            responseSnippet: "You have an error in your SQL syntax near '1'' at line 1",
        },
        expect: { category: "SQL Injection", severity: "CRITICAL", confidence: "confirmed" },
    },

    // Rule 4 — Reflected XSS (payload is markup, appears verbatim, >= 6 chars)
    {
        name: "4 · Reflected XSS: script payload echoed verbatim (XSS attackType)",
        input: {
            attackType: "XSS",
            statusCode: 200,
            payload: "<script>alert(1)</script>",
            responseSnippet: "<div>hello <script>alert(1)</script></div>",
        },
        expect: { category: "Reflected XSS", severity: "HIGH", confidence: "confirmed" },
    },
    {
        name: "4 · Reflected XSS: markup payload reflected even without XSS attackType",
        input: {
            attackType: "BOUNDARY",
            statusCode: 200,
            payload: "<img src=x onerror=alert(1)>",
            responseSnippet: "echo: <img src=x onerror=alert(1)> done",
        },
        expect: { category: "Reflected XSS", severity: "HIGH", confidence: "confirmed" },
    },
    {
        name: "4 · Reflected XSS NOT fired: payload < 6 chars is not conclusive",
        input: {
            attackType: "XSS",
            statusCode: 200,
            payload: "<a>",
            responseSnippet: "value is <a>",
        },
        // Falls through to rule 11 (2xx handled cleanly)
        expect: { category: "Handled", severity: "INFO", confidence: "info" },
    },

    // Rule 5 — AUTH/BYPASS attackType + 2xx
    {
        name: "5 · Auth bypass: MISSING_AUTH accepted with 200",
        input: {
            attackType: "MISSING_AUTH",
            statusCode: 200,
            responseSnippet: '{"data":"ok"}',
        },
        expect: {
            category: "Broken Authentication / Access Control",
            severity: "CRITICAL",
            confidence: "confirmed",
        },
    },

    // Rule 6 — transport failures: status in {0, 408, 502, 503}
    {
        name: "6 · Transport error: status 0 (unreachable)",
        input: { attackType: "SQL_INJECTION", statusCode: 0, responseSnippet: "" },
        expect: { category: "Request Error", severity: "INFO", confidence: "info" },
    },
    {
        name: "6 · Transport error: status 408 (timeout)",
        input: { attackType: "SQL_INJECTION", statusCode: 408, responseSnippet: "" },
        expect: { category: "Request Error", severity: "INFO", confidence: "info" },
    },
    {
        name: "6 · Transport error: status 502",
        input: { attackType: "SQL_INJECTION", statusCode: 502, responseSnippet: "" },
        expect: { category: "Request Error", severity: "INFO", confidence: "info" },
    },
    {
        name: "6 · Transport error: status 503",
        input: { attackType: "SQL_INJECTION", statusCode: 503, responseSnippet: "" },
        expect: { category: "Request Error", severity: "INFO", confidence: "info" },
    },

    // Rule 7 — status >= 500 crash: injection attackType => CRITICAL, else HIGH
    {
        name: "7 · 5xx + injection attackType (SQL_INJECTION) => CRITICAL",
        input: { attackType: "SQL_INJECTION", statusCode: 500, responseSnippet: "" },
        expect: { category: "Unhandled Server Error", severity: "CRITICAL", confidence: "firm" },
    },
    {
        name: "7 · 5xx + non-injection attackType (BOUNDARY) => HIGH",
        input: { attackType: "BOUNDARY", statusCode: 500, responseSnippet: "" },
        expect: { category: "Unhandled Server Error", severity: "HIGH", confidence: "firm" },
    },
    {
        name: "7 · 5xx with leaked stack trace still a crash (CRITICAL for injection)",
        input: {
            attackType: "SQL_INJECTION",
            statusCode: 500,
            responseSnippet: "TypeError: x is not a function\n    at handler (/app/routes.js:10:5)",
        },
        expect: { category: "Unhandled Server Error", severity: "CRITICAL", confidence: "firm" },
    },

    // Rule 8 — STACK_TRACE regex on a NON-5xx status
    {
        name: "8 · Stack trace on a 200 => verbose error disclosure",
        input: {
            attackType: "BOUNDARY",
            statusCode: 200,
            responseSnippet: 'Traceback (most recent call last):\n  File "app.py", line 42, in handler',
        },
        expect: {
            category: "Verbose Error / Info Disclosure",
            severity: "MEDIUM",
            confidence: "firm",
        },
    },

    // Rule 9 — status 401 / 403 (attack correctly rejected)
    {
        name: "9 · 401 rejected => access control enforced",
        input: { attackType: "MISSING_AUTH", statusCode: 401, responseSnippet: "" },
        expect: { category: "Access Control Enforced", severity: "LOW", confidence: "info" },
    },
    {
        name: "9 · 403 rejected => access control enforced",
        input: { attackType: "MISSING_AUTH", statusCode: 403, responseSnippet: "" },
        expect: { category: "Access Control Enforced", severity: "LOW", confidence: "info" },
    },

    // Rule 10 — other 4xx: plain => LOW; with error words => MEDIUM
    {
        name: "10 · Plain 4xx (400) with no internal detail => input rejected (LOW)",
        input: { attackType: "BOUNDARY", statusCode: 400, responseSnippet: "Bad Request" },
        expect: { category: "Input Rejected", severity: "LOW", confidence: "info" },
    },
    {
        name: "10 · 4xx (422) leaking error words => verbose error (MEDIUM)",
        input: { attackType: "BOUNDARY", statusCode: 422, responseSnippet: "invalid parameter format" },
        expect: {
            category: "Verbose Error / Info Disclosure",
            severity: "MEDIUM",
            confidence: "tentative",
        },
    },

    // Rule 11 — 2xx / 3xx handled cleanly (default)
    {
        name: "11 · Clean 200 => handled",
        input: { attackType: "BOUNDARY", statusCode: 200, responseSnippet: '{"ok":true}' },
        expect: { category: "Handled", severity: "INFO", confidence: "info" },
    },
    {
        name: "11 · Clean 3xx (302) => handled",
        input: { attackType: "BOUNDARY", statusCode: 302, responseSnippet: "" },
        expect: { category: "Handled", severity: "INFO", confidence: "info" },
    },
];

describe("analyzeFinding — 11 detection rules (behavior lock)", () => {
    for (const c of CASES) {
        it(c.name, () => {
            const out = analyzeFinding(c.input);
            expect(out.category).toBe(c.expect.category);
            expect(out.severity).toBe(c.expect.severity);
            expect(out.confidence).toBe(c.expect.confidence);
        });
    }
});

describe("analyzeFinding — first-match-wins ordering", () => {
    it("FILE_LEAK (rule 1) beats a co-occurring SQL error (rule 3)", () => {
        const out = analyzeFinding({
            attackType: "SQL_INJECTION",
            statusCode: 200,
            responseSnippet:
                "root:x:0:0:root:/root:/bin/bash -- You have an error in your SQL syntax",
        });
        expect(out.category).toBe("Path Traversal");
    });

    it("SQL error (rule 3) beats the 5xx crash rule (rule 7)", () => {
        const out = analyzeFinding({
            attackType: "SQL_INJECTION",
            statusCode: 500,
            responseSnippet: "You have an error in your SQL syntax near '1'",
        });
        // Body signal wins over the status bucket.
        expect(out.category).toBe("SQL Injection");
        expect(out.severity).toBe("CRITICAL");
    });

    it("Reflected XSS (rule 4) beats the 5xx crash rule (rule 7)", () => {
        const out = analyzeFinding({
            attackType: "XSS",
            statusCode: 500,
            payload: "<script>alert(1)</script>",
            responseSnippet: "<script>alert(1)</script>",
        });
        expect(out.category).toBe("Reflected XSS");
        expect(out.severity).toBe("HIGH");
    });

    it("Transport failure (rule 6, status 503) is classified before the 5xx crash rule", () => {
        const out = analyzeFinding({
            attackType: "SQL_INJECTION",
            statusCode: 503,
            responseSnippet: "",
        });
        expect(out.category).toBe("Request Error");
        expect(out.severity).toBe("INFO");
    });
});

describe("analyzeFinding — 5xx stack-trace evidence", () => {
    it("uses the leaked stack trace as the evidence string on a crash", () => {
        const out = analyzeFinding({
            attackType: "SQL_INJECTION",
            statusCode: 500,
            responseSnippet: "TypeError: boom is not a function\n    at h (/app/x.js:1:1)",
        });
        expect(out.evidence).toContain("TypeError");
    });
});

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

// =============================================================================
// T6 — baseline diffing. analyzeFinding(input, baseline) enriches the verdict
// when a benign baseline exists. With no baseline the result is byte-identical
// to the base rules (covered by every case above, which pass no baseline).
// =============================================================================

import type { BaselineComparison } from "../finding-analysis.js";

const baseline = (over: Partial<BaselineComparison> = {}): BaselineComparison => ({
    status: 200,
    latencyMs: 120,
    bodyLength: 1000,
    bodySnippet: "OK",
    ...over,
});

describe("T6 baseline diffing — time-based injection", () => {
    it("confirms time-based injection: sleep payload + 5140ms vs baseline 120ms", () => {
        const out = analyzeFinding(
            {
                attackType: "SQL_INJECTION",
                statusCode: 200,
                latencyMs: 5140,
                payload: "1' AND SLEEP(5)-- -",
                responseSnippet: "{}",
            },
            baseline({ latencyMs: 120 }),
        );
        expect(out.category).toBe("Blind/Time-Based Injection");
        expect(out.severity).toBe("CRITICAL");
        expect(out.confidence).toBe("confirmed");
        expect(out.evidence).toContain("baseline 120ms → attack 5140ms");
    });

    it("does NOT trigger when the latency delta is small", () => {
        const out = analyzeFinding(
            {
                attackType: "SQL_INJECTION",
                statusCode: 200,
                latencyMs: 300,
                payload: "1' AND SLEEP(5)-- -",
                responseSnippet: "{}",
            },
            baseline({ latencyMs: 120 }),
        );
        expect(out.category).toBe("Handled"); // falls back to base verdict
    });

    it("does NOT trigger when the payload isn't a time pattern (even if slow)", () => {
        const out = analyzeFinding(
            {
                attackType: "SQL_INJECTION",
                statusCode: 200,
                latencyMs: 9000,
                payload: "' OR 1=1 -- -",
                responseSnippet: "{}",
            },
            baseline({ latencyMs: 120, bodyLength: 1000 }),
        );
        // Not a sleep payload → not time-based. (Length is equal here, so no blind either.)
        expect(out.category).not.toBe("Blind/Time-Based Injection");
    });

    it("does NOT override a confirmed SQL-error disclosure with time-based", () => {
        const out = analyzeFinding(
            {
                attackType: "SQL_INJECTION",
                statusCode: 200,
                latencyMs: 5140,
                payload: "1' AND SLEEP(5)-- -",
                responseSnippet: "You have an error in your SQL syntax near '1'",
            },
            baseline({ latencyMs: 120 }),
        );
        expect(out.category).toBe("SQL Injection"); // stronger, specific verdict kept
        expect(out.severity).toBe("CRITICAL");
    });
});

describe("T6 baseline diffing — blind/boolean via length delta", () => {
    it("raises a firm MEDIUM when a 2xx body differs >=50% from baseline", () => {
        const out = analyzeFinding(
            {
                attackType: "SQL_INJECTION",
                statusCode: 200,
                latencyMs: 100,
                payload: "1 OR 1=1",
                responseSnippet: "{...}",
                bodyLength: 5000,
            },
            baseline({ bodyLength: 1000 }),
        );
        expect(out.category).toBe("Likely Blind Injection");
        expect(out.severity).toBe("MEDIUM");
        expect(out.confidence).toBe("firm");
        expect(out.evidence).toContain("baseline 1000 bytes → attack 5000 bytes");
    });

    it("does NOT trigger when lengths are similar", () => {
        const out = analyzeFinding(
            {
                attackType: "SQL_INJECTION",
                statusCode: 200,
                payload: "1 OR 1=1",
                responseSnippet: "{}",
                bodyLength: 1050,
            },
            baseline({ bodyLength: 1000 }),
        );
        expect(out.category).toBe("Handled");
    });

    it("does NOT trigger on a large ratio but tiny absolute delta (noise floor)", () => {
        const out = analyzeFinding(
            {
                attackType: "SQL_INJECTION",
                statusCode: 200,
                payload: "1 OR 1=1",
                responseSnippet: "ok",
                bodyLength: 20, // 100% bigger than 10 bytes, but only +10 bytes
            },
            baseline({ bodyLength: 10 }),
        );
        expect(out.category).toBe("Handled");
    });

    it("never escalates to CRITICAL on length alone", () => {
        const out = analyzeFinding(
            {
                attackType: "SQL_INJECTION",
                statusCode: 200,
                payload: "1 OR 1=1",
                responseSnippet: "{...}",
                bodyLength: 100000,
            },
            baseline({ bodyLength: 1000 }),
        );
        expect(out.severity).toBe("MEDIUM");
    });
});

describe("T6 baseline diffing — reflected-XSS false-positive reduction", () => {
    const xssInput = {
        attackType: "XSS",
        statusCode: 200,
        payload: "<script>alert(1)</script>",
        responseSnippet: "<div><script>alert(1)</script></div>",
    };

    it("suppresses to LOW/info when the baseline body ALSO echoes the marker", () => {
        const out = analyzeFinding(
            xssInput,
            baseline({ bodySnippet: "<div><script>alert(1)</script></div>" }),
        );
        expect(out.severity).toBe("LOW");
        expect(out.confidence).toBe("info");
        expect(out.evidence).toContain("baseline");
    });

    it("stays confirmed HIGH when the baseline does NOT contain the marker", () => {
        const out = analyzeFinding(
            xssInput,
            baseline({ bodySnippet: "<div>nothing reflected here</div>" }),
        );
        expect(out.category).toBe("Reflected XSS");
        expect(out.severity).toBe("HIGH");
        expect(out.confidence).toBe("confirmed");
    });
});

describe("T6 baseline diffing — 5xx normalization", () => {
    it("downgrades a 5xx when the baseline ALSO 5xx'd (endpoint broken on valid input)", () => {
        const out = analyzeFinding(
            {
                attackType: "SQL_INJECTION",
                statusCode: 500,
                payload: "boundary",
                responseSnippet: "",
            },
            baseline({ status: 500, latencyMs: 80 }),
        );
        expect(out.severity).toBe("LOW");
        expect(out.confidence).toBe("tentative");
        expect(out.evidence).toContain("baseline also errored");
    });

    it("strengthens a 5xx to confirmed when the baseline was healthy 2xx", () => {
        const out = analyzeFinding(
            {
                attackType: "SQL_INJECTION",
                statusCode: 500,
                payload: "boundary",
                responseSnippet: "",
            },
            baseline({ status: 200 }),
        );
        expect(out.category).toBe("Unhandled Server Error");
        expect(out.severity).toBe("CRITICAL"); // unchanged from base (injection type)
        expect(out.confidence).toBe("confirmed");
    });
});

describe("T6 baseline diffing — backward compatibility", () => {
    it("a null baseline yields the exact same finding as no baseline at all", () => {
        const input = {
            attackType: "SQL_INJECTION" as const,
            statusCode: 200,
            latencyMs: 5140,
            payload: "1' AND SLEEP(5)-- -",
            responseSnippet: "{}",
            bodyLength: 5000,
        };
        const noBaseline = analyzeFinding(input);
        const nullBaseline = analyzeFinding(input, null);
        expect(nullBaseline).toEqual(noBaseline);
        expect(nullBaseline.category).toBe("Handled"); // no diffing without a baseline
    });
});

// =============================================================================
// T9 — analyzeFinding tags each finding with an OWASP API Top 10 category.
// Additive: severity/category/confidence assertions above are unchanged.
// =============================================================================

describe("analyzeFinding — owaspCategory (T9, additive)", () => {
    it("SQL error disclosure => API8 (folds under misconfig)", () => {
        const out = analyzeFinding({
            attackType: "SQL_INJECTION",
            statusCode: 200,
            responseSnippet: "You have an error in your SQL syntax near '1'",
        });
        expect(out.category).toBe("SQL Injection"); // unchanged specific name
        expect(out.owaspCategory).toBe("API8_SECURITY_MISCONFIGURATION");
    });

    it("auth-bypass 2xx => API2", () => {
        const out = analyzeFinding({ attackType: "MISSING_AUTH", statusCode: 200, responseSnippet: '{"data":"ok"}' });
        expect(out.owaspCategory).toBe("API2_BROKEN_AUTHENTICATION");
    });

    it("secret leak => API3", () => {
        const out = analyzeFinding({
            attackType: "BOUNDARY",
            statusCode: 200,
            responseSnippet: '{"api_key":"sk_live_abcdef123456"}',
        });
        expect(out.owaspCategory).toBe("API3_BROKEN_OBJECT_PROPERTY_LEVEL_AUTHORIZATION");
    });

    it("oversized-payload 5xx => API4", () => {
        const out = analyzeFinding({ attackType: "OVERSIZED_PAYLOAD", statusCode: 500, responseSnippet: "" });
        expect(out.owaspCategory).toBe("API4_UNRESTRICTED_RESOURCE_CONSUMPTION");
    });

    it("transport failure / clean-handled UNKNOWN => null (Unmapped)", () => {
        expect(analyzeFinding({ attackType: "SQL_INJECTION", statusCode: 0, responseSnippet: "" }).owaspCategory).toBeNull();
        expect(analyzeFinding({ attackType: "UNKNOWN", statusCode: 200, responseSnippet: "{}" }).owaspCategory).toBeNull();
    });
});

// =============================================================================
// T-fix1 — time-based injection detected via the REQUEST TIMEOUT.
//
// A sleep payload can outrun the 10s request timeout (e.g. SLEEP(20)). The
// request is aborted, so latencyMs is 0 and the T6 latency-delta rule can't fire.
// A timeout on a DELAY payload, when the benign baseline was FAST, is strong
// evidence — but every guard must hold or we fall back to today's behavior.
// =============================================================================
describe("T-fix1 — time-based injection on timeout", () => {
    const fastBaseline = {
        status: 200,
        latencyMs: 120,
        bodyLength: 400,
        bodySnippet: "ok",
    };
    // A timed-out request as the worker records it: 408, latency 0.
    const timedOutInput = (over: Partial<FindingInput> = {}): FindingInput => ({
        attackType: "SQL_INJECTION",
        method: "GET",
        statusCode: 408,
        latencyMs: 0,
        payload: "1' AND SLEEP(20)-- ",
        responseSnippet: "",
        timedOut: true,
        ...over,
    });

    it("timeout + sleep payload + fast baseline => time-based injection (CRITICAL for SQLi, firm)", () => {
        const f = analyzeFinding(timedOutInput(), fastBaseline);
        expect(f.category).toBe("Blind/Time-Based Injection");
        expect(f.severity).toBe("CRITICAL"); // attackType is SQL_INJECTION
        expect(f.confidence).toBe("firm");
        expect(f.owaspCategory).toBe("API8_SECURITY_MISCONFIGURATION");
        expect(f.evidence).toContain("timed out");
        expect(f.evidence).toContain("120ms");
        expect(f.remediation.length).toBeGreaterThan(0);
    });

    it("non-SQLi attack type with a delay payload => HIGH (not CRITICAL)", () => {
        const f = analyzeFinding(
            timedOutInput({ attackType: "BOUNDARY" }),
            fastBaseline,
        );
        expect(f.category).toBe("Blind/Time-Based Injection");
        expect(f.severity).toBe("HIGH");
        expect(f.confidence).toBe("firm");
    });

    it("matches the other delay dialects (WAITFOR / pg_sleep / BENCHMARK)", () => {
        for (const payload of [
            "'; WAITFOR DELAY '0:0:20'--",
            "1); SELECT pg_sleep(20)--",
            "1 AND BENCHMARK(10000000,MD5('x'))",
        ]) {
            const f = analyzeFinding(timedOutInput({ payload }), fastBaseline);
            expect(f.category).toBe("Blind/Time-Based Injection");
        }
    });

    // ---- Conservative guards: each of these must fall back to today's result --

    it("timeout + NON-delay payload => stays a Request Error (no injection finding)", () => {
        const f = analyzeFinding(
            timedOutInput({ payload: "' OR '1'='1" }), // injection, but no delay
            fastBaseline,
        );
        expect(f.category).toBe("Request Error");
        expect(f.category).not.toBe("Blind/Time-Based Injection");
        expect(f.severity).not.toBe("CRITICAL");
    });

    it("timeout + sleep payload but NO baseline => no injection finding", () => {
        const f = analyzeFinding(timedOutInput(), null);
        expect(f.category).toBe("Request Error");
    });

    it("timeout + sleep payload but baseline ALSO slow => no injection finding", () => {
        const slowBaseline = { ...fastBaseline, latencyMs: 5000 };
        const f = analyzeFinding(timedOutInput(), slowBaseline);
        expect(f.category).toBe("Request Error");
    });

    it("baseline latency null (unmeasured) => no injection finding", () => {
        const f = analyzeFinding(timedOutInput(), { ...fastBaseline, latencyMs: null });
        expect(f.category).toBe("Request Error");
    });

    it("NOT timed out (e.g. ECONNREFUSED 503) + sleep payload => no injection finding", () => {
        const f = analyzeFinding(
            timedOutInput({ statusCode: 503, timedOut: false }),
            fastBaseline,
        );
        expect(f.category).toBe("Request Error");
    });

    it("timedOut omitted entirely (pre-fix callers) => unchanged behavior", () => {
        const input = timedOutInput();
        delete (input as { timedOut?: boolean }).timedOut;
        const f = analyzeFinding(input, fastBaseline);
        expect(f.category).toBe("Request Error");
    });
});

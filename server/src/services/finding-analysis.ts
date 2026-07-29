// =============================================================================
// Finding Analysis — turns a raw attack result into an explained finding.
//
// Deterministic, rule-based, and FAST: it runs a handful of regexes over data
// we already captured (payload, status, latency, and the response body snippet)
// — no extra requests, microseconds per finding. It confirms real signals
// (SQL/stack-trace disclosure, reflected XSS, path-traversal file reads, auth
// bypass, server crashes) and, for each, produces a human category, title,
// root cause, evidence, and remediation. This is the single source of truth for
// severity — getSeverity() delegates here.
// =============================================================================

import type { SeverityLevel } from "../utils/severity.js";
import type { OwaspApiCategory } from "../types/shared.js";
import { mapFindingToOwasp } from "./owasp-mapping.js";

export type Confidence = "confirmed" | "firm" | "tentative" | "info";

export interface FindingDetail {
    severity: SeverityLevel;
    /** Vulnerability class, e.g. "SQL Injection", "Reflected XSS". */
    category: string;
    /** One-line human summary of what happened. */
    title: string;
    /** Plain-English root cause. */
    cause: string;
    /** The concrete signal that triggered this finding (snippet / status). */
    evidence: string | null;
    /** How to fix this class of issue. */
    remediation: string;
    confidence: Confidence;
    /** OWASP API Top 10 (2023) code (T9) — additive context; null = Unmapped.
     *  Set by analyzeFinding; the internal rule set (analyzeBase) omits it. */
    owaspCategory?: OwaspApiCategory | null;
}

export interface FindingInput {
    attackType: string;
    method?: string;
    statusCode: number;
    latencyMs?: number;
    payload?: string;
    responseSnippet?: string;
    /** Full response body length (bytes) — used for baseline length-delta diffing. */
    bodyLength?: number;
}

/**
 * The endpoint's benign baseline (T5), passed in to enable evidence-based
 * diffing (T6). All fields nullable — a null/undefined baseline means "no
 * control captured", and analyzeFinding then behaves EXACTLY as pre-T6.
 */
export interface BaselineComparison {
    status: number | null;
    latencyMs: number | null;
    bodyLength: number | null;
    bodySnippet: string | null;
}

// ---------------------------------------------------------------------------
// Signal detectors
// ---------------------------------------------------------------------------

// Raw database errors reflected to the client — proof the payload reached SQL.
const SQL_ERROR =
    /(SQL syntax|SQLSTATE\[|ORA-\d{5}|PLS-\d{5}|unclosed quotation mark|unterminated quoted string|quoted string not properly terminated|mysql_fetch|valid MySQL result|You have an error in your SQL|PostgreSQL.{0,25}ERROR|pg_query|psycopg2|SQLite3?::|System\.Data\.SqlClient|Microsoft OLE DB Provider for SQL Server|ODBC.{0,25}SQL Server|Warning.{0,10}mysqli?|SQLITE_ERROR)/i;

// Framework stack traces / unhandled-exception disclosure.
const STACK_TRACE =
    /(Traceback \(most recent call last\)|at [\w$.<>]+\([\w$./\\-]+:\d+:\d+\)|\.(?:java):\d+\)|System\.[\w.]+Exception|(?:\.py|\.rb|\.php)["']?,? line \d+|org\.springframework|werkzeug|node:internal\/|ReferenceError:|TypeError:[^\n]{0,80}\n\s*at |goroutine \d+ \[|panic:)/i;

// Local-file contents (path traversal succeeded).
const FILE_LEAK =
    /(root:.*?:0:0:|daemon:.*?:\/usr\/sbin|\[boot loader\]|\[fonts\]|; for 16-bit app support)/i;

// Secrets / credentials leaking in a response body.
const SECRET_LEAK =
    /(-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----|aws_secret_access_key|"(?:api[_-]?key|secret|password|passwd|access[_-]?token|private[_-]?key)"\s*:\s*"[^"]{6,})/i;

const MINOR_ERROR_WORDS = /(error|exception|stack|invalid|unexpected|traceback)/i;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function truncate(s: string, n: number): string {
    const flat = s.replace(/\s+/g, " ").trim();
    return flat.length > n ? flat.slice(0, n) + "…" : flat;
}

/** Return a cleaned ~140-char window of the response around a regex match. */
function evidenceFor(resp: string, re: RegExp): string | null {
    const m = resp.match(re);
    if (!m || m.index === undefined) return truncate(resp, 140) || null;
    const start = Math.max(0, m.index - 40);
    return truncate(resp.slice(start, m.index + m[0].length + 80), 160);
}

/** True when a meaningful payload appears verbatim (unescaped) in the response. */
function isReflected(payload: string, resp: string): boolean {
    const p = payload.trim();
    if (p.length < 6) return false; // too short to be conclusive
    return resp.includes(p);
}

// ---------------------------------------------------------------------------
// analyzeBase — the ordered rule set (strongest evidence first). This is the
// PRE-T6 behavior verbatim: no baseline is consulted here, so the no-baseline
// path stays byte-identical. Baseline diffing (T6) wraps this in analyzeFinding.
// ---------------------------------------------------------------------------

function analyzeBase(input: FindingInput): FindingDetail {
    const at = (input.attackType || "").toUpperCase();
    const statusCode = input.statusCode ?? 0;
    const latencyMs = input.latencyMs ?? 0;
    const payload = input.payload ?? "";
    const resp = input.responseSnippet ?? "";

    // 1) Path traversal — local file contents disclosed (CONFIRMED, CRITICAL)
    if (FILE_LEAK.test(resp)) {
        return {
            severity: "CRITICAL",
            category: "Path Traversal",
            title: "Local file contents disclosed",
            confidence: "confirmed",
            evidence: evidenceFor(resp, FILE_LEAK),
            cause: "The traversal payload made the API return the contents of a local system file, so user input is used to build a file path without sanitization.",
            remediation: "Never build file paths from user input. Resolve to a canonical path and confine it to an allow-listed base directory; reject '..' and its encoded variants.",
        };
    }

    // 2) Secret / credential leak (CONFIRMED, CRITICAL)
    if (SECRET_LEAK.test(resp)) {
        return {
            severity: "CRITICAL",
            category: "Sensitive Data Exposure",
            title: "Secret or credential exposed in response",
            confidence: "confirmed",
            evidence: evidenceFor(resp, SECRET_LEAK),
            cause: "The response body contained a private key, password, or API secret — sensitive data is being returned to the client.",
            remediation: "Remove secrets from API responses and logs, rotate any exposed credential immediately, and scope tokens to the minimum required.",
        };
    }

    // 3) SQL error reflected — injection reached the database (CONFIRMED, CRITICAL)
    if (SQL_ERROR.test(resp)) {
        return {
            severity: "CRITICAL",
            category: "SQL Injection",
            title: "Database error disclosed — SQL injection surface",
            confidence: "confirmed",
            evidence: evidenceFor(resp, SQL_ERROR),
            cause: "The endpoint returned a raw database error, proving the injected payload reached the SQL engine unsanitized — a working injection point.",
            remediation: "Use parameterized queries / prepared statements (or an ORM binding). Never concatenate user input into SQL, and hide DB errors behind generic messages.",
        };
    }

    // 4) Reflected XSS — payload echoed unescaped (CONFIRMED, HIGH)
    if (
        (at.includes("XSS") || /[<>]|javascript:|onerror|onload/i.test(payload)) &&
        isReflected(payload, resp)
    ) {
        return {
            severity: "HIGH",
            category: "Reflected XSS",
            title: "Payload reflected unescaped in the response",
            confidence: "confirmed",
            evidence: `Injected payload appears verbatim in the response body: ${truncate(payload, 120)}`,
            cause: "User input is written into the response without HTML/JS encoding, so an attacker-supplied script would execute in a victim's browser.",
            remediation: "Apply context-aware output encoding (HTML / attribute / JS contexts), add a Content-Security-Policy, and prefer a framework's auto-escaping.",
        };
    }

    // 5) Auth bypass — an unauthenticated/forged-auth request succeeded (CONFIRMED, CRITICAL)
    if (
        (at.includes("AUTH") || at.includes("BYPASS")) &&
        statusCode >= 200 &&
        statusCode < 300
    ) {
        return {
            severity: "CRITICAL",
            category: "Broken Authentication / Access Control",
            title: `Accepted an auth-bypass request (${statusCode})`,
            confidence: "confirmed",
            evidence: `Returned ${statusCode} to a request with missing / invalid / forged credentials.`,
            cause: "A request without valid credentials was accepted, so this route isn't enforcing authentication or authorization.",
            remediation: "Require and verify auth on this route, validate token signature & expiry, and enforce object-level authorization to prevent IDOR.",
        };
    }

    // 6) Transport failure — the worker maps timeout→408, ECONNREFUSED→503,
    //    ENOTFOUND→502, other→0. These mean "we couldn't reach/complete the
    //    request", NOT "the target crashed on this input", so they must be
    //    classified before the generic 4xx/5xx buckets below.
    if (statusCode === 0 || statusCode === 408 || statusCode === 502 || statusCode === 503) {
        return {
            severity: "INFO",
            category: "Request Error",
            title: "Request could not be completed",
            confidence: "info",
            evidence: `Status ${statusCode || "n/a"}${latencyMs ? ` after ${latencyMs}ms` : ""}.`,
            cause: "The request timed out or the target was unreachable, so this payload couldn't be evaluated.",
            remediation: "Retry when the target is reachable. A consistent timeout on one specific payload can itself hint at a slow / vulnerable code path (e.g. time-based injection).",
        };
    }

    // 7) 5xx server error — crashed on hostile input (FIRM). A leaked stack
    //    trace here makes the crash finding stronger (and is used as evidence)
    //    rather than downgrading it to a mere info-disclosure.
    if (statusCode >= 500) {
        const injectiony = /INJECTION|SQLI|AUTH|TYPE_CONFUSION|OVERSIZED/.test(at);
        const hasTrace = STACK_TRACE.test(resp);
        return {
            severity: injectiony ? "CRITICAL" : "HIGH",
            category: "Unhandled Server Error",
            title: `Server crashed on this input (${statusCode})`,
            confidence: "firm",
            evidence: hasTrace
                ? evidenceFor(resp, STACK_TRACE)
                : `Status ${statusCode}${latencyMs ? ` after ${latencyMs}ms` : ""}.`,
            cause: hasTrace
                ? "The payload triggered an unhandled server error (5xx) and the response leaked an internal stack trace. The input reaches code that isn't validated — an attacker can force errors / DoS, and this often hides a deeper flaw (injection, type confusion)."
                : "The payload triggered an unhandled server error (5xx): the input reaches code that isn't validated. At minimum an attacker can force errors / DoS, and this often hides a deeper flaw (injection, type confusion).",
            remediation: "Validate and type-check inputs at the boundary, handle errors and return a 4xx for bad input instead of a 5xx, and add resource limits for large payloads.",
        };
    }

    // 8) Verbose error / stack-trace disclosure on a NON-5xx response (MEDIUM)
    if (STACK_TRACE.test(resp)) {
        return {
            severity: "MEDIUM",
            category: "Verbose Error / Info Disclosure",
            title: "Server returned an internal stack trace",
            confidence: "firm",
            evidence: evidenceFor(resp, STACK_TRACE),
            cause: "An unhandled exception leaked internal details (framework, file paths, line numbers) that help an attacker map and target the system.",
            remediation: "Return generic error messages to clients, disable debug/verbose errors in production, and log the details server-side only.",
        };
    }

    // 9) 401 / 403 — attack correctly rejected (INFO, good behavior)
    if (statusCode === 401 || statusCode === 403) {
        return {
            severity: "LOW",
            category: "Access Control Enforced",
            title: `Attack rejected with ${statusCode}`,
            confidence: "info",
            evidence: null,
            cause: "The endpoint refused the request (401/403) — expected, healthy behavior for a protected route.",
            remediation: "No action needed. Confirm the same protection covers every sensitive route and HTTP method.",
        };
    }

    // 10) Other 4xx — input rejected; flag if the error leaks internals
    if (statusCode >= 400 && statusCode < 500) {
        const leaks = MINOR_ERROR_WORDS.test(resp);
        return {
            severity: leaks ? "MEDIUM" : "LOW",
            category: leaks ? "Verbose Error / Info Disclosure" : "Input Rejected",
            title: `Payload rejected with ${statusCode}`,
            confidence: leaks ? "tentative" : "info",
            evidence: leaks ? evidenceFor(resp, MINOR_ERROR_WORDS) : null,
            cause: leaks
                ? "The endpoint rejected the payload (4xx), but the error message exposes some internal detail."
                : "The endpoint rejected the malformed / malicious input with a 4xx — input validation is doing its job.",
            remediation: leaks
                ? "Keep rejecting bad input, but return a generic 4xx message without internal details."
                : "No action needed — this is good validation behavior.",
        };
    }

    // 11) 2xx / 3xx handled cleanly — nothing detected (INFO)
    return {
        severity: "INFO",
        category: "Handled",
        title: `Handled without error (${statusCode || "—"})`,
        confidence: "info",
        evidence: null,
        cause: "The endpoint processed the payload and returned a normal response, with no error or data leak in the captured body.",
        remediation: "No action from this check. Absence of an error isn't proof of safety for blind or stored issues.",
    };
}

// ---------------------------------------------------------------------------
// Baseline diffing (T6) — additive enhancement layer.
//
// analyzeFinding runs analyzeBase first (the 11 rules), then — ONLY when a
// benign baseline exists — diffs the attack response against it to: confirm
// time-based/blind injection, normalize baseline-noisy 5xx, and suppress
// reflected-XSS false positives. With no baseline it returns analyzeBase()
// unchanged, so the pre-T6 behavior is preserved byte-for-byte.
// ---------------------------------------------------------------------------

// Time-based confirmation: attack must exceed the baseline by this delta AND be
// slow in absolute terms, so normal jitter can't trip it.
const TIME_BASED_DELTA_MS = 4000;
const TIME_BASED_MIN_ABSOLUTE_MS = 4000;

// Blind/boolean: a body-length change this large (relative) vs baseline is
// "material"; the absolute floor avoids tiny-response noise (e.g. 2→4 bytes).
const BLIND_LEN_DELTA_RATIO = 0.5;
const BLIND_MIN_ABSOLUTE_BYTES = 64;

// A 5xx status range check.
const isServerError = (s: number | null | undefined): boolean =>
    typeof s === "number" && s >= 500;
const is2xx = (s: number | null | undefined): boolean =>
    typeof s === "number" && s >= 200 && s < 300;

// Payloads that induce a server-side delay (time-based / blind injection).
const TIME_INJECTION_PAYLOAD =
    /(SLEEP\s*\(|WAITFOR\s+DELAY|PG_SLEEP\s*\(|BENCHMARK\s*\(|DBMS_LOCK\.SLEEP|DBMS_PIPE\.RECEIVE_MESSAGE|DELAY\s*['"]?\d)/i;

// Base categories that are already CONFIRMED via a body signature — baseline
// diffing must never weaken these (a leaked file / secret / SQL error is proof
// regardless of the control response).
const CONFIRMED_DISCLOSURE = new Set([
    "Path Traversal",
    "Sensitive Data Exposure",
    "SQL Injection",
]);

/** Append a comparison note to an evidence string (or start one). */
function withEvidence(base: string | null, note: string): string {
    return base ? `${base} — ${note}` : note;
}

/**
 * Public entry point. Runs the base rules, then (if a baseline is provided)
 * applies the T6 diff layer. `baseline` null/undefined ⇒ identical to pre-T6.
 */
export function analyzeFinding(
    input: FindingInput,
    baseline?: BaselineComparison | null,
): FindingDetail {
    const base = analyzeBase(input);
    const finding = baseline ? applyBaselineDiff(base, input, baseline) : base;
    // Additive (T9): tag the OWASP API Top 10 category from the FINAL finding's
    // category + attack type. Never mutates severity/category/confidence.
    return { ...finding, owaspCategory: mapFindingToOwasp(finding, input.attackType) };
}

function applyBaselineDiff(
    base: FindingDetail,
    input: FindingInput,
    baseline: BaselineComparison,
): FindingDetail {
    const at = (input.attackType || "").toUpperCase();
    const payload = input.payload ?? "";
    const attackLatency = input.latencyMs ?? 0;
    const attackLen = input.bodyLength;

    // --- Reflected-XSS false-positive reduction --------------------------------
    // If the endpoint already echoes this value for the benign baseline, the
    // reflection isn't caused by OUR input → suppress to LOW/info. Otherwise,
    // strengthen the evidence (genuinely reflected because of our payload).
    if (base.category === "Reflected XSS") {
        const marker = payload.trim();
        const baselineEchoes =
            marker.length >= 6 &&
            !!baseline.bodySnippet &&
            baseline.bodySnippet.includes(marker);
        if (baselineEchoes) {
            return {
                ...base,
                severity: "LOW",
                confidence: "info",
                title: "Reflected value also present in the baseline response",
                cause: "The endpoint returns this value even for a benign baseline request, so the reflection is not attributable to our injected input — most likely not exploitable reflected XSS.",
                evidence: withEvidence(
                    base.evidence,
                    "the same marker appears in the baseline response, so the echo is not caused by our input",
                ),
            };
        }
        return {
            ...base,
            evidence: withEvidence(
                base.evidence,
                "marker is NOT present in the baseline response, so the reflection is caused by our input",
            ),
        };
    }

    // --- Time-based / blind injection (CONFIRMED) ------------------------------
    // A sleep-style payload that made the response markedly slower than the
    // baseline is strong, confirmable evidence. Skip when the base is already a
    // confirmed disclosure (that verdict is more specific and must not be lost).
    const baselineLatency = baseline.latencyMs ?? 0;
    const latencyDelta = attackLatency - baselineLatency;
    const timeBased =
        TIME_INJECTION_PAYLOAD.test(payload) &&
        latencyDelta >= TIME_BASED_DELTA_MS &&
        attackLatency >= TIME_BASED_MIN_ABSOLUTE_MS;
    if (timeBased && !CONFIRMED_DISCLOSURE.has(base.category)) {
        const injectionType = /INJECTION|SQLI/.test(at);
        return {
            severity: injectionType ? "CRITICAL" : "HIGH",
            category: "Blind/Time-Based Injection",
            title: "Time-based injection confirmed (payload delayed the response)",
            confidence: "confirmed",
            evidence: `A delay payload made the endpoint respond far slower than its baseline: baseline ${baselineLatency}ms → attack ${attackLatency}ms.`,
            cause: "A time-injection payload (e.g. SLEEP/WAITFOR/pg_sleep) measurably delayed the response versus the benign baseline, proving attacker input reaches a query/interpreter that executes it — a working blind injection point.",
            remediation: "Use parameterized queries / prepared statements and reject untrusted input in query construction. Add query timeouts and monitor for anomalous latency.",
        };
    }

    // --- 5xx normalization -----------------------------------------------------
    if (base.category === "Unhandled Server Error") {
        if (isServerError(baseline.status)) {
            // The endpoint 5xxes even for a benign request → not attributable.
            return {
                ...base,
                severity: "LOW",
                confidence: "tentative",
                title: "Server error, but the baseline also errors on valid input",
                cause: "The endpoint returned a 5xx, but its benign baseline request ALSO returned a 5xx, so this error is not attributable to our attack (the endpoint appears broken on normal input).",
                evidence: withEvidence(
                    base.evidence,
                    `baseline also errored (status ${baseline.status}), so the 5xx is not attack-attributable`,
                ),
            };
        }
        if (is2xx(baseline.status)) {
            // Baseline was healthy → our input caused the crash. Strengthen.
            return {
                ...base,
                confidence: "confirmed",
                evidence: withEvidence(
                    base.evidence,
                    `baseline responded ${baseline.status} but our payload triggered ${input.statusCode} — the crash is attributable to our input`,
                ),
            };
        }
        return base;
    }

    // --- Blind/boolean via body-length delta (conservative: firm MEDIUM) --------
    // Only for injection-type attacks that returned a clean 2xx (base "Handled")
    // with no error signature, where the body size differs materially from the
    // baseline. Never over-claims CRITICAL on length alone.
    if (base.category === "Handled" && /INJECTION|SQLI/.test(at)) {
        if (
            is2xx(input.statusCode) &&
            typeof attackLen === "number" &&
            typeof baseline.bodyLength === "number"
        ) {
            const baseLen = baseline.bodyLength;
            const absDelta = Math.abs(attackLen - baseLen);
            const ratio = absDelta / Math.max(baseLen, 1);
            if (ratio >= BLIND_LEN_DELTA_RATIO && absDelta >= BLIND_MIN_ABSOLUTE_BYTES) {
                return {
                    severity: "MEDIUM",
                    category: "Likely Blind Injection",
                    title: "Response differs materially from baseline (possible blind injection)",
                    confidence: "firm",
                    evidence: `Injected payload produced a 2xx whose body size differs materially from the baseline: baseline ${baseLen} bytes → attack ${attackLen} bytes (${Math.round(ratio * 100)}% change).`,
                    cause: "The endpoint returned success but a materially different response size than the benign baseline for an injection payload, which can indicate a boolean/blind injection altering query results. No error was disclosed, so this is not conclusive on its own.",
                    remediation: "Confirm with paired true/false injection probes. Use parameterized queries and validate input types/lengths at the boundary.",
                };
            }
        }
        return base;
    }

    return base;
}

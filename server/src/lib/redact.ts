// =============================================================================
// Secret redaction for STORED / BROADCAST response bytes.
//
// The attack worker captures raw target response bytes to feed the detection
// layer (finding-analysis.ts). Detection must see the RAW text so signal
// regexes (SECRET_LEAK / FILE_LEAK / SQL_ERROR / XSS / STACK_TRACE) fire, but we
// must never PERSIST or FORWARD a real secret. redactSecrets() runs over the
// snippet/evidence just before it is written to the DB or sent to the browser.
//
// It masks the VALUE and keeps the surrounding key/marker (e.g.
// `"api_key":"***REDACTED***"`), so the evidence stays meaningful — and, because
// the key name survives, read-time re-detection on the stored snippet still
// classifies the finding the same way.
//
// This is intentionally string-based and standalone. The pino logger's
// `redact` option is a different mechanism (object-path masking on structured
// log records), so there is nothing to share between the two.
// =============================================================================

export const REDACTED = "***REDACTED***";

// Keys whose values are sensitive, in JSON (`"key":"val"`) and query/form
// (`key=val`) shapes. Kept as one source list so both forms stay in sync.
const SENSITIVE_KEY =
    "api[_-]?key|secret|password|passwd|access[_-]?token|refresh[_-]?token|private[_-]?key|client[_-]?secret|token|authorization";

// -----------------------------------------------------------------------------
// Patterns (evaluated in order; earlier, more-specific ones win).
// -----------------------------------------------------------------------------

// PEM private-key blocks (multi-line) — collapse the whole block.
const PRIVATE_KEY_BLOCK =
    /-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----/gi;

// JWTs: three base64url segments starting with the `eyJ` header marker.
const JWT = /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g;

// `Bearer <token>` (any non-JWT opaque bearer credential).
const BEARER = /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi;

// Sensitive value in a JSON object: `"api_key" : "value"` → keep the key.
const JSON_SECRET = new RegExp(
    `("(?:${SENSITIVE_KEY})"\\s*:\\s*)"[^"]*"`,
    "gi",
);

// Sensitive value in a query string / form body: `api_key=value` → keep the key.
const QUERY_SECRET = new RegExp(
    `\\b(${SENSITIVE_KEY})=([^&\\s"']+)`,
    "gi",
);

// Email addresses.
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

/**
 * Mask secrets/PII in a string while preserving structure (key names, markers)
 * so it stays useful as evidence. Safe to call on any text; returns the input
 * unchanged when there is nothing to redact.
 */
export function redactSecrets(text: string): string {
    if (!text) return text;

    return text
        .replace(PRIVATE_KEY_BLOCK, `-----BEGIN PRIVATE KEY-----${REDACTED}-----END PRIVATE KEY-----`)
        .replace(JWT, REDACTED)
        .replace(BEARER, `Bearer ${REDACTED}`)
        .replace(JSON_SECRET, `$1"${REDACTED}"`)
        .replace(QUERY_SECRET, `$1=${REDACTED}`)
        .replace(EMAIL, REDACTED);
}

/** Redact when the input may be null/undefined; passes null/undefined through. */
export function redactSecretsNullable(
    text: string | null | undefined,
): string | null | undefined {
    return text == null ? text : redactSecrets(text);
}

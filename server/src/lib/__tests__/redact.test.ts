// =============================================================================
// Tests for redactSecrets() and the core T3 invariant: detection runs on the
// RAW body, but the value that would be STORED is redacted — and re-detecting
// on the redacted value still classifies the finding the same way.
// =============================================================================

import { describe, it, expect } from "vitest";
import { redactSecrets, redactSecretsNullable, REDACTED } from "../redact.js";
import { analyzeFinding } from "../../services/finding-analysis.js";

describe("redactSecrets — masks each secret type, keeps structure", () => {
    it("masks a JWT (eyJ… three-part)", () => {
        const jwt =
            "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U";
        const out = redactSecrets(`token is ${jwt} end`);
        expect(out).not.toContain("eyJhbGci");
        expect(out).toContain(REDACTED);
    });

    it("masks a Bearer token but keeps the Bearer marker", () => {
        const out = redactSecrets("Authorization: Bearer abc123OPAQUEtokenXYZ");
        expect(out).not.toContain("abc123OPAQUEtokenXYZ");
        expect(out).toContain("Bearer ***REDACTED***");
    });

    it("masks an api_key JSON value, keeps the key name", () => {
        const out = redactSecrets('{"api_key":"sk_live_abcdef123456"}');
        expect(out).not.toContain("sk_live_abcdef123456");
        expect(out).toContain('"api_key"');
        expect(out).toContain(`"api_key":"${REDACTED}"`);
    });

    it("masks password / secret / token / authorization JSON values", () => {
        const out = redactSecrets(
            '{"password":"hunter2pw","secret":"topsecretvalue","token":"tok_abcdef","authorization":"Basic Zm9vOmJhcg=="}',
        );
        for (const leaked of ["hunter2pw", "topsecretvalue", "tok_abcdef", "Zm9vOmJhcg"]) {
            expect(out).not.toContain(leaked);
        }
        // Key names preserved so evidence stays meaningful.
        for (const key of ['"password"', '"secret"', '"token"', '"authorization"']) {
            expect(out).toContain(key);
        }
    });

    it("masks values in a query string / form body, keeps the key", () => {
        const out = redactSecrets("GET /cb?api_key=leakedKEY123&user=bob&token=zzz999");
        expect(out).not.toContain("leakedKEY123");
        expect(out).not.toContain("zzz999");
        expect(out).toContain(`api_key=${REDACTED}`);
        expect(out).toContain(`token=${REDACTED}`);
        expect(out).toContain("user=bob"); // non-secret field untouched
    });

    it("masks a PEM private-key block", () => {
        const pem =
            "-----BEGIN RSA PRIVATE KEY-----\nMIIBOgIBAAJBAKjZ7kF9secretbytes\nAB12CD34\n-----END RSA PRIVATE KEY-----";
        const out = redactSecrets(`leaked: ${pem}`);
        expect(out).not.toContain("MIIBOgIBAAJBAKjZ7kF9secretbytes");
        expect(out).toContain(REDACTED);
        expect(out).toContain("BEGIN PRIVATE KEY");
    });

    it("masks email addresses", () => {
        const out = redactSecrets("Contact alice.smith@example.co.uk for access");
        expect(out).not.toContain("alice.smith@example.co.uk");
        expect(out).toContain(REDACTED);
    });

    it("returns input unchanged when there is nothing to redact", () => {
        const clean = "just a normal 200 OK response body {\"ok\":true}";
        expect(redactSecrets(clean)).toBe(clean);
    });

    it("redactSecretsNullable passes null/undefined through", () => {
        expect(redactSecretsNullable(null)).toBeNull();
        expect(redactSecretsNullable(undefined)).toBeUndefined();
        expect(redactSecretsNullable('{"api_key":"leak123456"}')).toContain(REDACTED);
    });
});

describe("T3 invariant — detect on RAW, store REDACTED", () => {
    // A response that carries BOTH a fake API key (secret) and a SQL error.
    const rawBody =
        '{"api_key":"sk_live_SUPERSECRET999","note":"You have an error in your SQL syntax near \'1\'"}';

    it("(a) analyzeFinding on the RAW body still fires SECRET_LEAK", () => {
        const finding = analyzeFinding({
            attackType: "SQL_INJECTION",
            statusCode: 200,
            responseSnippet: rawBody, // RAW input, as the worker feeds it
        });
        // SECRET_LEAK (rule 2) wins over SQL_ERROR (rule 3) by ordering.
        expect(finding.category).toBe("Sensitive Data Exposure");
        expect(finding.severity).toBe("CRITICAL");
        expect(finding.confidence).toBe("confirmed");
    });

    it("(b) the value that would be STORED is redacted (secret gone, SQL signal kept)", () => {
        const stored = redactSecrets(rawBody);
        expect(stored).not.toContain("sk_live_SUPERSECRET999");
        expect(stored).toContain(REDACTED);
        // The SQL error string is not a secret and must survive redaction.
        expect(stored).toContain("You have an error in your SQL syntax");
    });

    it("re-detecting on the REDACTED stored snippet still classifies as SECRET_LEAK", () => {
        // Read paths re-run analyzeFinding on the stored (redacted) snippet; the
        // key name survives redaction so classification is unchanged.
        const stored = redactSecrets(rawBody);
        const finding = analyzeFinding({
            attackType: "SQL_INJECTION",
            statusCode: 200,
            responseSnippet: stored,
        });
        expect(finding.category).toBe("Sensitive Data Exposure");
        expect(finding.severity).toBe("CRITICAL");
    });
});

// =============================================================================
// Auth Runner (T8a) — obtain a token at scan time for DYNAMIC credential types.
//
//   - oauth2ClientCredentials: POST the token URL with grant_type=client_
//     credentials and read the access token from the JSON response.
//   - loginRequest: fire a user-defined request (with {{placeholder}} values
//     substituted from the encrypted secret) and extract the token via a
//     dot-path or a /regex/.
//
// Every outbound request goes THROUGH the SSRF guard (block private/loopback/
// metadata) and a 10s timeout, exactly like attack requests. This module NEVER
// logs the secret, the request body, or the resulting token — it only throws a
// typed AuthRunnerError with a safe message (status / reason, no secrets). The
// caller logs recipe id/type + success/failure.
// =============================================================================

import { assertNotSSRF } from "../lib/ssrf-guard.js";
import type { AttachedCredential } from "./request-builder.js";

const LOGIN_TIMEOUT_MS = 10_000;

/** Typed, safe-to-surface error — never contains a secret/token/body. */
export class AuthRunnerError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "AuthRunnerError";
    }
}

export interface DynamicRecipeInput {
    type: "loginRequest" | "oauth2ClientCredentials";
    meta: Record<string, unknown>;
    /** Decrypted secret fields (never persisted/logged in plaintext elsewhere). */
    secret: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** SSRF-guard + fetch with a hard 10s timeout. Throws AuthRunnerError on block. */
async function guardedFetch(url: string, init: RequestInit): Promise<Response> {
    try {
        await assertNotSSRF(url);
    } catch {
        throw new AuthRunnerError("auth endpoint blocked: resolves to a private/internal address");
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), LOGIN_TIMEOUT_MS);
    try {
        return await fetch(url, { ...init, signal: controller.signal, redirect: "follow" });
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("AbortError") || msg.includes("timeout")) {
            throw new AuthRunnerError(`auth endpoint timed out after ${LOGIN_TIMEOUT_MS}ms`);
        }
        throw new AuthRunnerError("auth endpoint unreachable");
    } finally {
        clearTimeout(timeout);
    }
}

/** Parse injectAs ("bearer" | "header:<Name>") into a credential shape. */
function parseInjectAs(
    injectAs: string,
): { type: "bearer" } | { type: "header"; headerName: string } {
    const v = (injectAs || "bearer").trim();
    if (v.toLowerCase() === "bearer") return { type: "bearer" };
    if (v.toLowerCase().startsWith("header:")) {
        const name = v.slice("header:".length).trim();
        if (name) return { type: "header", headerName: name };
    }
    return { type: "bearer" }; // safe fallback
}

/** Build the AttachedCredential from the injection target + resolved token. */
function credentialFrom(injectAs: string, token: string): AttachedCredential {
    const inject = parseInjectAs(injectAs);
    return inject.type === "bearer"
        ? { type: "bearer", secret: token }
        : { type: "header", secret: token, headerName: inject.headerName };
}

/**
 * Substitute {{placeholder}} tokens in a JSON body template with values from the
 * secret map. Values are JSON-escaped so quotes/backslashes can't break the JSON
 * (the template's surrounding quotes stay valid).
 */
export function substitutePlaceholders(
    template: string,
    secret: Record<string, string>,
): string {
    return template.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_m, key: string) => {
        const val = secret[key];
        if (val == null) return "";
        // JSON.stringify then strip the surrounding quotes → escaped inner text.
        return JSON.stringify(String(val)).slice(1, -1);
    });
}

/**
 * Extract a token from a response body via a dot-path (into parsed JSON) OR a
 * /regex/ (against the raw text). Returns null when nothing matches.
 */
export function extractToken(rawBody: string, tokenPath: string): string | null {
    const p = (tokenPath || "").trim();
    if (!p) return null;

    // Regex form: /pattern/flags
    const rx = p.match(/^\/(.*)\/([a-z]*)$/is);
    if (rx) {
        let re: RegExp;
        try {
            re = new RegExp(rx[1]!, rx[2]);
        } catch {
            return null;
        }
        const m = rawBody.match(re);
        if (!m) return null;
        return m[1] ?? m[0] ?? null; // prefer capture group 1
    }

    // Dot-path into parsed JSON
    let json: any;
    try {
        json = JSON.parse(rawBody);
    } catch {
        return null;
    }
    let cur: any = json;
    for (const seg of p.split(".")) {
        if (cur == null || typeof cur !== "object") return null;
        cur = cur[seg];
    }
    if (cur == null) return null;
    return typeof cur === "string" ? cur : String(cur);
}

// ---------------------------------------------------------------------------
// Main entry
// ---------------------------------------------------------------------------

/**
 * Resolve a dynamic credential to a concrete AttachedCredential (bearer/header)
 * by obtaining a token from the configured endpoint. Throws AuthRunnerError on
 * any failure (SSRF block, non-2xx, missing token) with a safe message.
 */
export async function resolveDynamicCredential(
    input: DynamicRecipeInput,
): Promise<AttachedCredential> {
    if (input.type === "oauth2ClientCredentials") {
        return resolveOAuth2(input.meta, input.secret);
    }
    return resolveLoginRequest(input.meta, input.secret);
}

async function resolveOAuth2(
    meta: Record<string, unknown>,
    secret: Record<string, string>,
): Promise<AttachedCredential> {
    const tokenUrl = String(meta.tokenUrl ?? "");
    const clientId = String(meta.clientId ?? "");
    const clientSecret = secret.clientSecret;
    if (!tokenUrl || !clientId || !clientSecret) {
        throw new AuthRunnerError("oauth2 recipe is missing tokenUrl / clientId / clientSecret");
    }

    const params = new URLSearchParams();
    params.set("grant_type", "client_credentials");
    params.set("client_id", clientId);
    params.set("client_secret", clientSecret);
    if (meta.scope) params.set("scope", String(meta.scope));

    const res = await guardedFetch(tokenUrl, {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Accept: "application/json",
            "User-Agent": "Onyx/1.0 (Security Testing)",
        },
        body: params.toString(),
    });
    if (!res.ok) throw new AuthRunnerError(`token endpoint returned ${res.status}`);

    let json: any;
    try {
        json = await res.json();
    } catch {
        throw new AuthRunnerError("token endpoint returned a non-JSON response");
    }
    const field = String(meta.tokenResponseField ?? "access_token");
    const token = json?.[field];
    if (typeof token !== "string" || token.length === 0) {
        throw new AuthRunnerError(`token field "${field}" missing in token response`);
    }
    return credentialFrom(String(meta.injectAs ?? "bearer"), token);
}

async function resolveLoginRequest(
    meta: Record<string, unknown>,
    secret: Record<string, string>,
): Promise<AttachedCredential> {
    const url = String(meta.url ?? "");
    const method = String(meta.method ?? "POST").toUpperCase();
    const bodyTemplate = String(meta.bodyTemplate ?? "");
    const tokenPath = String(meta.tokenPath ?? "");
    const injectAs = String(meta.injectAs ?? "");
    if (!url || !bodyTemplate || !tokenPath || !injectAs) {
        throw new AuthRunnerError("loginRequest recipe is missing url / bodyTemplate / tokenPath / injectAs");
    }

    const body = substitutePlaceholders(bodyTemplate, secret);
    const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent": "Onyx/1.0 (Security Testing)",
        ...((meta.headers as Record<string, string> | undefined) ?? {}),
    };

    const res = await guardedFetch(url, {
        method,
        headers,
        body: method === "GET" ? undefined : body,
    });
    if (!res.ok) throw new AuthRunnerError(`login endpoint returned ${res.status}`);

    const text = await res.text().catch(() => "");
    const token = extractToken(text, tokenPath);
    if (!token) throw new AuthRunnerError("could not extract a token from the login response");

    return credentialFrom(injectAs, token);
}

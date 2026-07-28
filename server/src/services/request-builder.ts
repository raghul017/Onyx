// =============================================================================
// Request Builder — decides WHERE an attack payload goes.
//
// Before T4 the worker only ever put the payload in a JSON body on POST/PUT/PATCH
// and fired GET/DELETE with a bare path — so query/path/header params were never
// tested and `{id}`-style placeholders were sent literally. This builder resolves
// path placeholders and injects the payload into the appropriate location(s)
// (path / query / header / body) based on the endpoint's declared parameters and
// the attack type, keeping the strict contract: ONE payload => ONE request.
//
// It never mutates job/detection state; it just returns a ready-to-send request
// ({ url, method, headers, body }). The worker still runs the SSRF guard on the
// returned url, applies the 10s timeout, and redacts what it stores.
// =============================================================================

import type { ParsedParameterInput } from "../validators/schemas.js";

export interface BuildAttackRequestInput {
    method: string;
    path: string;
    baseUrl: string;
    payload: string;
    attackType: string;
    parameters?: ParsedParameterInput[];
    requestBodySchema?: Record<string, unknown> | null;
}

export interface BuiltAttackRequest {
    url: string;
    method: string;
    headers: Record<string, string>;
    body?: string;
}

const USER_AGENT = "Onyx/1.0 (Security Testing)";

// Attack types whose payload is a hostile VALUE meant to land in an injectable
// input (path/query/header/body string).
const INJECTION_TYPES = new Set([
    "SQL_INJECTION",
    "XSS",
    "PATH_TRAVERSAL",
    "TYPE_CONFUSION",
    "BOUNDARY",
]);

// Volume/abuse attacks: the payload IS the stress. Prefer a body; fall back to a
// query param when the method has no body.
const VOLUME_TYPES = new Set(["OVERSIZED_PAYLOAD", "RATE_LIMIT"]);

const BODY_METHODS = new Set(["POST", "PUT", "PATCH"]);

// Header names we must not clobber — fetch manages these, and overwriting them
// would corrupt the request rather than test the target.
const FORBIDDEN_HEADERS = new Set([
    "host",
    "content-length",
    "content-type",
    "connection",
    "transfer-encoding",
    "keep-alive",
    "user-agent",
]);

/** True when the string already looks like a JSON object/array literal. */
function isJsonLike(str: string): boolean {
    const trimmed = str.trim();
    return (
        (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
        (trimmed.startsWith("[") && trimmed.endsWith("]"))
    );
}

/** A benign, valid-ish placeholder value for a non-injected param, by schema type. */
function dummyForSchema(schema: Record<string, unknown> | null | undefined): string {
    const type = schema?.type;
    if (type === "integer" || type === "number") return "1";
    if (type === "boolean") return "true";
    // Strings / unknown: "1" is a safe, universally-valid path/query segment.
    return "1";
}

/**
 * Build the concrete HTTP request for one attack payload. Pure and synchronous.
 */
export function buildAttackRequest(
    input: BuildAttackRequestInput,
): BuiltAttackRequest {
    const method = (input.method || "GET").toUpperCase();
    const attackType = (input.attackType || "").toUpperCase();
    const payload = input.payload ?? "";
    const parameters = input.parameters ?? [];

    const isInjection = INJECTION_TYPES.has(attackType);
    const isVolume = VOLUME_TYPES.has(attackType);
    const hasBody = BODY_METHODS.has(method);

    const pathParams = parameters.filter((p) => p.in === "path");
    const queryParams = parameters.filter((p) => p.in === "query");
    const headerParams = parameters.filter((p) => p.in === "header");

    // Track whether the payload actually landed somewhere, so injection attacks
    // on param-less GET/DELETE endpoints still carry the payload (synthetic query).
    let injectedSomewhere = false;

    // --- Path: ALWAYS resolve every {placeholder} so no literal braces are sent.
    const resolvedPath = input.path.replace(/\{([^}]+)\}/g, (_m, rawName) => {
        const name = String(rawName).trim();
        const def = pathParams.find((p) => p.name === name);
        // Injection attacks target path params; everything else gets a dummy so
        // the route stays valid.
        if (isInjection) {
            injectedSomewhere = true;
            return encodeURIComponent(payload);
        }
        return encodeURIComponent(dummyForSchema(def?.schema));
    });

    // --- Query params
    const queryPairs: Array<[string, string]> = [];
    for (const p of queryParams) {
        if (isInjection) {
            queryPairs.push([p.name, payload]);
            injectedSomewhere = true;
        } else if (isVolume && !hasBody) {
            // Volume attack with no body → carry the payload in the query.
            queryPairs.push([p.name, payload]);
            injectedSomewhere = true;
        } else if (p.required) {
            // Keep required params present (dummy) so the request is valid, but
            // don't inject a payload (MISSING_AUTH / dummy path).
            queryPairs.push([p.name, dummyForSchema(p.schema)]);
        }
    }

    // --- Body (preserve today's behavior exactly: payload as JSON body on
    //     POST/PUT/PATCH; wrap non-JSON as { data: payload }).
    let body: string | undefined;
    const headers: Record<string, string> = { "User-Agent": USER_AGENT };
    if (hasBody) {
        headers["Content-Type"] = "application/json";
        body = isJsonLike(payload) ? payload : JSON.stringify({ data: payload });
        // MISSING_AUTH also sent a body today; keep that. For injection/volume the
        // body carries the payload, so it counts as an injection site.
        if (isInjection || isVolume) injectedSomewhere = true;
    }

    // --- Header params (injection only sets custom headers).
    if (isInjection) {
        for (const p of headerParams) {
            if (FORBIDDEN_HEADERS.has(p.name.toLowerCase())) continue;
            headers[p.name] = payload;
            injectedSomewhere = true;
        }
    }

    // --- Fallback: an injection/volume attack on an endpoint with no body and no
    //     injectable params would otherwise fire a bare request. Attach the
    //     payload as a synthetic query param so GET/DELETE are actually tested.
    if ((isInjection || (isVolume && !hasBody)) && !injectedSomewhere) {
        queryPairs.push(["data", payload]);
        injectedSomewhere = true;
    }

    // --- Assemble URL
    const base = input.baseUrl.replace(/\/+$/, "");
    const p = resolvedPath.startsWith("/") ? resolvedPath : `/${resolvedPath}`;
    let url = `${base}${p}`;
    if (queryPairs.length > 0) {
        const qs = queryPairs
            .map(
                ([k, v]) =>
                    `${encodeURIComponent(k)}=${encodeURIComponent(v)}`,
            )
            .join("&");
        url += (url.includes("?") ? "&" : "?") + qs;
    }

    return { url, method, headers, body };
}

// =============================================================================
// Benign (baseline) request — a clean control request with NO attack payload.
//
// Used by T5 baseline capture: fills path placeholders and required query params
// with schema-valid dummy values and, for body methods, sends a schema-shaped
// dummy JSON body. Reuses the same dummy-value logic as the attack path so the
// two stay consistent. Never contains an attack payload.
// =============================================================================

export interface BuildBenignRequestInput {
    method: string;
    path: string;
    baseUrl: string;
    parameters?: ParsedParameterInput[];
    requestBodySchema?: Record<string, unknown> | null;
}

/** Build a schema-shaped dummy JSON body from an object requestBodySchema. */
function buildDummyBody(
    schema: Record<string, unknown> | null | undefined,
): string {
    if (schema && schema.type === "object" && schema.properties) {
        const props = schema.properties as Record<string, Record<string, unknown>>;
        const obj: Record<string, unknown> = {};
        for (const [key, propSchema] of Object.entries(props)) {
            const type = propSchema?.type;
            if (type === "integer" || type === "number") obj[key] = 1;
            else if (type === "boolean") obj[key] = true;
            else if (type === "array") obj[key] = [];
            else if (type === "object") obj[key] = {};
            else obj[key] = "test";
        }
        return JSON.stringify(obj);
    }
    // No usable schema — an empty JSON object is a safe, valid control body.
    return "{}";
}

export function buildBenignRequest(
    input: BuildBenignRequestInput,
): BuiltAttackRequest {
    const method = (input.method || "GET").toUpperCase();
    const parameters = input.parameters ?? [];
    const hasBody = BODY_METHODS.has(method);

    const pathParams = parameters.filter((p) => p.in === "path");
    const queryParams = parameters.filter((p) => p.in === "query");

    // Resolve every {placeholder} with a benign dummy — never a payload.
    const resolvedPath = input.path.replace(/\{([^}]+)\}/g, (_m, rawName) => {
        const name = String(rawName).trim();
        const def = pathParams.find((p) => p.name === name);
        return encodeURIComponent(dummyForSchema(def?.schema));
    });

    // Include required query params (dummy values) so the control request is
    // valid; omit optional ones to keep it minimal.
    const queryPairs: Array<[string, string]> = [];
    for (const p of queryParams) {
        if (p.required) queryPairs.push([p.name, dummyForSchema(p.schema)]);
    }

    const headers: Record<string, string> = { "User-Agent": USER_AGENT };
    let body: string | undefined;
    if (hasBody) {
        headers["Content-Type"] = "application/json";
        body = buildDummyBody(input.requestBodySchema);
    }

    const base = input.baseUrl.replace(/\/+$/, "");
    const p = resolvedPath.startsWith("/") ? resolvedPath : `/${resolvedPath}`;
    let url = `${base}${p}`;
    if (queryPairs.length > 0) {
        const qs = queryPairs
            .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
            .join("&");
        url += (url.includes("?") ? "&" : "?") + qs;
    }

    return { url, method, headers, body };
}

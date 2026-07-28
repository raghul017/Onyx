// =============================================================================
// OpenAPI Spec Parser Service
// =============================================================================

import SwaggerParser from "swagger-parser";
import axios from "axios";
import { assertNotSSRF } from "../lib/ssrf-guard.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ParsedEndpoint {
    method: string; // uppercase: GET, POST, etc.
    path: string;
    operationId: string | undefined;
    requestBodySchema: Record<string, unknown> | null;
    parameters: ParsedParameter[];
    /** Auth this endpoint expects, per the spec's security + securitySchemes.
     *  Display-only (T7a): lets us show "this endpoint expects a bearer token".
     *  Empty when the spec declares no security for the operation. */
    authRequirements: AuthRequirement[];
}

export interface ParsedParameter {
    name: string;
    in: "query" | "header" | "path" | "cookie";
    required: boolean;
    schema: Record<string, unknown> | null;
}

/** A compact, non-secret descriptor of one auth scheme an endpoint requires. */
export interface AuthRequirement {
    /** The scheme name as referenced in the spec's `security` (e.g. "bearerAuth"). */
    scheme: string;
    /** Normalized type: "http" | "apiKey" | "oauth2" | "openIdConnect" | "unknown". */
    type: string;
    /** For http schemes: "bearer" | "basic" | etc. */
    httpScheme?: string;
    /** For apiKey schemes: "header" | "query" | "cookie". */
    in?: string;
    /** For apiKey schemes: the header/query/cookie name carrying the key. */
    name?: string;
}

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

const SUPPORTED_METHODS = ["get", "post", "put", "delete", "patch"] as const;

/**
 * Fetches and parses an OpenAPI/Swagger specification from a URL.
 * Returns an array of parsed endpoints with their schemas.
 */
export async function parseOpenApiSpec(
    specUrl: string,
): Promise<ParsedEndpoint[]> {
    let api: any;

    try {
        // SSRF guard — resolve DNS and block internal IPs before fetching
        await assertNotSSRF(specUrl);

        // Pre-validate & bypass WAF: attempt to download the spec mimicking a real browser
        // This also enforces a strict 8-second timeout, protecting against hanging requests
        const response = await axios.get(specUrl, {
            headers: {
                Accept: "application/json, text/plain, */*",
                "User-Agent":
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
                "Accept-Encoding": "gzip, deflate, br",
            },
            timeout: 8000,
        });

        // swagger-parser handles both Swagger 2.0 and OpenAPI 3.x
        // We pass the deeply parsed JSON object if axios successfully parsed it.
        // If it's YAML (a string), we pass the specUrl instead so swagger-parser fetches it.
        if (typeof response.data === "object" && response.data !== null) {
            api = await (SwaggerParser as any).validate(response.data);
        } else {
            api = await (SwaggerParser as any).validate(specUrl);
        }
    } catch (err: any) {
        const message = err instanceof Error ? err.message : String(err);

        // Map axios errors (WAF block, timeout) to OpenApiParserError
        if (err.isAxiosError) {
            if (err.code === "ECONNABORTED") {
                throw new OpenApiParserError(
                    `Failed to fetch spec from ${specUrl}: Server took longer than 8 seconds to respond`,
                    "NETWORK_ERROR",
                );
            }
            throw new OpenApiParserError(
                err.response
                    ? `The spec URL returned HTTP ${err.response.status}. Ensure it is publicly accessible and allows external API requests.`
                    : "Could not connect to the provided URL. Ensure it is publicly accessible and reachable.",
                "NETWORK_ERROR", // Mapping to existing error codes
            );
        }

        if (message.includes("ENOTFOUND") || message.includes("ECONNREFUSED")) {
            throw new OpenApiParserError(
                `Failed to fetch spec from ${specUrl}: Network error`,
                "NETWORK_ERROR",
            );
        }

        if (
            message.includes("is not a valid Swagger") ||
            message.includes("is not a valid OpenAPI")
        ) {
            throw new OpenApiParserError(
                `Invalid OpenAPI/Swagger specification: ${message}`,
                "INVALID_SPEC",
            );
        }

        throw new OpenApiParserError(
            `Failed to parse spec: ${message}`,
            "PARSE_ERROR",
        );
    }

    const endpoints: ParsedEndpoint[] = [];
    const paths = api.paths || {};

    // Build the scheme lookup once (OpenAPI 3 components.securitySchemes OR
    // Swagger 2 securityDefinitions), then resolve per-operation requirements.
    const schemesMap = buildSecuritySchemes(api);
    const globalSecurity = Array.isArray(api.security) ? api.security : [];

    for (const [path, pathItem] of Object.entries(paths)) {
        if (!pathItem || typeof pathItem !== "object") continue;

        for (const method of SUPPORTED_METHODS) {
            const operation = (pathItem as Record<string, any>)[method];
            if (!operation) continue;

            const endpoint: ParsedEndpoint = {
                method: method.toUpperCase(),
                path,
                operationId: operation.operationId,
                requestBodySchema: extractRequestBodySchema(operation, api),
                parameters: extractParameters(operation, pathItem as any),
                authRequirements: extractAuthRequirements(
                    operation,
                    globalSecurity,
                    schemesMap,
                ),
            };

            endpoints.push(endpoint);
        }
    }

    if (endpoints.length === 0) {
        throw new OpenApiParserError(
            "No valid endpoints found in the OpenAPI specification",
            "NO_ENDPOINTS",
        );
    }

    return endpoints;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractRequestBodySchema(
    operation: Record<string, any>,
    _api: any,
): Record<string, unknown> | null {
    // OpenAPI 3.x
    if (operation.requestBody?.content) {
        const jsonContent =
            operation.requestBody.content["application/json"] ||
            operation.requestBody.content["*/*"];

        if (jsonContent?.schema) {
            return jsonContent.schema as Record<string, unknown>;
        }
    }

    // Swagger 2.x — look for body parameters
    const bodyParam = operation.parameters?.find(
        (p: any) => p.in === "body" && p.schema,
    );
    if (bodyParam) {
        return bodyParam.schema as Record<string, unknown>;
    }

    return null;
}

function extractParameters(
    operation: Record<string, any>,
    pathItem: Record<string, any>,
): ParsedParameter[] {
    const params: ParsedParameter[] = [];
    const rawParams = [
        ...(pathItem.parameters || []),
        ...(operation.parameters || []),
    ];

    for (const p of rawParams) {
        if (p.in === "body") continue; // handled as requestBody
        params.push({
            name: p.name,
            in: p.in,
            required: p.required ?? false,
            schema: p.schema ?? null,
        });
    }

    return params;
}

/**
 * Build a name → AuthRequirement map from the spec's declared schemes.
 * Handles OpenAPI 3 (`components.securitySchemes`) and Swagger 2
 * (`securityDefinitions`). Never throws — unknown shapes degrade gracefully.
 */
function buildSecuritySchemes(api: any): Record<string, AuthRequirement> {
    const out: Record<string, AuthRequirement> = {};
    const schemes =
        api?.components?.securitySchemes ?? api?.securityDefinitions ?? {};
    if (!schemes || typeof schemes !== "object") return out;

    for (const [name, raw] of Object.entries(schemes)) {
        if (!raw || typeof raw !== "object") continue;
        const d = raw as Record<string, any>;
        const rawType = String(d.type ?? "unknown").toLowerCase();
        const req: AuthRequirement = { scheme: name, type: "unknown" };

        if (rawType === "http") {
            req.type = "http";
            if (d.scheme) req.httpScheme = String(d.scheme).toLowerCase();
        } else if (rawType === "basic") {
            // Swagger 2 spells HTTP Basic as its own type.
            req.type = "http";
            req.httpScheme = "basic";
        } else if (rawType === "apikey") {
            req.type = "apiKey";
            if (d.name) req.name = String(d.name);
            if (d.in) req.in = String(d.in);
        } else if (rawType === "oauth2") {
            req.type = "oauth2";
        } else if (rawType === "openidconnect") {
            req.type = "openIdConnect";
        } else {
            req.type = rawType;
        }
        out[name] = req;
    }
    return out;
}

/**
 * Resolve the auth requirements for one operation. Per-operation `security`
 * overrides the global `security` (an explicit empty array means "no auth").
 * Returns a flattened, de-duplicated list of the referenced scheme descriptors.
 */
function extractAuthRequirements(
    operation: Record<string, any>,
    globalSecurity: any[],
    schemesMap: Record<string, AuthRequirement>,
): AuthRequirement[] {
    const security = Array.isArray(operation.security)
        ? operation.security
        : globalSecurity;
    if (!Array.isArray(security) || security.length === 0) return [];

    const names = new Set<string>();
    for (const alt of security) {
        if (alt && typeof alt === "object") {
            for (const key of Object.keys(alt)) names.add(key);
        }
    }

    const reqs: AuthRequirement[] = [];
    for (const n of names) {
        reqs.push(schemesMap[n] ?? { scheme: n, type: "unknown" });
    }
    return reqs;
}

// ---------------------------------------------------------------------------
// Custom Error
// ---------------------------------------------------------------------------

export class OpenApiParserError extends Error {
    constructor(
        message: string,
        public readonly code:
            | "NETWORK_ERROR"
            | "INVALID_SPEC"
            | "PARSE_ERROR"
            | "NO_ENDPOINTS",
    ) {
        super(message);
        this.name = "OpenApiParserError";
    }
}

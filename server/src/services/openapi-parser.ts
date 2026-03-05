// =============================================================================
// OpenAPI Spec Parser Service
// =============================================================================

import SwaggerParser from "swagger-parser";
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
}

export interface ParsedParameter {
    name: string;
    in: "query" | "header" | "path" | "cookie";
    required: boolean;
    schema: Record<string, unknown> | null;
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

        // swagger-parser handles both Swagger 2.0 and OpenAPI 3.x
        // It also resolves $ref pointers automatically
        api = await (SwaggerParser as any).validate(specUrl);
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);

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

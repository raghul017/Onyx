// =============================================================================
// OpenAPI spec for the Onyx backend itself.
// Served at GET /api/openapi.json so Onyx can scan its own API
// (the Render domain is owned by us → passes domain verification).
// =============================================================================

export const openApiSpec = {
    openapi: "3.0.3",
    info: {
        title: "Onyx API",
        description:
            "AI-powered API vulnerability testing engine. This spec describes the Onyx backend's own endpoints.",
        version: "1.0.0",
    },
    servers: [
        { url: "/api", description: "Onyx API (relative to host)" },
    ],
    components: {
        securitySchemes: {
            bearerAuth: {
                type: "http",
                scheme: "bearer",
                bearerFormat: "JWT",
            },
        },
        schemas: {
            Credentials: {
                type: "object",
                required: ["email", "password"],
                properties: {
                    email: { type: "string", format: "email", example: "operator@onyx.dev" },
                    password: { type: "string", minLength: 8, example: "supersecret123" },
                },
            },
            CreateTestRun: {
                type: "object",
                required: ["specUrl"],
                properties: {
                    specUrl: {
                        type: "string",
                        format: "uri",
                        example: "https://petstore.swagger.io/v2/swagger.json",
                    },
                },
            },
            VerifyTarget: {
                type: "object",
                required: ["specUrl"],
                properties: {
                    specUrl: { type: "string", format: "uri" },
                },
            },
            CreateOrg: {
                type: "object",
                required: ["name"],
                properties: {
                    name: { type: "string", example: "Acme Corp" },
                },
            },
            CreateInvite: {
                type: "object",
                required: ["email", "role"],
                properties: {
                    email: { type: "string", format: "email" },
                    role: { type: "string", enum: ["ADMIN", "VIEWER"] },
                },
            },
        },
    },
    paths: {
        "/health": {
            get: {
                summary: "Health check",
                responses: { "200": { description: "Service is up" } },
            },
        },
        "/auth/signup": {
            post: {
                summary: "Create an account",
                requestBody: {
                    required: true,
                    content: {
                        "application/json": {
                            schema: { $ref: "#/components/schemas/Credentials" },
                        },
                    },
                },
                responses: {
                    "201": { description: "Account created, returns JWT" },
                    "400": { description: "Validation error" },
                },
            },
        },
        "/auth/signin": {
            post: {
                summary: "Sign in",
                requestBody: {
                    required: true,
                    content: {
                        "application/json": {
                            schema: { $ref: "#/components/schemas/Credentials" },
                        },
                    },
                },
                responses: {
                    "200": { description: "Authenticated, returns JWT" },
                    "401": { description: "Invalid credentials" },
                },
            },
        },
        "/user/me": {
            get: {
                summary: "Get current user + org memberships",
                security: [{ bearerAuth: [] }],
                responses: { "200": { description: "Current user" } },
            },
        },
        "/test-runs": {
            get: {
                summary: "List test runs",
                security: [{ bearerAuth: [] }],
                responses: { "200": { description: "Array of test runs" } },
            },
            post: {
                summary: "Create a test run (launch a scan)",
                security: [{ bearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: {
                        "application/json": {
                            schema: { $ref: "#/components/schemas/CreateTestRun" },
                        },
                    },
                },
                responses: {
                    "201": { description: "Test run created" },
                    "403": { description: "DOMAIN_NOT_VERIFIED" },
                    "429": { description: "QUOTA_EXCEEDED" },
                },
            },
        },
        "/test-runs/{id}": {
            get: {
                summary: "Get a single test run with logs",
                security: [{ bearerAuth: [] }],
                parameters: [
                    { name: "id", in: "path", required: true, schema: { type: "string" } },
                ],
                responses: { "200": { description: "Test run detail" } },
            },
            delete: {
                summary: "Delete a test run",
                security: [{ bearerAuth: [] }],
                parameters: [
                    { name: "id", in: "path", required: true, schema: { type: "string" } },
                ],
                responses: { "204": { description: "Deleted" } },
            },
        },
        "/test-runs/{id}/abort": {
            post: {
                summary: "Abort a running test run",
                security: [{ bearerAuth: [] }],
                parameters: [
                    { name: "id", in: "path", required: true, schema: { type: "string" } },
                ],
                responses: { "200": { description: "Aborted" } },
            },
        },
        "/test-runs/{id}/logs": {
            get: {
                summary: "Get attack logs for a test run",
                security: [{ bearerAuth: [] }],
                parameters: [
                    { name: "id", in: "path", required: true, schema: { type: "string" } },
                ],
                responses: { "200": { description: "Attack logs" } },
            },
        },
        "/test-runs/{id}/export/pdf": {
            get: {
                summary: "Export a test run as PDF (Pro+)",
                security: [{ bearerAuth: [] }],
                parameters: [
                    { name: "id", in: "path", required: true, schema: { type: "string" } },
                ],
                responses: {
                    "200": { description: "PDF binary" },
                    "402": { description: "Plan upgrade required" },
                },
            },
        },
        "/verify-target": {
            get: {
                summary: "List verified domains",
                security: [{ bearerAuth: [] }],
                responses: { "200": { description: "Verified targets" } },
            },
            post: {
                summary: "Initiate domain verification (generate token)",
                security: [{ bearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: {
                        "application/json": {
                            schema: { $ref: "#/components/schemas/VerifyTarget" },
                        },
                    },
                },
                responses: { "200": { description: "Token issued" } },
            },
        },
        "/verify-target/check": {
            post: {
                summary: "Check domain verification (probe file/DNS)",
                security: [{ bearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                required: ["domain"],
                                properties: { domain: { type: "string" } },
                            },
                        },
                    },
                },
                responses: { "200": { description: "Verification result" } },
            },
        },
        "/verify-target/{id}": {
            delete: {
                summary: "Delete a verified target",
                security: [{ bearerAuth: [] }],
                parameters: [
                    { name: "id", in: "path", required: true, schema: { type: "string" } },
                ],
                responses: { "204": { description: "Deleted" } },
            },
        },
        "/orgs": {
            get: {
                summary: "List my organizations",
                security: [{ bearerAuth: [] }],
                responses: { "200": { description: "Orgs" } },
            },
            post: {
                summary: "Create an organization",
                security: [{ bearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: {
                        "application/json": {
                            schema: { $ref: "#/components/schemas/CreateOrg" },
                        },
                    },
                },
                responses: { "201": { description: "Org created" } },
            },
        },
        "/orgs/{orgId}": {
            get: {
                summary: "Get org detail",
                security: [{ bearerAuth: [] }],
                parameters: [
                    { name: "orgId", in: "path", required: true, schema: { type: "string" } },
                ],
                responses: { "200": { description: "Org" } },
            },
            patch: {
                summary: "Update org (OWNER)",
                security: [{ bearerAuth: [] }],
                parameters: [
                    { name: "orgId", in: "path", required: true, schema: { type: "string" } },
                ],
                responses: { "200": { description: "Updated" } },
            },
            delete: {
                summary: "Delete org (OWNER)",
                security: [{ bearerAuth: [] }],
                parameters: [
                    { name: "orgId", in: "path", required: true, schema: { type: "string" } },
                ],
                responses: { "204": { description: "Deleted" } },
            },
        },
        "/orgs/{orgId}/members": {
            get: {
                summary: "List org members",
                security: [{ bearerAuth: [] }],
                parameters: [
                    { name: "orgId", in: "path", required: true, schema: { type: "string" } },
                ],
                responses: { "200": { description: "Members" } },
            },
        },
        "/orgs/{orgId}/members/{userId}": {
            patch: {
                summary: "Update member role (OWNER)",
                security: [{ bearerAuth: [] }],
                parameters: [
                    { name: "orgId", in: "path", required: true, schema: { type: "string" } },
                    { name: "userId", in: "path", required: true, schema: { type: "string" } },
                ],
                responses: { "200": { description: "Updated" } },
            },
            delete: {
                summary: "Remove member (OWNER)",
                security: [{ bearerAuth: [] }],
                parameters: [
                    { name: "orgId", in: "path", required: true, schema: { type: "string" } },
                    { name: "userId", in: "path", required: true, schema: { type: "string" } },
                ],
                responses: { "204": { description: "Removed" } },
            },
        },
        "/orgs/{orgId}/invites": {
            get: {
                summary: "List pending invites (ADMIN)",
                security: [{ bearerAuth: [] }],
                parameters: [
                    { name: "orgId", in: "path", required: true, schema: { type: "string" } },
                ],
                responses: { "200": { description: "Invites" } },
            },
            post: {
                summary: "Create an invite (ADMIN)",
                security: [{ bearerAuth: [] }],
                parameters: [
                    { name: "orgId", in: "path", required: true, schema: { type: "string" } },
                ],
                requestBody: {
                    required: true,
                    content: {
                        "application/json": {
                            schema: { $ref: "#/components/schemas/CreateInvite" },
                        },
                    },
                },
                responses: { "201": { description: "Invite created" } },
            },
        },
        "/orgs/{orgId}/invites/{inviteId}": {
            delete: {
                summary: "Revoke an invite (ADMIN)",
                security: [{ bearerAuth: [] }],
                parameters: [
                    { name: "orgId", in: "path", required: true, schema: { type: "string" } },
                    { name: "inviteId", in: "path", required: true, schema: { type: "string" } },
                ],
                responses: { "204": { description: "Revoked" } },
            },
        },
        "/invites/accept": {
            post: {
                summary: "Accept an invite by token",
                security: [{ bearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                required: ["token"],
                                properties: { token: { type: "string" } },
                            },
                        },
                    },
                },
                responses: { "200": { description: "Joined org" } },
            },
        },
        "/billing/subscribe": {
            post: {
                summary: "Create a Razorpay subscription",
                security: [{ bearerAuth: [] }],
                responses: { "200": { description: "Subscription created" } },
            },
        },
        "/billing/verify": {
            post: {
                summary: "Verify a subscription after payment",
                security: [{ bearerAuth: [] }],
                responses: { "200": { description: "Plan activated" } },
            },
        },
        "/billing/cancel": {
            post: {
                summary: "Cancel subscription (downgrade to FREE)",
                security: [{ bearerAuth: [] }],
                responses: { "200": { description: "Cancelled" } },
            },
        },
    },
} as const;

// =============================================================================
// Onyx API client (built on global fetch — zero runtime deps). Maps non-2xx
// responses to typed operational errors. The token is sent in the Authorization
// header and NEVER logged.
// =============================================================================

import type { CreateRunResponse, GetRunResponse } from "./types.js";
import { AuthError, OnyxError, VerificationError } from "./errors.js";

/** The surface the scan flow depends on — mocked in tests. */
export interface OnyxApi {
    createRun(specUrl: string, authRecipeId?: string): Promise<CreateRunResponse>;
    getRun(id: string): Promise<GetRunResponse>;
}

export class HttpApiClient implements OnyxApi {
    constructor(
        private readonly baseUrl: string, // already normalized to end with /api
        private readonly token: string,
        private readonly orgId?: string,
    ) {}

    private headers(): Record<string, string> {
        const h: Record<string, string> = {
            Authorization: `Bearer ${this.token}`,
            Accept: "application/json",
            "User-Agent": "onyx-cli/0.1.0",
        };
        if (this.orgId) h["x-org-id"] = this.orgId;
        return h;
    }

    async createRun(specUrl: string, authRecipeId?: string): Promise<CreateRunResponse> {
        const body: Record<string, string> = { specUrl };
        if (authRecipeId) body.authRecipeId = authRecipeId;

        const res = await this.request("POST", "/test-runs", body);
        const data = await this.parseJson(res);

        if (res.status === 201) return data as CreateRunResponse;
        this.throwForError(res.status, data);
    }

    async getRun(id: string): Promise<GetRunResponse> {
        const res = await this.request("GET", `/test-runs/${encodeURIComponent(id)}`);
        const data = await this.parseJson(res);
        if (res.ok) return data as GetRunResponse;
        this.throwForError(res.status, data);
    }

    private async request(method: string, path: string, body?: unknown): Promise<Response> {
        const headers = this.headers();
        if (body !== undefined) headers["Content-Type"] = "application/json";
        try {
            return await fetch(`${this.baseUrl}${path}`, {
                method,
                headers,
                body: body !== undefined ? JSON.stringify(body) : undefined,
            });
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            throw new OnyxError(
                `Could not reach the Onyx API at ${this.baseUrl}: ${msg}`,
                "Check --api-url / ONYX_API_URL and your network connection.",
            );
        }
    }

    private async parseJson(res: Response): Promise<any> {
        try {
            return await res.json();
        } catch {
            return {};
        }
    }

    /** Map a non-2xx response to a typed error. Never includes the token. */
    private throwForError(status: number, data: any): never {
        if (status === 401) throw new AuthError();
        if (status === 403 && data?.error === "DOMAIN_NOT_VERIFIED") {
            throw new VerificationError(String(data.domain ?? "the target"));
        }
        const message = data?.message ?? data?.error ?? `HTTP ${status}`;
        if (status === 403 && data?.error === "AUTH_RECIPE_FORBIDDEN") {
            throw new OnyxError(`Auth recipe not found or not yours (403).`, "Check --auth-recipe.");
        }
        if (status === 429) {
            throw new OnyxError(
                `Rate/quota limit reached (429): ${message}`,
                "Wait and retry, or upgrade your plan.",
            );
        }
        throw new OnyxError(`API request failed (${status}): ${message}`);
    }
}

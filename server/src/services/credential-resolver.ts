// =============================================================================
// Credential Resolver (T8a) — per-run credential cache with SINGLE-FLIGHT and a
// one-shot 401 refresh helper.
//
// A run attaches ONE credential to every request. For STATIC recipes the value
// is stable; for DYNAMIC recipes (loginRequest / oauth2) it's a token obtained
// at scan time. Concurrent jobs must NOT all trigger a login at once — so the
// resolver de-duplicates concurrent resolves (and concurrent refreshes) for the
// same (run, recipe) into a single in-flight promise.
//
// The loader (which reads the recipe + decrypts + calls the auth-runner) is
// injected, so this module stays free of prisma/crypto and is unit-testable.
// =============================================================================

import type { AttachedCredential } from "./request-builder.js";

export interface ResolvedCredential {
    /** The credential to attach, or null (fire un-authenticated). */
    value: AttachedCredential | null;
    /** True for dynamic recipes — only these are eligible for a 401 refresh. */
    dynamic: boolean;
}

export type CredentialLoader = (recipeId: string) => Promise<ResolvedCredential>;

export class CredentialResolver {
    private cache = new Map<string, { value: ResolvedCredential; at: number }>();
    private inflight = new Map<string, Promise<ResolvedCredential>>();

    constructor(
        private readonly loader: CredentialLoader,
        private readonly ttlMs = 300_000,
        private readonly maxSize = 500,
    ) {}

    /**
     * Resolve the credential for (runId, recipeId), caching per run. Concurrent
     * calls share ONE in-flight load (single-flight). Pass forceRefresh to drop
     * the cache and re-resolve (used on a mid-run 401 for dynamic recipes) — a
     * concurrent refresh still collapses to a single load.
     */
    async resolve(
        runId: string,
        recipeId: string,
        opts: { forceRefresh?: boolean } = {},
    ): Promise<ResolvedCredential> {
        const key = `${runId}:${recipeId}`;

        if (opts.forceRefresh) {
            this.cache.delete(key);
        } else {
            const hit = this.cache.get(key);
            if (hit && Date.now() - hit.at < this.ttlMs) return hit.value;
        }

        // Single-flight: reuse any in-flight load for this key (covers concurrent
        // initial resolves AND concurrent refreshes).
        const existing = this.inflight.get(key);
        if (existing) return existing;

        const p = this.loader(recipeId)
            .then((v) => {
                this.setCache(key, v);
                return v;
            })
            .catch((): ResolvedCredential => ({ value: null, dynamic: false }))
            .finally(() => {
                this.inflight.delete(key);
            });

        this.inflight.set(key, p);
        return p;
    }

    private setCache(key: string, value: ResolvedCredential): void {
        if (this.cache.size >= this.maxSize) {
            const oldest = this.cache.keys().next().value;
            if (oldest !== undefined) this.cache.delete(oldest);
        }
        this.cache.set(key, { value, at: Date.now() });
    }
}

/**
 * Execute a request with a ONE-SHOT auth refresh on a 401. If the first response
 * is 401 AND a refresh is allowed (dynamic recipe, not a MISSING_AUTH probe),
 * re-resolve the credential ONCE and retry the SAME request ONE time. No loops:
 * a still-401 second response (or a failed refresh) is returned as-is. Pure —
 * `execute`/`refresh` are injected, so it's fully unit-testable.
 */
export async function executeWithAuthRefresh<R extends { statusCode: number }>(opts: {
    credential: AttachedCredential | null;
    canRefresh: boolean;
    execute: (cred: AttachedCredential | null) => Promise<R>;
    refresh: () => Promise<AttachedCredential | null>;
}): Promise<{ result: R; credentialUsed: AttachedCredential | null }> {
    const first = await opts.execute(opts.credential);
    if (first.statusCode !== 401 || !opts.canRefresh) {
        return { result: first, credentialUsed: opts.credential };
    }

    // Exactly one refresh + one retry.
    const fresh = await opts.refresh();
    if (!fresh) return { result: first, credentialUsed: opts.credential };

    const second = await opts.execute(fresh);
    return { result: second, credentialUsed: fresh };
}

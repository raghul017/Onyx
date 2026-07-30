// =============================================================================
// Identity credential resolver (T12) — resolves the credential for ANY identity
// of a run, not just the run's single recipe. This is the foundation T13 will
// call to fire the SAME request as different identities (cross-identity / BOLA).
//
// It's a thin layer over the existing CredentialResolver (T8a): given a run's
// identity, it looks up that identity's authRecipeId and delegates to the shared
// resolver keyed by (runId, recipeId) — reusing its cache, single-flight, and
// no-plaintext-in-Redis guarantees. An anonymous identity (authRecipeId null)
// resolves to no credential without touching the loader.
//
// The identity lookup is INJECTED so this module stays DB-free and unit-testable.
// =============================================================================

import type { CredentialResolver, ResolvedCredential } from "./credential-resolver.js";

/** Minimal shape of a persisted RunIdentity needed to resolve its credential. */
export interface IdentityRef {
    id: string;
    testRunId: string;
    authRecipeId: string | null;
}

/** Load a run identity by id (or null if it doesn't exist / isn't this run's). */
export type IdentityLoader = (identityId: string) => Promise<IdentityRef | null>;

const NO_CREDENTIAL: ResolvedCredential = { value: null, dynamic: false };

export class IdentityCredentialResolver {
    constructor(
        private readonly resolver: CredentialResolver,
        private readonly loadIdentity: IdentityLoader,
    ) {}

    /**
     * Resolve the credential to use when acting AS `identityId`. Anonymous
     * identities (no recipe) resolve to no credential. Delegates recipe-backed
     * identities to the shared CredentialResolver (cached per run+recipe).
     */
    async resolveForIdentity(
        identityId: string,
        opts: { forceRefresh?: boolean } = {},
    ): Promise<ResolvedCredential> {
        const identity = await this.loadIdentity(identityId);
        if (!identity || identity.authRecipeId == null) return NO_CREDENTIAL;
        return this.resolver.resolve(identity.testRunId, identity.authRecipeId, opts);
    }
}

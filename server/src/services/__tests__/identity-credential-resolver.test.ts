// =============================================================================
// Tests for the T12 IdentityCredentialResolver — resolving a credential for ANY
// identity of a run (the foundation T13 calls for cross-identity replays). The
// identity loader and the underlying credential loader are injected. No DB.
// =============================================================================
import { describe, it, expect, vi } from "vitest";
import { CredentialResolver, type ResolvedCredential } from "../credential-resolver.js";
import {
    IdentityCredentialResolver,
    type IdentityRef,
} from "../identity-credential-resolver.js";
import type { AttachedCredential } from "../request-builder.js";

const bearer = (t: string): AttachedCredential => ({ type: "bearer", secret: t });

const RUN = "run-1";
const RECIPE_A = "recipe-a";

function makeIdentities(rows: IdentityRef[]) {
    return (id: string) => Promise.resolve(rows.find((r) => r.id === id) ?? null);
}

describe("IdentityCredentialResolver", () => {
    it("resolves a recipe-backed secondary identity WITHOUT running the scan under it", async () => {
        // loader returns a credential for RECIPE_A; count how often it's hit.
        const loader = vi.fn(
            async (recipeId: string): Promise<ResolvedCredential> => ({
                value: bearer(`tok-${recipeId}`),
                dynamic: false,
            }),
        );
        const resolver = new CredentialResolver(loader);
        const idResolver = new IdentityCredentialResolver(
            resolver,
            makeIdentities([
                { id: "identity-primary", testRunId: RUN, authRecipeId: null },
                { id: "identity-secondary", testRunId: RUN, authRecipeId: RECIPE_A },
            ]),
        );

        const cred = await idResolver.resolveForIdentity("identity-secondary");
        expect(cred.value).toEqual(bearer(`tok-${RECIPE_A}`));
        expect(loader).toHaveBeenCalledWith(RECIPE_A);
    });

    it("anonymous identity (no recipe) resolves to NO credential, never hitting the loader", async () => {
        const loader = vi.fn();
        const resolver = new CredentialResolver(loader as never);
        const idResolver = new IdentityCredentialResolver(
            resolver,
            makeIdentities([{ id: "identity-anon", testRunId: RUN, authRecipeId: null }]),
        );

        const cred = await idResolver.resolveForIdentity("identity-anon");
        expect(cred).toEqual({ value: null, dynamic: false });
        expect(loader).not.toHaveBeenCalled();
    });

    it("unknown identity resolves to no credential (defensive)", async () => {
        const loader = vi.fn();
        const resolver = new CredentialResolver(loader as never);
        const idResolver = new IdentityCredentialResolver(resolver, makeIdentities([]));
        expect(await idResolver.resolveForIdentity("nope")).toEqual({ value: null, dynamic: false });
        expect(loader).not.toHaveBeenCalled();
    });

    it("shares the underlying resolver cache across identities with the same recipe", async () => {
        const loader = vi.fn(
            async (recipeId: string): Promise<ResolvedCredential> => ({
                value: bearer(`tok-${recipeId}`),
                dynamic: false,
            }),
        );
        const resolver = new CredentialResolver(loader);
        const idResolver = new IdentityCredentialResolver(
            resolver,
            makeIdentities([
                { id: "id-1", testRunId: RUN, authRecipeId: RECIPE_A },
                { id: "id-2", testRunId: RUN, authRecipeId: RECIPE_A }, // same recipe + run
            ]),
        );

        await idResolver.resolveForIdentity("id-1");
        await idResolver.resolveForIdentity("id-2");
        // Same (runId, recipeId) → the shared resolver loads the credential ONCE.
        expect(loader).toHaveBeenCalledTimes(1);
    });
});

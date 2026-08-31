// =============================================================================
// Recipe credential loader (extracted in T13a from worker.ts) — loads + resolves
// an auth recipe into a concrete credential. STATIC recipes decrypt to a fixed
// value; DYNAMIC recipes (loginRequest / oauth2) obtain a token via the
// auth-runner (SSRF-guarded). Never throws — on failure it returns a null
// credential (fire un-authenticated) while preserving the `dynamic` flag so a
// mid-run 401 can still trigger one login retry.
//
// Shared by the worker's CredentialResolver AND the BOLA orchestrator (T13a), so
// id-acquisition-as-A and replay-as-B resolve credentials exactly like the scan.
// The decrypted secret / token live only in process memory — never persisted,
// never logged, never placed in Redis.
// =============================================================================

import { prisma } from "../lib/prisma.js";
import { logger } from "../lib/logger.js";
import { decryptSecret } from "../lib/crypto.js";
import { toAttachedCredential, isDynamicType } from "./auth-recipe.service.js";
import { resolveDynamicCredential } from "./auth-runner.js";
import type { ResolvedCredential } from "./credential-resolver.js";

const log = logger.child({ component: "recipe-credential-loader" });

function safeErr(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
}

/** Load + resolve a recipe id into a credential. See module header for guarantees. */
export async function loadRecipeCredential(recipeId: string): Promise<ResolvedCredential> {
    let row: { type: string; meta: unknown; secretEnc: string } | null = null;
    try {
        row = await prisma.authRecipe.findUnique({
            where: { id: recipeId },
            select: { type: true, meta: true, secretEnc: true },
        });
    } catch (err) {
        log.error({ recipeId, err: safeErr(err) }, "Failed to load auth recipe");
        return { value: null, dynamic: false };
    }
    if (!row) return { value: null, dynamic: false };

    const dynamic = isDynamicType(row.type);
    try {
        if (!dynamic) {
            return { value: toAttachedCredential(row), dynamic: false };
        }
        // Dynamic: decrypt the JSON secret + call the auth-runner (SSRF-guarded).
        const secret = JSON.parse(decryptSecret(row.secretEnc)) as Record<string, string>;
        const value = await resolveDynamicCredential({
            type: row.type as "loginRequest" | "oauth2ClientCredentials",
            meta: (row.meta ?? {}) as Record<string, unknown>,
            secret,
        });
        log.info({ recipeId, type: row.type }, "Resolved dynamic credential");
        return { value, dynamic: true };
    } catch (err) {
        // SSRF block / non-2xx / missing token / decrypt failure: fire un-authed.
        // NEVER log the secret or token — only the safe reason.
        log.error(
            { recipeId, type: row.type, reason: safeErr(err) },
            "Failed to resolve credential — firing without it",
        );
        return { value: null, dynamic };
    }
}

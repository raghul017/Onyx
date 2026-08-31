// =============================================================================
// BOLA collection fetcher (T13a) — fires a collection GET AS the primary identity
// (A) to acquire a real object id, honoring the SSRF guard + request timeout and
// never logging/storing secrets. Returns parsed JSON + status for the pure
// extractor (id-acquisition.ts). Used only during replay orchestration.
// =============================================================================

import { assertNotSSRF } from "../lib/ssrf-guard.js";
import { buildBenignRequest } from "./request-builder.js";
import { CredentialResolver } from "./credential-resolver.js";
import { IdentityCredentialResolver } from "./identity-credential-resolver.js";
import { loadRecipeCredential } from "./recipe-credential-loader.js";
import { prisma } from "../lib/prisma.js";
import { logger } from "../lib/logger.js";
import type { CollectionFetcher, CollectionFetchResult } from "./id-acquisition.js";
import type { EndpointLike } from "./object-id.js";

const log = logger.child({ component: "bola-fetcher" });

const ACQUIRE_TIMEOUT_MS = 10_000;
// Never buffer more than this from an id-acquisition response (defensive).
const MAX_ACQUIRE_BYTES = 256 * 1024;

/**
 * Build a CollectionFetcher bound to the primary identity of `testRunId`. The
 * returned fn fires GET on a collection endpoint as A and returns parsed JSON.
 * A fresh resolver per run keeps A's credential cache scoped to that run.
 */
export function runBolaIdAcquisitionFetcher(
    testRunId: string,
    baseUrl: string,
    primaryIdentityId: string,
): CollectionFetcher {
    const resolver = new CredentialResolver(loadRecipeCredential);
    const identityResolver = new IdentityCredentialResolver(resolver, async (id) => {
        const row = await prisma.runIdentity.findUnique({
            where: { id },
            select: { id: true, testRunId: true, authRecipeId: true },
        });
        return row;
    });

    return async (collection): Promise<CollectionFetchResult> => {
        const cred = await identityResolver.resolveForIdentity(primaryIdentityId);
        const ep = collection as EndpointLike;
        const request = buildBenignRequest({
            method: "GET",
            path: ep.path,
            baseUrl,
            // Normalize to the builder's param shape (fill required/schema defaults).
            parameters: ep.parameters.map((p) => ({
                name: p.name,
                in: p.in,
                required: false,
                schema: p.schema ?? null,
            })),
            credential: cred.value,
        });

        try {
            await assertNotSSRF(request.url);
        } catch {
            return { json: null, statusCode: 0 };
        }

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), ACQUIRE_TIMEOUT_MS);
        try {
            const res = await fetch(request.url, {
                method: "GET",
                headers: request.headers,
                signal: controller.signal,
            });
            const text = (await res.text()).slice(0, MAX_ACQUIRE_BYTES);
            let json: unknown = null;
            try {
                json = JSON.parse(text);
            } catch {
                json = null; // non-JSON collection → unresolved, caller falls back
            }
            return { json, statusCode: res.status };
        } catch (err) {
            log.info(
                { testRunId, reason: err instanceof Error ? err.message : String(err) },
                "id-acquisition fetch failed",
            );
            return { json: null, statusCode: 0 };
        } finally {
            clearTimeout(timer);
        }
    };
}

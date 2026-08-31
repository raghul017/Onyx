// =============================================================================
// Report shares (T16a) — tokenized, read-only public links to a run's report.
//
// TOKEN MODEL: the token is a CAPABILITY URL. Possession alone grants read
// access to exactly one report, so it is stored in PLAINTEXT and indexed for an
// O(1) lookup. Hashing (as we do for API tokens) would break the lookup without
// buying much here: there is no account to impersonate, no privilege to escalate,
// and the payload is report-only. Entropy is ~256 bits (43 base62 chars), so the
// token space is not enumerable, and the public endpoint is additionally
// rate-limited. Revocation (revokedAt) takes effect immediately on the next read.
//
// One ACTIVE share per run: creating twice returns the existing active share
// rather than minting a second token (idempotent), so a shared link stays stable.
// =============================================================================

import crypto from "node:crypto";
import { prisma } from "../lib/prisma.js";

const BASE62 = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
/** 43 base62 chars → 62^43 ≈ 2^256 of entropy. */
const TOKEN_LEN = 43;

/** Cryptographically-random base62 string, rejection-sampled (no modulo bias). */
export function generateShareToken(len: number = TOKEN_LEN): string {
    const out: string[] = [];
    while (out.length < len) {
        const buf = crypto.randomBytes(len);
        for (const b of buf) {
            // 248 = 62 * 4 — keep only the uniform range so every char is equally likely.
            if (b < 248) out.push(BASE62[b % 62]!);
            if (out.length === len) break;
        }
    }
    return out.join("");
}

export interface ShareRecord {
    id: string;
    testRunId: string;
    token: string;
    createdAt: Date;
    revokedAt: Date | null;
}

/**
 * Build the public URL for a share token. Base resolution order:
 *   1. SHARE_BASE_URL (explicit, e.g. https://onyx-engine.vercel.app)
 *   2. APP_BASE_URL   (reused if the deployment already sets one)
 *   3. the request origin passed in by the caller (proto + host)
 * so a self-hosted deployment works with no extra config.
 */
export function buildShareUrl(token: string, requestOrigin?: string | null): string {
    const base =
        process.env.SHARE_BASE_URL ||
        process.env.APP_BASE_URL ||
        requestOrigin ||
        "";
    return `${base.replace(/\/+$/, "")}/shared/${token}`;
}

/** The run's ACTIVE (non-revoked) share, or null. */
export async function getActiveShare(testRunId: string): Promise<ShareRecord | null> {
    return prisma.reportShare.findFirst({
        where: { testRunId, revokedAt: null },
        orderBy: { createdAt: "desc" },
        select: { id: true, testRunId: true, token: true, createdAt: true, revokedAt: true },
    });
}

/**
 * Create a share for a run, or return the existing ACTIVE one (idempotent), so
 * calling twice never mints a second token and a shared link stays stable.
 */
export async function createOrGetShare(input: {
    testRunId: string;
    createdByUserId?: string | null;
    orgId?: string | null;
}): Promise<ShareRecord> {
    const existing = await getActiveShare(input.testRunId);
    if (existing) return existing;

    return prisma.reportShare.create({
        data: {
            testRunId: input.testRunId,
            token: generateShareToken(),
            createdByUserId: input.createdByUserId ?? null,
            orgId: input.orgId ?? null,
        },
        select: { id: true, testRunId: true, token: true, createdAt: true, revokedAt: true },
    });
}

/** Revoke every active share for a run. Returns how many were revoked. */
export async function revokeShares(testRunId: string): Promise<number> {
    const { count } = await prisma.reportShare.updateMany({
        where: { testRunId, revokedAt: null },
        data: { revokedAt: new Date() },
    });
    return count;
}

/**
 * Resolve a token to its run id. Returns null for an unknown OR revoked token —
 * the caller 404s either way, so a revoked link is indistinguishable from one
 * that never existed.
 */
export async function resolveShareToken(token: string): Promise<string | null> {
    if (!token || token.length < 20 || token.length > 128) return null;
    const share = await prisma.reportShare.findFirst({
        where: { token, revokedAt: null },
        select: { testRunId: true },
    });
    return share?.testRunId ?? null;
}

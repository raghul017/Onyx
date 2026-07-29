// =============================================================================
// API Token Controller (T10a) — CRUD for long-lived REST credentials.
//
// The plaintext token is returned ONCE (on create) and never again / never
// logged; only its SHA-256 hash is stored. List responses are masked. Scoped to
// the caller (userId) or their active org (req.orgId), mirroring the auth-recipe
// controller's ownership model. These routes are session-only (see route guard).
// =============================================================================

import type { Request, Response, NextFunction } from "express";
import { prisma } from "../lib/prisma.js";
import { createApiTokenSchema } from "../validators/schemas.js";
import { generateApiToken, maskApiToken } from "../services/api-token.service.js";
import { logger } from "../lib/logger.js";

const log = logger.child({ component: "api-token" });

// Non-secret columns — tokenHash is NEVER selected for a response.
const SAFE_SELECT = {
    id: true,
    userId: true,
    orgId: true,
    name: true,
    last4: true,
    createdAt: true,
    lastUsedAt: true,
    revokedAt: true,
} as const;

type SafeToken = {
    id: string;
    userId: string | null;
    orgId: string | null;
    name: string;
    last4: string;
    createdAt: Date;
    lastUsedAt: Date | null;
    revokedAt: Date | null;
};

/** Masked public view — never the plaintext or the hash. */
function maskRow(t: SafeToken) {
    return {
        id: t.id,
        name: t.name,
        maskedToken: maskApiToken(t.last4),
        last4: t.last4,
        createdAt: t.createdAt,
        lastUsedAt: t.lastUsedAt,
        revokedAt: t.revokedAt,
        revoked: t.revokedAt !== null,
    };
}

/** Owner or a member of the owning org may access a token. */
function canAccess(t: { userId: string | null; orgId: string | null }, req: Request): boolean {
    const isOwner = t.userId != null && t.userId === req.user?.id;
    const isOrgMember = t.orgId != null && req.orgId != null && req.orgId === t.orgId;
    return isOwner || isOrgMember;
}

// ---------------------------------------------------------------------------
// POST /api/api-tokens  — create; returns the plaintext token ONCE.
// ---------------------------------------------------------------------------
export async function createApiToken(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ error: "Unauthorized" });
            return;
        }
        const validation = createApiTokenSchema.safeParse(req.body);
        if (!validation.success) {
            res.status(400).json({ error: "Validation failed", details: validation.error.issues });
            return;
        }

        const { token, tokenHash, last4 } = generateApiToken();
        const created = await prisma.apiToken.create({
            data: {
                userId,
                orgId: req.orgId ?? null,
                name: validation.data.name,
                tokenHash,
                last4,
            },
            select: SAFE_SELECT,
        });

        log.info({ tokenId: created.id, orgId: created.orgId }, "API token created");
        // The ONLY time the plaintext is returned. Never logged.
        res.status(201).json({ ...maskRow(created), token });
    } catch (err) {
        next(err);
    }
}

// ---------------------------------------------------------------------------
// GET /api/api-tokens  — list (masked).
// ---------------------------------------------------------------------------
export async function listApiTokens(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ error: "Unauthorized" });
            return;
        }
        const where = req.orgId ? { orgId: req.orgId } : { userId };
        const tokens = await prisma.apiToken.findMany({
            where,
            orderBy: { createdAt: "desc" },
            select: SAFE_SELECT,
        });
        res.json({ tokens: tokens.map(maskRow) });
    } catch (err) {
        next(err);
    }
}

// ---------------------------------------------------------------------------
// POST /api/api-tokens/:id/revoke  — set revokedAt.
// ---------------------------------------------------------------------------
export async function revokeApiToken(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        const id = req.params.id as string;
        const existing = await prisma.apiToken.findUnique({
            where: { id },
            select: { id: true, userId: true, orgId: true, revokedAt: true },
        });
        if (!existing) {
            res.status(404).json({ error: "API token not found" });
            return;
        }
        if (!canAccess(existing, req)) {
            res.status(403).json({ error: "Forbidden" });
            return;
        }
        if (existing.revokedAt === null) {
            await prisma.apiToken.update({ where: { id }, data: { revokedAt: new Date() } });
            log.info({ tokenId: id }, "API token revoked");
        }
        const updated = await prisma.apiToken.findUnique({ where: { id }, select: SAFE_SELECT });
        res.json(maskRow(updated as SafeToken));
    } catch (err) {
        next(err);
    }
}

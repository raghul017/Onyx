// =============================================================================
// Domain Verification Controller
// =============================================================================

import type { Request, Response, NextFunction } from "express";
import { prisma } from "../lib/prisma.js";
import { assertNotSSRF } from "../lib/ssrf-guard.js";
import {
    generateVerificationToken,
    extractDomain,
    verifyDomain,
} from "../services/domain-verify.service.js";
import {
    initiateVerificationSchema,
    checkVerificationSchema,
} from "../validators/schemas.js";

// ---------------------------------------------------------------------------
// POST /api/verify-target — Generate a token for the domain
// ---------------------------------------------------------------------------

export async function initiateVerification(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        const validation = initiateVerificationSchema.safeParse(req.body);
        if (!validation.success) {
            res.status(400).json({ error: "Validation failed", details: validation.error.issues });
            return;
        }

        const { specUrl } = validation.data;
        const userId = req.user!.id;

        // Block SSRF targets
        try {
            await assertNotSSRF(specUrl);
        } catch {
            res.status(400).json({ error: "Blocked URL", message: "URL resolves to a private/internal IP address." });
            return;
        }

        const domain = extractDomain(specUrl);

        // Check if already verified
        const existing = await prisma.verifiedTarget.findUnique({
            where: { userId_domain: { userId, domain } },
        });

        if (existing?.verifiedAt) {
            res.json({
                domain,
                token: existing.token,
                verifiedAt: existing.verifiedAt,
                alreadyVerified: true,
            });
            return;
        }

        // Upsert — regenerate token on re-initiate to reset stale attempts
        const token = generateVerificationToken();
        const record = await prisma.verifiedTarget.upsert({
            where: { userId_domain: { userId, domain } },
            create: { userId, domain, token },
            update: { token, verifiedAt: null },
        });

        res.json({ domain: record.domain, token: record.token, verifiedAt: null, alreadyVerified: false });
    } catch (err) {
        next(err);
    }
}

// ---------------------------------------------------------------------------
// POST /api/verify-target/check — Probe the domain and confirm ownership
// ---------------------------------------------------------------------------

export async function checkVerification(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        const validation = checkVerificationSchema.safeParse(req.body);
        if (!validation.success) {
            res.status(400).json({ error: "Validation failed", details: validation.error.issues });
            return;
        }

        const { domain } = validation.data;
        const userId = req.user!.id;

        const record = await prisma.verifiedTarget.findUnique({
            where: { userId_domain: { userId, domain } },
        });

        if (!record) {
            res.status(404).json({ error: "No pending verification for this domain. Call POST /verify-target first." });
            return;
        }

        // Already verified — idempotent
        if (record.verifiedAt) {
            res.json({ verified: true, verifiedAt: record.verifiedAt, method: null });
            return;
        }

        const method = await verifyDomain(domain, record.token);

        if (method) {
            const updated = await prisma.verifiedTarget.update({
                where: { id: record.id },
                data: { verifiedAt: new Date() },
            });
            res.json({ verified: true, verifiedAt: updated.verifiedAt, method });
        } else {
            res.json({ verified: false });
        }
    } catch (err) {
        next(err);
    }
}

// ---------------------------------------------------------------------------
// GET /api/verify-target — List all verified domains for the current user
// ---------------------------------------------------------------------------

export async function listVerifiedTargets(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        const userId = req.user!.id;
        const targets = await prisma.verifiedTarget.findMany({
            where: { userId },
            select: { id: true, domain: true, token: true, verifiedAt: true, createdAt: true },
            orderBy: { createdAt: "desc" },
        });
        res.json({ targets });
    } catch (err) {
        next(err);
    }
}

// ---------------------------------------------------------------------------
// DELETE /api/verify-target/:id — Remove a verified domain record
// ---------------------------------------------------------------------------

export async function deleteVerifiedTarget(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        const userId = req.user!.id;
        const id = req.params.id as string;

        const record = await prisma.verifiedTarget.findUnique({ where: { id } });
        if (!record || record.userId !== userId) {
            res.status(404).json({ error: "Not found" });
            return;
        }

        await prisma.verifiedTarget.delete({ where: { id } });
        res.status(204).end();
    } catch (err) {
        next(err);
    }
}

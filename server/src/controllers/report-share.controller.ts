// =============================================================================
// Report share endpoints (T16a).
//
//   POST   /api/test-runs/:id/share        → create-or-return the active share
//   GET    /api/test-runs/:id/share        → current share status (for the UI)
//   POST   /api/test-runs/:id/share/revoke → revoke (immediate)
//   GET    /api/shared/:token              → PUBLIC, no auth: the report payload
//
// The three owner routes reuse the SAME access rule as viewing the run (owner or
// a member of the owning org). The public route requires no auth and no org
// context, and serves the identical report-safe payload getTestRun builds.
// =============================================================================

import type { Request, Response, NextFunction } from "express";
import { prisma } from "../lib/prisma.js";
import { buildReportPayload } from "./test-run.controller.js";
import {
    createOrGetShare,
    getActiveShare,
    revokeShares,
    resolveShareToken,
    buildShareUrl,
} from "../services/report-share.service.js";
import { logger } from "../lib/logger.js";

const log = logger.child({ component: "report-share" });

/** Same rule as viewing a run: the owner, or a member of the owning org. */
function canAccessRun(
    run: { userId: string | null; orgId: string | null },
    req: Request,
): boolean {
    const isOwner = run.userId != null && run.userId === req.user?.id;
    const isOrgMember =
        run.orgId != null && req.orgId != null && req.orgId === run.orgId;
    return isOwner || isOrgMember;
}

/** The request's own origin, used when no SHARE_BASE_URL/APP_BASE_URL is set. */
function requestOrigin(req: Request): string {
    const proto = (req.headers["x-forwarded-proto"] as string) || req.protocol || "https";
    const host = (req.headers["x-forwarded-host"] as string) || req.get("host") || "";
    return host ? `${proto}://${host}` : "";
}

/** Load the run for an ownership check, or send the right error. */
async function loadRunOr404(
    req: Request,
    res: Response,
): Promise<{ id: string; userId: string | null; orgId: string | null } | null> {
    const id = req.params.id as string;
    const run = await prisma.testRun.findUnique({
        where: { id },
        select: { id: true, userId: true, orgId: true },
    });
    if (!run) {
        res.status(404).json({ error: "Test run not found" });
        return null;
    }
    if (!canAccessRun(run, req)) {
        res.status(403).json({ error: "Forbidden: Not your test run" });
        return null;
    }
    return run;
}

// ---------------------------------------------------------------------------
// POST /api/test-runs/:id/share — create or return the active share
// ---------------------------------------------------------------------------
export async function createShare(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        const run = await loadRunOr404(req, res);
        if (!run) return;

        const share = await createOrGetShare({
            testRunId: run.id,
            createdByUserId: req.user?.id ?? null,
            orgId: req.orgId ?? null,
        });

        log.info({ testRunId: run.id, shareId: share.id }, "Report share issued");

        res.status(201).json({
            token: share.token,
            url: buildShareUrl(share.token, requestOrigin(req)),
            createdAt: share.createdAt.toISOString(),
            revokedAt: null,
        });
    } catch (err) {
        next(err);
    }
}

// ---------------------------------------------------------------------------
// GET /api/test-runs/:id/share — current share status
// ---------------------------------------------------------------------------
export async function getShare(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        const run = await loadRunOr404(req, res);
        if (!run) return;

        const share = await getActiveShare(run.id);
        if (!share) {
            res.json({ shared: false });
            return;
        }
        res.json({
            shared: true,
            token: share.token,
            url: buildShareUrl(share.token, requestOrigin(req)),
            createdAt: share.createdAt.toISOString(),
        });
    } catch (err) {
        next(err);
    }
}

// ---------------------------------------------------------------------------
// POST /api/test-runs/:id/share/revoke — revoke immediately
// ---------------------------------------------------------------------------
export async function revokeShare(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        const run = await loadRunOr404(req, res);
        if (!run) return;

        const revoked = await revokeShares(run.id);
        log.info({ testRunId: run.id, revoked }, "Report share(s) revoked");
        res.json({ revoked });
    } catch (err) {
        next(err);
    }
}

// ---------------------------------------------------------------------------
// GET /api/shared/:token — PUBLIC (no auth). Report-safe payload only.
// ---------------------------------------------------------------------------
export async function getSharedReport(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        const token = req.params.token as string;
        const testRunId = await resolveShareToken(token);
        // Unknown AND revoked both 404 — a revoked link is indistinguishable
        // from one that never existed, and nothing confirms a token's shape.
        if (!testRunId) {
            res.status(404).json({ error: "Not found" });
            return;
        }

        const testRun = await prisma.testRun.findUnique({
            where: { id: testRunId },
            include: { logs: { orderBy: { createdAt: "desc" } } },
        });
        if (!testRun) {
            res.status(404).json({ error: "Not found" });
            return;
        }

        // The SAME report-safe payload as the authed endpoint — summary, scores,
        // and findings only. No userId/orgId/credentials/sharer identity.
        res.json(buildReportPayload(testRun));
    } catch (err) {
        next(err);
    }
}

// =============================================================================
// POST /api/test-runs/:id/logs/:logId/rescan (T15b)
//
// Re-runs the check behind ONE finding and reports whether it still reproduces.
// Auth + ownership are enforced exactly as for viewing the run, AND the log must
// belong to that run (so a valid log id from another run can't be re-fired here).
// =============================================================================

import type { Request, Response, NextFunction } from "express";
import { prisma } from "../lib/prisma.js";
import { rescanFinding } from "../services/rescan.service.js";

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

export async function rescanFindingHandler(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        const testRunId = req.params.id as string;
        const logId = req.params.logId as string;

        const run = await prisma.testRun.findUnique({
            where: { id: testRunId },
            select: { id: true, userId: true, orgId: true },
        });
        if (!run) {
            res.status(404).json({ error: "Test run not found" });
            return;
        }
        if (!canAccessRun(run, req)) {
            res.status(403).json({ error: "Forbidden: Not your test run" });
            return;
        }

        // The log must belong to THIS run — a valid id from another run must not
        // be re-firable through this route.
        const owned = await prisma.attackLog.findFirst({
            where: { id: logId, testRunId },
            select: { id: true },
        });
        if (!owned) {
            res.status(404).json({ error: "Finding not found for this test run" });
            return;
        }

        const result = await rescanFinding(logId);

        // "unsupported" is a valid, expected answer — not a client error.
        res.json(result);
    } catch (err) {
        next(err);
    }
}

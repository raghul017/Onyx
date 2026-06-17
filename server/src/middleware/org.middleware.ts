// =============================================================================
// Org Middleware — RBAC enforcement and org context injection
// =============================================================================

import type { Request, Response, NextFunction } from "express";
import { prisma } from "../lib/prisma.js";
import { OrgRole } from "@prisma/client";

const ROLE_RANK: Record<OrgRole, number> = { OWNER: 3, ADMIN: 2, VIEWER: 1 };

// ---------------------------------------------------------------------------
// requireOrgMember(minRole)
// Reads orgId from req.params, verifies the authed user is a member with
// at least minRole, and attaches req.orgMember + req.orgId.
// ---------------------------------------------------------------------------

export function requireOrgMember(minRole: OrgRole) {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ error: "Unauthorized" });
            return;
        }

        const orgId = req.params.orgId as string;
        if (!orgId) {
            res.status(400).json({ error: "orgId param required" });
            return;
        }

        const member = await prisma.orgMember.findUnique({
            where: { orgId_userId: { orgId, userId } },
        });

        if (!member) {
            res.status(403).json({ error: "Not a member of this organization" });
            return;
        }

        if (ROLE_RANK[member.role] < ROLE_RANK[minRole]) {
            res.status(403).json({
                error: "Insufficient role",
                required: minRole,
                actual: member.role,
            });
            return;
        }

        req.orgMember = member;
        req.orgId = orgId;
        next();
    };
}

// ---------------------------------------------------------------------------
// injectOrgContext
// Reads x-org-id header (or orgId query param) and attaches req.orgId.
// Does NOT enforce membership — use on routes where org context is optional.
// ---------------------------------------------------------------------------

export async function injectOrgContext(
    req: Request,
    _res: Response,
    next: NextFunction,
): Promise<void> {
    const orgId =
        (req.headers["x-org-id"] as string | undefined) ||
        (req.query.orgId as string | undefined);

    if (orgId && req.user?.id) {
        const member = await prisma.orgMember.findUnique({
            where: { orgId_userId: { orgId, userId: req.user.id } },
        });
        if (member) {
            req.orgId = orgId;
            req.orgMember = member;
        }
    }
    next();
}

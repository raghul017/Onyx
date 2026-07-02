// =============================================================================
// Org Controller
// =============================================================================

import type { Request, Response, NextFunction } from "express";
import { OrgRole } from "@prisma/client";
import {
    createOrg,
    getOrgById,
    getOrgsForUser,
    deleteOrg,
    createInvite,
    listInvites,
    revokeInvite,
    acceptInvite,
    listMembers,
    updateMemberRole,
    removeMember,
} from "../services/org.service.js";
import { prisma } from "../lib/prisma.js";
import {
    createOrgSchema,
    updateOrgSchema,
    createInviteSchema,
    updateMemberRoleSchema,
    acceptInviteSchema,
} from "../validators/schemas.js";

const CLIENT_URL = process.env.CLIENT_URL ?? "http://localhost:5173";

// ---------------------------------------------------------------------------
// GET /api/orgs — list orgs the current user belongs to
// ---------------------------------------------------------------------------

export async function getMyOrgs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const memberships = await getOrgsForUser(req.user!.id);
        res.json({
            orgs: memberships.map((m) => ({
                id: m.org.id,
                name: m.org.name,
                slug: m.org.slug,
                plan: m.org.plan,
                role: m.role,
            })),
        });
    } catch (err) { next(err); }
}

// ---------------------------------------------------------------------------
// POST /api/orgs — create a new org
// ---------------------------------------------------------------------------

export async function createOrgHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const parsed = createOrgSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({ error: "Validation failed", details: parsed.error.issues });
            return;
        }
        const org = await createOrg(parsed.data.name, req.user!.id);
        res.status(201).json({ org });
    } catch (err) { next(err); }
}

// ---------------------------------------------------------------------------
// GET /api/orgs/:orgId — get org details (requires VIEWER+)
// ---------------------------------------------------------------------------

export async function getOrgHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const org = await getOrgById(req.params.orgId as string);
        if (!org) { res.status(404).json({ error: "Org not found" }); return; }
        res.json({ org });
    } catch (err) { next(err); }
}

// ---------------------------------------------------------------------------
// PATCH /api/orgs/:orgId — rename org (OWNER only)
// ---------------------------------------------------------------------------

export async function updateOrgHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const parsed = updateOrgSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({ error: "Validation failed", details: parsed.error.issues });
            return;
        }
        const org = await prisma.organization.update({
            where: { id: req.params.orgId as string },
            data: { name: parsed.data.name },
        });
        res.json({ org });
    } catch (err) { next(err); }
}

// ---------------------------------------------------------------------------
// DELETE /api/orgs/:orgId — delete org (OWNER only)
// ---------------------------------------------------------------------------

export async function deleteOrgHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        await deleteOrg(req.params.orgId as string);
        res.status(204).end();
    } catch (err) { next(err); }
}

// ---------------------------------------------------------------------------
// GET /api/orgs/:orgId/members
// ---------------------------------------------------------------------------

export async function listMembersHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const members = await listMembers(req.params.orgId as string);
        res.json({
            members: members.map((m) => ({
                id: m.id,
                userId: m.userId,
                email: m.user.email,
                role: m.role,
                joinedAt: m.joinedAt,
            })),
        });
    } catch (err) { next(err); }
}

// ---------------------------------------------------------------------------
// PATCH /api/orgs/:orgId/members/:userId — update role (OWNER only)
// ---------------------------------------------------------------------------

export async function updateMemberRoleHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const parsed = updateMemberRoleSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({ error: "role must be OWNER | ADMIN | VIEWER" });
            return;
        }
        const member = await updateMemberRole(
            req.params.orgId as string,
            req.params.userId as string,
            parsed.data.role as OrgRole,
        );
        res.json({ member });
    } catch (err: any) {
        if (err.statusCode) { res.status(err.statusCode).json({ error: err.message }); return; }
        next(err);
    }
}

// ---------------------------------------------------------------------------
// DELETE /api/orgs/:orgId/members/:userId — remove member (OWNER only)
// ---------------------------------------------------------------------------

export async function removeMemberHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        await removeMember(req.params.orgId as string, req.params.userId as string);
        res.status(204).end();
    } catch (err: any) {
        if (err.statusCode) { res.status(err.statusCode).json({ error: err.message }); return; }
        next(err);
    }
}

// ---------------------------------------------------------------------------
// POST /api/orgs/:orgId/invites — create invite link (ADMIN+)
// ---------------------------------------------------------------------------

export async function createInviteHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const parsed = createInviteSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({ error: "Validation failed", details: parsed.error.issues });
            return;
        }
        // Invites may only grant ADMIN or VIEWER — an OWNER seat is never handed
        // out via a link (prevents ADMINs, who can invite, from minting OWNERs).
        if (parsed.data.role === "OWNER") {
            res.status(400).json({ error: "role must be ADMIN | VIEWER" });
            return;
        }
        const invite = await createInvite(
            req.params.orgId as string,
            parsed.data.email.trim().toLowerCase(),
            parsed.data.role as OrgRole,
            req.user!.id,
        );
        res.status(201).json({
            invite: {
                id: invite.id,
                email: invite.email,
                role: invite.role,
                expiresAt: invite.expiresAt,
                inviteUrl: `${CLIENT_URL}/invite/accept?token=${invite.token}`,
            },
        });
    } catch (err) { next(err); }
}

// ---------------------------------------------------------------------------
// GET /api/orgs/:orgId/invites — list pending invites (ADMIN+)
// ---------------------------------------------------------------------------

export async function listInvitesHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const invites = await listInvites(req.params.orgId as string);
        res.json({ invites });
    } catch (err) { next(err); }
}

// ---------------------------------------------------------------------------
// DELETE /api/orgs/:orgId/invites/:inviteId — revoke invite (ADMIN+)
// ---------------------------------------------------------------------------

export async function revokeInviteHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        await revokeInvite(req.params.inviteId as string, req.params.orgId as string);
        res.status(204).end();
    } catch (err) { next(err); }
}

// ---------------------------------------------------------------------------
// POST /api/invites/accept — accept invite (any authed user)
// ---------------------------------------------------------------------------

export async function acceptInviteHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const parsed = acceptInviteSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({ error: "token is required" });
            return;
        }
        const result = await acceptInvite(parsed.data.token, req.user!.id);
        res.json({ orgId: result.orgId, role: result.member.role });
    } catch (err: any) {
        if (err.statusCode) { res.status(err.statusCode).json({ error: err.message }); return; }
        next(err);
    }
}

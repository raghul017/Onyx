// =============================================================================
// Org Service — pure Prisma logic, no Express types
// =============================================================================

import crypto from "crypto";
import { prisma } from "../lib/prisma.js";
import { OrgRole, Plan, Prisma } from "@prisma/client";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toSlug(name: string): string {
    return name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
}

async function uniqueSlug(base: string): Promise<string> {
    let slug = base;
    let i = 1;
    while (await prisma.organization.findUnique({ where: { slug } })) {
        slug = `${base}-${i++}`;
    }
    return slug;
}

// ---------------------------------------------------------------------------
// Create org + make creator OWNER (atomic)
// ---------------------------------------------------------------------------

export async function createOrg(name: string, creatorUserId: string) {
    const slug = await uniqueSlug(toSlug(name));
    return prisma.$transaction(async (tx) => {
        const org = await tx.organization.create({ data: { name, slug } });
        await tx.orgMember.create({
            data: { orgId: org.id, userId: creatorUserId, role: "OWNER" },
        });
        return org;
    });
}

// ---------------------------------------------------------------------------
// Query helpers
// ---------------------------------------------------------------------------

export async function getOrgById(orgId: string) {
    return prisma.organization.findUnique({
        where: { id: orgId },
        include: {
            members: { include: { user: { select: { id: true, email: true } } } },
        },
    });
}

export async function getOrgsForUser(userId: string) {
    return prisma.orgMember.findMany({
        where: { userId },
        include: {
            org: { select: { id: true, name: true, slug: true, plan: true } },
        },
        orderBy: { joinedAt: "asc" },
    });
}

// ---------------------------------------------------------------------------
// Invite
// ---------------------------------------------------------------------------

export async function createInvite(
    orgId: string,
    email: string,
    role: OrgRole,
    createdBy: string,
) {
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    return prisma.orgInvite.create({
        data: { orgId, email, role, token, createdBy, expiresAt },
    });
}

export async function listInvites(orgId: string) {
    return prisma.orgInvite.findMany({
        where: { orgId },
        orderBy: { createdAt: "desc" },
    });
}

export async function revokeInvite(inviteId: string, orgId: string) {
    return prisma.orgInvite.deleteMany({ where: { id: inviteId, orgId } });
}

export async function acceptInvite(token: string, userId: string) {
    return prisma.$transaction(async (tx) => {
        const invite = await tx.orgInvite.findUnique({ where: { token } });
        if (!invite) throw Object.assign(new Error("Invite not found"), { statusCode: 404 });
        if (invite.acceptedAt) throw Object.assign(new Error("Invite already used"), { statusCode: 409 });
        if (invite.expiresAt < new Date()) throw Object.assign(new Error("Invite expired"), { statusCode: 410 });

        // Bind the invite to the invited email. Without this, the invite link is
        // a bearer token: anyone who obtains it (leaked/forwarded/logged) could
        // join the org at the invited role. Require the accepting user's email
        // to match the address the invite was issued to (case-insensitive).
        const accepting = await tx.user.findUnique({
            where: { id: userId },
            select: { email: true },
        });
        if (
            !accepting ||
            accepting.email.toLowerCase() !== invite.email.toLowerCase()
        ) {
            throw Object.assign(
                new Error("This invite was sent to a different email address"),
                { statusCode: 403 },
            );
        }

        const member = await tx.orgMember.upsert({
            where: { orgId_userId: { orgId: invite.orgId, userId } },
            create: { orgId: invite.orgId, userId, role: invite.role },
            update: { role: invite.role },
        });
        await tx.orgInvite.update({ where: { id: invite.id }, data: { acceptedAt: new Date() } });
        return { member, orgId: invite.orgId };
    });
}

// ---------------------------------------------------------------------------
// Members
// ---------------------------------------------------------------------------

export async function listMembers(orgId: string) {
    return prisma.orgMember.findMany({
        where: { orgId },
        include: { user: { select: { id: true, email: true } } },
        orderBy: { joinedAt: "asc" },
    });
}

export async function updateMemberRole(orgId: string, targetUserId: string, role: OrgRole) {
    return prisma.$transaction(async (tx) => {
        await guardLastOwner(tx, orgId, targetUserId, role);
        return tx.orgMember.update({
            where: { orgId_userId: { orgId, userId: targetUserId } },
            data: { role },
        });
    });
}

export async function removeMember(orgId: string, targetUserId: string) {
    return prisma.$transaction(async (tx) => {
        await guardLastOwner(tx, orgId, targetUserId, null);
        return tx.orgMember.delete({
            where: { orgId_userId: { orgId, userId: targetUserId } },
        });
    });
}

/**
 * Guards against demoting/removing the last OWNER. Runs inside the same
 * transaction as the mutation so two concurrent requests can't each read
 * ownerCount=2 and both proceed, leaving the org with zero owners.
 */
async function guardLastOwner(
    tx: Prisma.TransactionClient,
    orgId: string,
    targetUserId: string,
    newRole: OrgRole | null,
) {
    const member = await tx.orgMember.findUnique({
        where: { orgId_userId: { orgId, userId: targetUserId } },
    });
    if (!member) {
        throw Object.assign(new Error("Member not found in this organization"), {
            statusCode: 404,
        });
    }
    if (member.role !== "OWNER") return;
    // Removing or demoting an OWNER — make sure another OWNER exists
    const ownerCount = await tx.orgMember.count({ where: { orgId, role: "OWNER" } });
    if (ownerCount <= 1 && (!newRole || newRole !== "OWNER")) {
        throw Object.assign(new Error("Cannot remove the last OWNER"), { statusCode: 400 });
    }
}

// ---------------------------------------------------------------------------
// Delete org
// ---------------------------------------------------------------------------

export async function deleteOrg(orgId: string) {
    return prisma.organization.delete({ where: { id: orgId } });
}

// ---------------------------------------------------------------------------
// Effective plan — org plan takes precedence over user plan when org active
// ---------------------------------------------------------------------------

/**
 * A paid plan is only in effect while it hasn't expired. If planExpiresAt is in
 * the past (e.g. a renewal charge was missed and no cancel webhook fired), the
 * effective plan falls back to FREE so lapsed subscribers lose paid features.
 */
function effective(plan: Plan, planExpiresAt: Date | null): Plan {
    if (plan === "FREE") return "FREE";
    if (planExpiresAt && planExpiresAt.getTime() < Date.now()) return "FREE";
    return plan;
}

export async function getEffectivePlan(userId: string, orgId?: string | null): Promise<Plan> {
    if (orgId) {
        const org = await prisma.organization.findUnique({
            where: { id: orgId },
            select: { plan: true, planExpiresAt: true },
        });
        if (org) return effective(org.plan, org.planExpiresAt);
    }
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { plan: true, planExpiresAt: true },
    });
    if (!user) return "FREE";
    return effective(user.plan, user.planExpiresAt);
}

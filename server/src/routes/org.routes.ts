// =============================================================================
// Org Routes
// =============================================================================

import { Router } from "express";
import { authenticateToken } from "../middleware/auth.js";
import { requireOrgMember } from "../middleware/org.middleware.js";
import {
    getMyOrgs,
    createOrgHandler,
    getOrgHandler,
    updateOrgHandler,
    deleteOrgHandler,
    listMembersHandler,
    updateMemberRoleHandler,
    removeMemberHandler,
    createInviteHandler,
    listInvitesHandler,
    revokeInviteHandler,
    acceptInviteHandler,
} from "../controllers/org.controller.js";

const router = Router();

// All org routes require authentication
router.use(authenticateToken);

// My orgs (no org context needed)
router.get("/orgs", getMyOrgs);
router.post("/orgs", createOrgHandler);

// Accept invite (token carries org context)
router.post("/invites/accept", acceptInviteHandler);

// Org-scoped — role enforced per route
router.get("/orgs/:orgId", requireOrgMember("VIEWER"), getOrgHandler);
router.patch("/orgs/:orgId", requireOrgMember("OWNER"), updateOrgHandler);
router.delete("/orgs/:orgId", requireOrgMember("OWNER"), deleteOrgHandler);

router.get("/orgs/:orgId/members", requireOrgMember("VIEWER"), listMembersHandler);
router.patch("/orgs/:orgId/members/:userId", requireOrgMember("OWNER"), updateMemberRoleHandler);
router.delete("/orgs/:orgId/members/:userId", requireOrgMember("OWNER"), removeMemberHandler);

router.post("/orgs/:orgId/invites", requireOrgMember("ADMIN"), createInviteHandler);
router.get("/orgs/:orgId/invites", requireOrgMember("ADMIN"), listInvitesHandler);
router.delete("/orgs/:orgId/invites/:inviteId", requireOrgMember("ADMIN"), revokeInviteHandler);

export default router;

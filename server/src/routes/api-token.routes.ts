// =============================================================================
// API Token Routes (T10a) — manage long-lived REST credentials.
//
// SESSION-ONLY: requireSessionAuth blocks API-token-authenticated callers, so a
// leaked token can't mint or revoke more tokens. Org context is optional.
// =============================================================================

import { Router } from "express";
import { authenticateToken, requireSessionAuth } from "../middleware/auth.js";
import { injectOrgContext } from "../middleware/org.middleware.js";
import {
    createApiToken,
    listApiTokens,
    revokeApiToken,
} from "../controllers/api-token.controller.js";

const router = Router();

router.use(authenticateToken);
router.use(requireSessionAuth); // manage tokens from a session, not with a token
router.use(injectOrgContext);

router.post("/api-tokens", createApiToken);
router.get("/api-tokens", listApiTokens);
router.post("/api-tokens/:id/revoke", revokeApiToken);

export default router;

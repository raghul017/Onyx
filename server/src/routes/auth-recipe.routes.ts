// =============================================================================
// Auth Recipe Routes (T7a) — CRUD for static scan credentials.
// All routes require auth; org context is optional (injectOrgContext) so a
// recipe can be scoped to the caller's active org.
// =============================================================================

import { Router } from "express";
import { authenticateToken } from "../middleware/auth.js";
import { injectOrgContext } from "../middleware/org.middleware.js";
import {
    createAuthRecipe,
    listAuthRecipes,
    getAuthRecipe,
    updateAuthRecipe,
    deleteAuthRecipe,
} from "../controllers/auth-recipe.controller.js";

const router = Router();

router.use(authenticateToken);
router.use(injectOrgContext);

router.post("/auth-recipes", createAuthRecipe);
router.get("/auth-recipes", listAuthRecipes);
router.get("/auth-recipes/:id", getAuthRecipe);
router.patch("/auth-recipes/:id", updateAuthRecipe);
router.delete("/auth-recipes/:id", deleteAuthRecipe);

export default router;

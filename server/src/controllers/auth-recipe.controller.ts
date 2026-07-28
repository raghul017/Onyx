// =============================================================================
// Auth Recipe Controller (T7a) — CRUD for static scan credentials.
//
// Secrets are encrypted at rest and NEVER returned in full or logged: every
// response goes through maskRecipe(). Scoped to the caller (userId) or their
// active org (req.orgId, set by injectOrgContext), mirroring the test-run
// controller's ownership model.
// =============================================================================

import type { Request, Response, NextFunction } from "express";
import { prisma } from "../lib/prisma.js";
import {
    createAuthRecipeSchema,
    updateAuthRecipeSchema,
} from "../validators/schemas.js";
import { buildRecipeStorage, maskRecipe, isDynamicType } from "../services/auth-recipe.service.js";
import { isEncryptionConfigured } from "../lib/crypto.js";
import { logger } from "../lib/logger.js";

const log = logger.child({ component: "auth-recipe" });

// Non-secret columns only — secretEnc is NEVER selected for a response.
const SAFE_SELECT = {
    id: true,
    userId: true,
    orgId: true,
    name: true,
    type: true,
    meta: true,
    createdAt: true,
    updatedAt: true,
} as const;

/** Owner or a member of the owning org may access a recipe. */
function canAccess(
    recipe: { userId: string | null; orgId: string | null },
    req: Request,
): boolean {
    const isOwner = recipe.userId != null && recipe.userId === req.user?.id;
    const isOrgMember =
        recipe.orgId != null && req.orgId != null && req.orgId === recipe.orgId;
    return isOwner || isOrgMember;
}

// ---------------------------------------------------------------------------
// POST /api/auth-recipes
// ---------------------------------------------------------------------------
export async function createAuthRecipe(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        if (!isEncryptionConfigured()) {
            res.status(503).json({
                error: "ENCRYPTION_NOT_CONFIGURED",
                message:
                    "Credential encryption is not configured (CREDENTIAL_ENC_KEY is missing). Set it before creating auth recipes.",
            });
            return;
        }

        const validation = createAuthRecipeSchema.safeParse(req.body);
        if (!validation.success) {
            res.status(400).json({ error: "Validation failed", details: validation.error.issues });
            return;
        }
        const { name, type, secret, meta } = validation.data;

        // Normalize meta defaults so attach/resolve logic is unambiguous.
        let normalizedMeta: Record<string, unknown> = { ...meta };
        if (type === "apiKey" && !meta.location) normalizedMeta.location = "header";
        if (type === "oauth2ClientCredentials") {
            normalizedMeta = {
                tokenResponseField: "access_token",
                injectAs: "bearer",
                ...meta,
            };
        }

        // Static secret is a string; dynamic secret is an object → store as JSON.
        // Dynamic types get NO last4 hint (their secret is a JSON blob).
        const dynamic = isDynamicType(type);
        const secretPlain = typeof secret === "string" ? secret : JSON.stringify(secret);
        const { secretEnc, meta: storedMeta } = buildRecipeStorage(
            normalizedMeta,
            secretPlain,
            { includeLast4: !dynamic },
        );

        const created = await prisma.authRecipe.create({
            data: {
                userId: req.user?.id ?? null,
                orgId: req.orgId ?? null,
                name,
                type,
                meta: storedMeta as object,
                secretEnc,
            },
            select: SAFE_SELECT,
        });

        log.info({ recipeId: created.id, type: created.type }, "Auth recipe created");
        res.status(201).json(maskRecipe(created));
    } catch (err) {
        next(err);
    }
}

// ---------------------------------------------------------------------------
// GET /api/auth-recipes  (list, masked)
// ---------------------------------------------------------------------------
export async function listAuthRecipes(
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
        const recipes = await prisma.authRecipe.findMany({
            where,
            orderBy: { createdAt: "desc" },
            select: SAFE_SELECT,
        });
        res.json({ recipes: recipes.map(maskRecipe) });
    } catch (err) {
        next(err);
    }
}

// ---------------------------------------------------------------------------
// GET /api/auth-recipes/:id  (masked)
// ---------------------------------------------------------------------------
export async function getAuthRecipe(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        const recipe = await prisma.authRecipe.findUnique({
            where: { id: req.params.id as string },
            select: SAFE_SELECT,
        });
        if (!recipe) {
            res.status(404).json({ error: "Auth recipe not found" });
            return;
        }
        if (!canAccess(recipe, req)) {
            res.status(403).json({ error: "Forbidden" });
            return;
        }
        res.json(maskRecipe(recipe));
    } catch (err) {
        next(err);
    }
}

// ---------------------------------------------------------------------------
// PATCH /api/auth-recipes/:id
// ---------------------------------------------------------------------------
export async function updateAuthRecipe(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        const id = req.params.id as string;
        const existing = await prisma.authRecipe.findUnique({
            where: { id },
            select: { id: true, userId: true, orgId: true, type: true, meta: true },
        });
        if (!existing) {
            res.status(404).json({ error: "Auth recipe not found" });
            return;
        }
        if (!canAccess(existing, req)) {
            res.status(403).json({ error: "Forbidden" });
            return;
        }

        const validation = updateAuthRecipeSchema.safeParse(req.body);
        if (!validation.success) {
            res.status(400).json({ error: "Validation failed", details: validation.error.issues });
            return;
        }
        const { name, secret, meta } = validation.data;

        const data: Record<string, unknown> = {};
        if (name !== undefined) data.name = name;

        // Merge meta (keep the existing last4 unless the secret is being rotated).
        const existingMeta = (existing.meta ?? {}) as Record<string, unknown>;
        let mergedMeta = meta !== undefined ? { ...existingMeta, ...meta } : existingMeta;

        if (secret !== undefined) {
            if (!isEncryptionConfigured()) {
                res.status(503).json({
                    error: "ENCRYPTION_NOT_CONFIGURED",
                    message: "Credential encryption is not configured (CREDENTIAL_ENC_KEY is missing).",
                });
                return;
            }
            // Static secret is a string; dynamic secret is an object → JSON.
            const dynamic = isDynamicType(existing.type);
            const secretPlain = typeof secret === "string" ? secret : JSON.stringify(secret);
            const built = buildRecipeStorage(mergedMeta as never, secretPlain, {
                includeLast4: !dynamic,
            });
            data.secretEnc = built.secretEnc;
            mergedMeta = built.meta as Record<string, unknown>;
        }
        if (meta !== undefined || secret !== undefined) data.meta = mergedMeta;

        const updated = await prisma.authRecipe.update({
            where: { id },
            data,
            select: SAFE_SELECT,
        });
        log.info({ recipeId: id, rotatedSecret: secret !== undefined }, "Auth recipe updated");
        res.json(maskRecipe(updated));
    } catch (err) {
        next(err);
    }
}

// ---------------------------------------------------------------------------
// DELETE /api/auth-recipes/:id
// ---------------------------------------------------------------------------
export async function deleteAuthRecipe(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        const id = req.params.id as string;
        const existing = await prisma.authRecipe.findUnique({
            where: { id },
            select: { id: true, userId: true, orgId: true },
        });
        if (!existing) {
            res.status(404).json({ error: "Auth recipe not found" });
            return;
        }
        if (!canAccess(existing, req)) {
            res.status(403).json({ error: "Forbidden" });
            return;
        }
        // TestRun.authRecipeId is ON DELETE SET NULL, so run history survives.
        await prisma.authRecipe.delete({ where: { id } });
        log.info({ recipeId: id }, "Auth recipe deleted");
        res.status(204).end();
    } catch (err) {
        next(err);
    }
}

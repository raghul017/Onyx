// =============================================================================
// Routes — Express Router
// =============================================================================

import { Router } from "express";
import rateLimit from "express-rate-limit";
import { prisma } from "../lib/prisma.js";
import {
    getAllTestRuns,
    createTestRun,
    getTestRun,
    getTestRunLogs,
    attackHandler,
    abortTestRun,
    deleteTestRun,
} from "../controllers/test-run.controller.js";
import {
    initiateVerification,
    checkVerification,
    listVerifiedTargets,
    deleteVerifiedTarget,
} from "../controllers/domain-verify.controller.js";
import authRouter from "./auth.js";
import billingRouter from "./billing.routes.js";
import orgRouter from "./org.routes.js";
import authRecipeRouter from "./auth-recipe.routes.js";
import apiTokenRouter from "./api-token.routes.js";
import {
    createShare,
    getShare,
    revokeShare,
    getSharedReport,
} from "../controllers/report-share.controller.js";
import { rescanFindingHandler } from "../controllers/rescan.controller.js";
import { authenticateToken } from "../middleware/auth.js";
import { checkQuota } from "../middleware/quota.middleware.js";
import { injectOrgContext } from "../middleware/org.middleware.js";
import { getEffectivePlan } from "../services/org.service.js";
import { generateTestRunPDF } from "../services/pdf.service.js";
import { openApiSpec } from "../openapi.js";
import { updateUserSchema } from "../validators/schemas.js";

const router = Router();

// ---------------------------------------------------------------------------
// Health Check — MUST stay public and be registered before any router that
// applies global auth (e.g. orgRouter calls router.use(authenticateToken)).
// ---------------------------------------------------------------------------
router.get("/health", (_req, res) => {
    res.json({
        status: "ok",
        service: "onyx-server",
        timestamp: new Date().toISOString(),
    });
});

// ---------------------------------------------------------------------------
// OpenAPI spec — PUBLIC, so Onyx (or any tool) can fetch & scan this API.
// Served on the Render-owned domain → passes domain verification.
// ---------------------------------------------------------------------------
router.get("/openapi.json", (_req, res) => {
    res.json(openApiSpec);
});

// ---------------------------------------------------------------------------
// Auth Routes
// ---------------------------------------------------------------------------
router.use("/auth", authRouter);

// ---------------------------------------------------------------------------
// Billing Routes
// ---------------------------------------------------------------------------
router.use("/billing", billingRouter);

// ---------------------------------------------------------------------------
// Org Routes
// ---------------------------------------------------------------------------
// Public shared-report reads (T16a). The token is ~256-bit and unguessable, but
// rate-limit the endpoint anyway so it can never be used to probe or scrape.
const sharedReportLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 60, // 60 report loads per 15 min per IP — generous for real viewers
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        error: "Rate limit exceeded",
        message: "Too many requests. Please try again later.",
    },
});

// ---------------------------------------------------------------------------
// PUBLIC — shared read-only report (T16a). MUST be registered BEFORE the
// sub-routers mounted at "/" below: each of those calls router.use(
// authenticateToken), and Express runs a mounted router's use() middleware for
// ANY path under its mount point — so registering this later would make the
// public endpoint return 401. Verified empirically.
// ---------------------------------------------------------------------------
router.get("/shared/:token", sharedReportLimiter, getSharedReport);

router.use("/", orgRouter);

// ---------------------------------------------------------------------------
// Auth Recipe Routes (T7a) — static credentials for authenticated scans
// ---------------------------------------------------------------------------
router.use("/", authRecipeRouter);

// ---------------------------------------------------------------------------
// API Token Routes (T10a) — long-lived credentials for the CLI / CI
// ---------------------------------------------------------------------------
router.use("/", apiTokenRouter);

// ---------------------------------------------------------------------------
// Rate limiter for LLM-triggering endpoints (Gemini API credit protection)
// ---------------------------------------------------------------------------
const attackLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour window
    max: 5, // Max 5 test runs per hour per IP
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        error: "Rate limit exceeded",
        message: "Maximum 5 test runs per hour. Please try again later.",
    },
});

// ---------------------------------------------------------------------------
// Test Run Routes (Protected)
// ---------------------------------------------------------------------------

/** Get all test runs for the authenticated user (or active org). */
router.get("/test-runs", authenticateToken, injectOrgContext, getAllTestRuns);

/** Create a new test run (parse spec → generate payloads → launch attacks). */
router.post("/test-runs", authenticateToken, injectOrgContext, attackLimiter, checkQuota("testRun"), createTestRun);

/**
 * POST /api/attack — The primary endpoint for the frontend.
 * Accepts { openApiUrl: string }, fetches spec, runs AI, queues attacks.
 */
router.post("/attack", authenticateToken, injectOrgContext, attackLimiter, checkQuota("testRun"), attackHandler);

/** Abort an in-progress test run — drains BullMQ jobs and marks as FAILED. */
router.post("/test-runs/:id/abort", authenticateToken, injectOrgContext, abortTestRun);

/** Get a test run's summary and all attack logs. */
router.get("/test-runs/:id", authenticateToken, injectOrgContext, getTestRun);

/** Delete a historical test run. */
router.delete("/test-runs/:id", authenticateToken, injectOrgContext, deleteTestRun);

/** Get paginated attack logs for a test run. */
router.get("/test-runs/:id/logs", authenticateToken, injectOrgContext, getTestRunLogs);

// Per-finding re-scans (T15b) — one real request to the target per call, so
// rate-limit them like other outbound work.
const rescanLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 60, // 60 re-scans per 15 min per IP
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        error: "Rate limit exceeded",
        message: "Too many re-scans. Please try again later.",
    },
});

/** Re-run the check behind ONE finding and report whether it still reproduces. */
router.post(
    "/test-runs/:id/logs/:logId/rescan",
    authenticateToken,
    injectOrgContext,
    rescanLimiter,
    rescanFindingHandler,
);

// ---------------------------------------------------------------------------
// Report sharing (T16a)
// ---------------------------------------------------------------------------

/** Create (or return) the run's active read-only share link. */
router.post("/test-runs/:id/share", authenticateToken, injectOrgContext, createShare);

/** Current share status for the run (for the UI). */
router.get("/test-runs/:id/share", authenticateToken, injectOrgContext, getShare);

/** Revoke the run's share link(s) — takes effect immediately. */
router.post("/test-runs/:id/share/revoke", authenticateToken, injectOrgContext, revokeShare);


/** Export a completed test run as a PDF report (Pro/Team only). */
router.get("/test-runs/:id/export/pdf", authenticateToken, async (req, res) => {
    const userId = req.user!.id;
    const { id } = req.params;

    // Resolve the run's org so we gate on the EFFECTIVE plan (org plan when the
    // run is org-owned), not just the caller's personal plan. Expiry is enforced
    // inside getEffectivePlan.
    const run = await prisma.testRun.findUnique({
        where: { id: id as string },
        select: { orgId: true },
    });
    if (!run) {
        res.status(404).json({ error: "Test run not found" });
        return;
    }

    const effectivePlan = await getEffectivePlan(userId, run.orgId);
    if (effectivePlan === "FREE") {
        res.status(403).json({
            error: "PLAN_REQUIRED",
            message: "PDF export is a Pro feature",
            upgradeUrl: "/billing",
        });
        return;
    }

    try {
        const pdfBuffer = await generateTestRunPDF(id as string, userId);
        res.set({
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename="onyx-report-${id}.pdf"`,
            "Content-Length": String(pdfBuffer.length),
        });
        res.send(pdfBuffer);
    } catch (err: any) {
        const status = err.statusCode ?? 500;
        res.status(status).json({ error: err.message ?? "PDF generation failed" });
    }
});

// ---------------------------------------------------------------------------
// Domain Verification Routes (Protected)
// ---------------------------------------------------------------------------

router.post("/verify-target", authenticateToken, initiateVerification);
router.post("/verify-target/check", authenticateToken, checkVerification);
router.get("/verify-target", authenticateToken, listVerifiedTargets);
router.delete("/verify-target/:id", authenticateToken, deleteVerifiedTarget);

// ---------------------------------------------------------------------------
// User
// ---------------------------------------------------------------------------

router.get("/user/me", authenticateToken, async (req, res) => {
    const userId = req.user!.id;
    const [user, memberships] = await Promise.all([
        prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, email: true, name: true, plan: true, planExpiresAt: true },
        }),
        prisma.orgMember.findMany({
            where: { userId },
            select: {
                role: true,
                org: { select: { id: true, name: true, slug: true, plan: true } },
            },
        }),
    ]);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    res.json({
        ...user,
        orgs: memberships.map((m) => ({ ...m.org, role: m.role })),
    });
});

/** Update the authenticated user's display name. */
router.patch("/user/me", authenticateToken, async (req, res) => {
    const userId = req.user!.id;
    const validation = updateUserSchema.safeParse(req.body);
    if (!validation.success) {
        res.status(400).json({ error: "Validation failed", details: validation.error.issues });
        return;
    }
    const { name } = validation.data;
    const updated = await prisma.user.update({
        where: { id: userId },
        data: { name },
        select: { id: true, email: true, name: true, plan: true, planExpiresAt: true },
    });
    res.json(updated);
});

export default router;

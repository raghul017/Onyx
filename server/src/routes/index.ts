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
import { authenticateToken } from "../middleware/auth.js";
import { checkQuota } from "../middleware/quota.middleware.js";
import { injectOrgContext } from "../middleware/org.middleware.js";
import { generateTestRunPDF } from "../services/pdf.service.js";

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
router.use("/", orgRouter);

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
router.post("/attack", authenticateToken, injectOrgContext, attackLimiter, attackHandler);

/** Abort an in-progress test run — drains BullMQ jobs and marks as FAILED. */
router.post("/test-runs/:id/abort", authenticateToken, abortTestRun);

/** Get a test run's summary and all attack logs. */
router.get("/test-runs/:id", authenticateToken, getTestRun);

/** Delete a historical test run. */
router.delete("/test-runs/:id", authenticateToken, deleteTestRun);

/** Get paginated attack logs for a test run. */
router.get("/test-runs/:id/logs", authenticateToken, getTestRunLogs);

/** Export a completed test run as a PDF report (Pro/Team only). */
router.get("/test-runs/:id/export/pdf", authenticateToken, async (req, res) => {
    const userId = req.user!.id;
    const { id } = req.params;

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { plan: true } });
    if (!user || user.plan === "FREE") {
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
            select: { id: true, email: true, plan: true, planExpiresAt: true },
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

export default router;

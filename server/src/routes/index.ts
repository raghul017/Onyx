// =============================================================================
// Routes — Express Router
// =============================================================================

import { Router } from "express";
import rateLimit from "express-rate-limit";
import {
    getAllTestRuns,
    createTestRun,
    getTestRun,
    getTestRunLogs,
    attackHandler,
    abortTestRun,
    deleteTestRun,
} from "../controllers/test-run.controller.js";
import authRouter from "./auth.js";
import { authenticateToken } from "../middleware/auth.js";

const router = Router();

// ---------------------------------------------------------------------------
// Auth Routes
// ---------------------------------------------------------------------------
router.use("/auth", authRouter);

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

/** Get all test runs for the authenticated user. */
router.get("/test-runs", authenticateToken, getAllTestRuns);

/** Create a new test run (parse spec → generate payloads → launch attacks). */
router.post("/test-runs", authenticateToken, attackLimiter, createTestRun);

/**
 * POST /api/attack — The primary endpoint for the frontend.
 * Accepts { openApiUrl: string }, fetches spec, runs AI, queues attacks.
 */
router.post("/attack", authenticateToken, attackLimiter, attackHandler);

/** Abort an in-progress test run — drains BullMQ jobs and marks as FAILED. */
router.post("/test-runs/:id/abort", authenticateToken, abortTestRun);

/** Get a test run's summary and all attack logs. */
router.get("/test-runs/:id", authenticateToken, getTestRun);

/** Delete a historical test run. */
router.delete("/test-runs/:id", authenticateToken, deleteTestRun);

/** Get paginated attack logs for a test run. */
router.get("/test-runs/:id/logs", authenticateToken, getTestRunLogs);

// ---------------------------------------------------------------------------
// Health Check
// ---------------------------------------------------------------------------

router.get("/health", (_req, res) => {
    res.json({
        status: "ok",
        service: "onyx-server",
        timestamp: new Date().toISOString(),
    });
});

export default router;

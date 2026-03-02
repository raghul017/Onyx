// =============================================================================
// Routes — Express Router
// =============================================================================

import { Router } from "express";
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
// Test Run Routes (Protected)
// ---------------------------------------------------------------------------

/** Get all test runs for the authenticated user. */
router.get("/test-runs", authenticateToken, getAllTestRuns);

/** Create a new test run (parse spec → generate payloads → launch attacks). */
router.post("/test-runs", authenticateToken, createTestRun);

/**
 * POST /api/attack — The primary endpoint for the frontend.
 * Accepts { openApiUrl: string }, fetches spec, runs AI, queues attacks.
 */
router.post("/attack", authenticateToken, attackHandler);

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

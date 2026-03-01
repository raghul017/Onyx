// =============================================================================
// Routes — Express Router
// =============================================================================

import { Router } from "express";
import {
    createTestRun,
    getTestRun,
    getTestRunLogs,
    attackHandler,
} from "../controllers/test-run.controller.js";

const router = Router();

// ---------------------------------------------------------------------------
// Test Run Routes
// ---------------------------------------------------------------------------

/** Create a new test run (parse spec → generate payloads → launch attacks). */
router.post("/test-runs", createTestRun);

/**
 * POST /api/attack — The primary endpoint for the frontend.
 * Accepts { openApiUrl: string }, fetches spec, runs AI, queues attacks.
 */
router.post("/attack", attackHandler);

/** Get a test run's summary and all attack logs. */
router.get("/test-runs/:id", getTestRun);

/** Get paginated attack logs for a test run. */
router.get("/test-runs/:id/logs", getTestRunLogs);

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

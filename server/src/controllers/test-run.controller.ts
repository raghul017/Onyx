// =============================================================================
// Test Run Controller — REST API Handlers
// =============================================================================

import type { Request, Response, NextFunction } from "express";
import { prisma } from "../lib/prisma.js";
import { createTestRunSchema } from "../validators/schemas.js";
import {
    parseOpenApiSpec,
    OpenApiParserError,
} from "../services/openapi-parser.js";
import { generatePayloadsForEndpoint } from "../services/ai-payload.js";
import { enqueueAttackJobs } from "../queues/producer.js";
import { wsManager } from "../websockets/ws-manager.js";
import { assertNotSSRF } from "../lib/ssrf-guard.js";
import type {
    CreateTestRunResponse,
    GetTestRunResponse,
    PaginatedLogsResponse,
    AttackResult,
    TestRunSummary,
    WsServerMessage,
} from "../types/shared.js";
import { getSeverity, getOverallScore, getScoreLabel } from "../utils/severity.js";

// ---------------------------------------------------------------------------
// GET /api/test-runs — List all test runs for the current user
// ---------------------------------------------------------------------------

export async function getAllTestRuns(
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

        const orgId = req.orgId;
        const rawRuns = await prisma.testRun.findMany({
            where: orgId ? { orgId } : { userId },
            orderBy: { createdAt: "desc" },
            select: {
                id: true,
                specUrl: true,
                status: true,
                totalEndpoints: true,
                totalAttacks: true,
                completedAttacks: true,
                createdAt: true,
                completedAt: true,
                logs: {
                    select: {
                        statusCode: true,
                        attackType: true,
                        responseSnippet: true,
                    },
                },
            },
        });

        const testRuns = rawRuns.map(({ logs, ...run }) => {
            const scoredLogs = logs.map((l) => ({
                severity: getSeverity(
                    l.attackType,
                    l.statusCode ?? 0,
                    l.responseSnippet ?? "",
                ),
            }));
            const overallScore = getOverallScore(scoredLogs);
            return {
                ...run,
                overallScore,
                scoreLabel: getScoreLabel(overallScore),
            };
        });

        res.json({ testRuns });
    } catch (err) {
        next(err);
    }
}

// ---------------------------------------------------------------------------
// DELETE /api/test-runs/:id — Delete a test run and its nested logs
// ---------------------------------------------------------------------------

export async function deleteTestRun(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        const id = req.params.id as string;
        const userId = req.user?.id;

        if (!userId) {
            res.status(401).json({ error: "Unauthorized" });
            return;
        }

        const testRun = await prisma.testRun.findUnique({
            where: { id },
        });

        if (!testRun) {
            res.status(404).json({ error: "Test run not found" });
            return;
        }

        const isOwner = testRun.userId === userId;
        const isOrgMember = testRun.orgId && req.orgId === testRun.orgId;
        if (!isOwner && !isOrgMember) {
            res.status(403).json({ error: "Forbidden: Not your test run" });
            return;
        }

        await prisma.testRun.delete({
            where: { id },
        });

        res.status(204).end();
    } catch (err) {
        next(err);
    }
}

// ---------------------------------------------------------------------------
// POST /api/test-runs — Create & launch a new test run
// ---------------------------------------------------------------------------

export async function createTestRun(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        // Validate request body
        const validation = createTestRunSchema.safeParse(req.body);
        if (!validation.success) {
            res.status(400).json({
                error: "Validation failed",
                details: validation.error.issues,
            });
            return;
        }

        const { specUrl } = validation.data;

        // ── Per-user concurrency cap ──
        const activeRuns = await prisma.testRun.count({
            where: {
                userId: req.user?.id,
                status: { in: ["PARSING", "GENERATING", "ATTACKING"] },
            },
        });

        if (activeRuns >= 2) {
            res.status(429).json({
                error: "Concurrent limit reached",
                message:
                    "You already have 2 active test runs. Please wait for them to complete.",
            });
            return;
        }

        // SSRF Protection — DNS-resolving check blocks internal/private IPs
        try {
            await assertNotSSRF(specUrl);
        } catch {
            res.status(400).json({
                error: "Blocked URL",
                message:
                    "URL resolves to a private/internal IP address and is not allowed.",
            });
            return;
        }

        // Domain Ownership Gate — user must verify the target domain before attacking it.
        // Bypassed when SKIP_DOMAIN_VERIFY=true (dev/testing only — never enable in prod
        // unless you accept scanning unverified domains).
        const skipDomainVerify = process.env.SKIP_DOMAIN_VERIFY === "true";
        const targetDomain = new URL(specUrl).hostname.toLowerCase();

        if (!skipDomainVerify) {
            const verified = await prisma.verifiedTarget.findFirst({
                where: {
                    userId: req.user?.id,
                    domain: targetDomain,
                    verifiedAt: { not: null },
                },
            });

            if (!verified) {
                res.status(403).json({
                    error: "DOMAIN_NOT_VERIFIED",
                    domain: targetDomain,
                    message: `You must verify ownership of "${targetDomain}" before scanning it. Go to Dashboard → Verify Domain.`,
                });
                return;
            }
        }

        // Create the test run record
        const testRun = await prisma.testRun.create({
            data: {
                specUrl,
                status: "PARSING",
                userId: req.user?.id,
                orgId: req.orgId ?? null,
            },
        });

        console.log(
            `[Controller] Created test run ${testRun.id.slice(0, 8)}... for ${specUrl}`,
        );

        // Return immediately so the client can subscribe via WebSocket
        const response: CreateTestRunResponse = {
            testRunId: testRun.id,
            status: "PARSING",
            message:
                "Test run created. Connect via WebSocket to receive live results.",
        };
        res.status(201).json(response);

        // Process asynchronously (non-blocking)
        processTestRunAsync(testRun.id, specUrl).catch((err: unknown) => {
            console.error(
                `[Controller] Async processing failed for ${testRun.id}:`,
                err,
            );
        });
    } catch (err) {
        next(err);
    }
}

// ---------------------------------------------------------------------------
// Async Processing Pipeline
// ---------------------------------------------------------------------------

async function processTestRunAsync(
    testRunId: string,
    specUrl: string,
): Promise<void> {
    try {
        // Give the frontend 500ms to establish the WebSocket connection
        // after receiving the initial HTTP response from createTestRun.
        await new Promise((resolve) => setTimeout(resolve, 500));

        const broadcastStatus = (status: string) => {
            const msg: WsServerMessage = {
                type: "TEST_RUN_STATUS",
                data: {
                    testRunId,
                    status: status as WsServerMessage["data"] extends {
                        status: infer S;
                    }
                        ? S
                        : never,
                    completedAttacks: 0,
                    totalAttacks: 0,
                },
            };
            wsManager.broadcast(testRunId, msg);
        };

        // --- Phase 1: Parse OpenAPI Spec ---
        console.log(`[Pipeline] Parsing spec for ${testRunId.slice(0, 8)}...`);
        broadcastStatus("PARSING");

        let endpoints;
        try {
            endpoints = await parseOpenApiSpec(specUrl);
        } catch (err) {
            const message =
                err instanceof OpenApiParserError
                    ? err.message
                    : "Failed to parse OpenAPI specification";

            await prisma.testRun.update({
                where: { id: testRunId },
                data: { status: "FAILED", errorMessage: message },
            });

            const errorMsg: WsServerMessage = {
                type: "ERROR",
                data: { testRunId, message, code: "SPEC_PARSE_ERROR" },
            };
            wsManager.broadcast(testRunId, errorMsg);
            broadcastStatus("FAILED");
            return;
        }

        // Save parsed endpoints
        const savedEndpoints = await Promise.all(
            endpoints.map((ep) =>
                prisma.targetEndpoint.create({
                    data: {
                        testRunId,
                        method: ep.method,
                        path: ep.path,
                        operationId: ep.operationId ?? null,
                        requestBodySchema:
                            (ep.requestBodySchema as any) ?? undefined,
                    },
                }),
            ),
        );

        await prisma.testRun.update({
            where: { id: testRunId },
            data: {
                status: "GENERATING",
                totalEndpoints: savedEndpoints.length,
            },
        });

        broadcastStatus("GENERATING");
        console.log(
            `[Pipeline] Parsed ${savedEndpoints.length} endpoints for ${testRunId.slice(0, 8)}...`,
        );

        // --- Phase 2: Generate AI Payloads ---
        let totalJobs = 0;

        // Extract base URL from spec URL
        const baseUrl = extractBaseUrl(specUrl);

        // Cap endpoints to prevent excessive Gemini API usage
        const MAX_ENDPOINTS = 20;
        const cappedEndpoints = endpoints.slice(0, MAX_ENDPOINTS);
        const cappedSavedEndpoints = savedEndpoints.slice(0, MAX_ENDPOINTS);
        if (endpoints.length > MAX_ENDPOINTS) {
            console.warn(
                `[Pipeline] Spec has ${endpoints.length} endpoints — capped to ${MAX_ENDPOINTS}`,
            );
        }

        // Flip to ATTACKING immediately so the worker starts firing the first
        // endpoint's jobs while later endpoints are still generating. This
        // removes the long "dead start" where nothing happened until every
        // Gemini call had returned.
        await prisma.testRun.update({
            where: { id: testRunId },
            data: { status: "ATTACKING" },
        });
        wsManager.broadcast(testRunId, {
            type: "TEST_RUN_STATUS",
            data: {
                testRunId,
                status: "ATTACKING",
                completedAttacks: 0,
                totalAttacks: 0,
            },
        });

        // Generate payloads for all endpoints CONCURRENTLY. Each endpoint is an
        // independent Gemini call (with a static fallback), so there's no reason
        // to serialize them. As each one resolves, its jobs are enqueued right
        // away and totalAttacks grows — the worker picks them up continuously.
        const results = await Promise.all(
            cappedEndpoints.map(async (endpoint, i) => {
                const savedEndpoint = cappedSavedEndpoints[i]!;
                const payloads = await generatePayloadsForEndpoint(endpoint);
                const jobCount = await enqueueAttackJobs(payloads, {
                    testRunId,
                    endpointId: savedEndpoint.id,
                    method: endpoint.method,
                    path: endpoint.path,
                    baseUrl,
                });
                // Keep the running total in sync as this endpoint's jobs land,
                // so the progress denominator updates live in the dashboard.
                const updated = await prisma.testRun.update({
                    where: { id: testRunId },
                    data: { totalAttacks: { increment: jobCount } },
                });
                wsManager.broadcast(testRunId, {
                    type: "TEST_RUN_STATUS",
                    data: {
                        testRunId,
                        status: "ATTACKING",
                        completedAttacks: updated.completedAttacks,
                        totalAttacks: updated.totalAttacks,
                    },
                });
                return jobCount;
            }),
        );

        totalJobs = results.reduce((a, n) => a + n, 0);

        // Mark enqueuing complete. The worker won't finalize a run as COMPLETED
        // until this is set, so early-finishing endpoints can't prematurely
        // complete the run while other endpoints are still being enqueued.
        const finalRun = await prisma.testRun.update({
            where: { id: testRunId },
            data: { enqueuedAt: new Date() },
        });

        // If every job already finished before enqueuing wrapped up (tiny runs),
        // finalize here so the run doesn't hang in ATTACKING.
        if (totalJobs > 0 && finalRun.completedAttacks >= totalJobs) {
            const { count } = await prisma.testRun.updateMany({
                where: { id: testRunId, status: { not: "COMPLETED" } },
                data: { status: "COMPLETED", completedAt: new Date() },
            });
            if (count > 0) {
                wsManager.broadcast(testRunId, {
                    type: "TEST_RUN_STATUS",
                    data: {
                        testRunId,
                        status: "COMPLETED",
                        completedAttacks: finalRun.completedAttacks,
                        totalAttacks: totalJobs,
                    },
                });
            }
        }

        console.log(
            `[Pipeline] ${totalJobs} attack jobs enqueued for ${testRunId.slice(0, 8)}...`,
        );
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[Pipeline] Fatal error for ${testRunId}:`, message);

        await prisma.testRun.update({
            where: { id: testRunId },
            data: { status: "FAILED", errorMessage: message },
        });

        const errorMsg: WsServerMessage = {
            type: "ERROR",
            data: { testRunId, message, code: "PIPELINE_ERROR" },
        };
        wsManager.broadcast(testRunId, errorMsg);
    }
}

// ---------------------------------------------------------------------------
// GET /api/test-runs/:id — Get a test run with all logs
// ---------------------------------------------------------------------------

export async function getTestRun(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        const id = req.params.id as string;

        const testRun = await prisma.testRun.findUnique({
            where: { id },
            include: {
                logs: {
                    orderBy: { createdAt: "desc" },
                },
            },
        });

        if (!testRun) {
            res.status(404).json({ error: "Test run not found" });
            return;
        }

        // Ownership check — prevent cross-tenant data access
        if (testRun.userId && testRun.userId !== req.user?.id) {
            res.status(403).json({ error: "Forbidden: Not your test run" });
            return;
        }

        // Compute aggregate metrics
        const logs = testRun.logs;
        const criticalFailures = logs.filter(
            (l: { statusCode: number | null }) =>
                l.statusCode !== null && l.statusCode >= 500,
        ).length;
        const totalLatency = logs.reduce(
            (sum: number, l: { latencyMs: number | null }) =>
                sum + (l.latencyMs ?? 0),
            0,
        );
        const avgLatencyMs =
            logs.length > 0 ? Math.round(totalLatency / logs.length) : 0;

        const summaryBase = {
            id: testRun.id,
            specUrl: testRun.specUrl,
            status: testRun.status as TestRunSummary["status"],
            totalEndpoints: testRun.totalEndpoints,
            totalAttacks: testRun.totalAttacks,
            completedAttacks: testRun.completedAttacks,
            criticalFailures,
            avgLatencyMs,
            createdAt: testRun.createdAt.toISOString(),
            completedAt: testRun.completedAt?.toISOString() ?? null,
        };

        const attackResults: AttackResult[] = logs.map(
            (l: {
                id: string;
                testRunId: string;
                method: string;
                path: string;
                statusCode: number | null;
                latencyMs: number | null;
                payload: string;
                responseSnippet: string | null;
                attackType: string;
                createdAt: Date;
            }) => ({
                id: l.id,
                testRunId: l.testRunId,
                method: l.method as AttackResult["method"],
                endpoint: l.path,
                statusCode: l.statusCode ?? 0,
                responseTime: l.latencyMs ?? 0,
                payload: l.payload,
                responseSnippet: l.responseSnippet ?? "",
                attackType: l.attackType as AttackResult["attackType"],
                timestamp: l.createdAt.toISOString(),
                severity: getSeverity(
                    l.attackType,
                    l.statusCode ?? 0,
                    l.responseSnippet ?? "",
                ),
            }),
        );

        const severityBreakdown = {
            critical: attackResults.filter((l) => l.severity === "CRITICAL").length,
            high:     attackResults.filter((l) => l.severity === "HIGH").length,
            medium:   attackResults.filter((l) => l.severity === "MEDIUM").length,
            low:      attackResults.filter((l) => l.severity === "LOW").length,
            info:     attackResults.filter((l) => l.severity === "INFO").length,
        };
        const overallScore = getOverallScore(attackResults);

        const response: GetTestRunResponse = {
            summary: {
                ...summaryBase,
                overallScore,
                scoreLabel: getScoreLabel(overallScore),
                severityBreakdown,
            },
            logs: attackResults,
        };

        res.json(response);
    } catch (err) {
        next(err);
    }
}

// ---------------------------------------------------------------------------
// GET /api/test-runs/:id/logs — Paginated attack logs
// ---------------------------------------------------------------------------

export async function getTestRunLogs(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        const id = req.params.id as string;
        const page = Math.max(1, parseInt(req.query.page as string) || 1);
        const pageSize = Math.min(
            100,
            Math.max(1, parseInt(req.query.pageSize as string) || 50),
        );

        // Find the test run and verify ownership
        const testRun = await prisma.testRun.findUnique({
            where: { id },
        });

        if (!testRun) {
            res.status(404).json({ error: "Test run not found" });
            return;
        }

        if (testRun.userId && testRun.userId !== req.user?.id) {
            res.status(403).json({ error: "Forbidden: Not your test run" });
            return;
        }

        const [logs, total] = await Promise.all([
            prisma.attackLog.findMany({
                where: { testRunId: id },
                orderBy: { createdAt: "desc" },
                skip: (page - 1) * pageSize,
                take: pageSize,
            }),
            prisma.attackLog.count({ where: { testRunId: id } }),
        ]);

        const attackResults: AttackResult[] = logs.map((l) => ({
            id: l.id,
            testRunId: l.testRunId,
            method: l.method as AttackResult["method"],
            endpoint: l.path,
            statusCode: l.statusCode ?? 0,
            responseTime: l.latencyMs ?? 0,
            payload: l.payload,
            responseSnippet: l.responseSnippet ?? "",
            attackType: l.attackType as AttackResult["attackType"],
            timestamp: l.createdAt.toISOString(),
            severity: getSeverity(l.attackType, l.statusCode ?? 0, l.responseSnippet ?? ""),
        }));

        const response: PaginatedLogsResponse = {
            logs: attackResults,
            total,
            page,
            pageSize,
        };

        res.json(response);
    } catch (err) {
        next(err);
    }
}

// ---------------------------------------------------------------------------
// POST /api/attack — Alias endpoint for the frontend
// ---------------------------------------------------------------------------

/**
 * Accepts { openApiUrl: string }, validates the URL is reachable,
 * then delegates to the full test run pipeline.
 */
export async function attackHandler(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        const { openApiUrl } = req.body as { openApiUrl?: string };

        // Validate input
        if (!openApiUrl || typeof openApiUrl !== "string") {
            res.status(400).json({
                error: "Validation failed",
                message: "Missing required field: openApiUrl (string)",
            });
            return;
        }

        // Validate URL format
        let parsedUrl: URL;
        try {
            parsedUrl = new URL(openApiUrl);
            if (!["http:", "https:"].includes(parsedUrl.protocol)) {
                throw new Error("Invalid protocol");
            }
        } catch {
            res.status(400).json({
                error: "Invalid URL",
                message:
                    "openApiUrl must be a valid HTTP/HTTPS URL pointing to an OpenAPI/Swagger spec (e.g., https://petstore.swagger.io/v2/swagger.json)",
            });
            return;
        }

        // SSRF Protection — DNS-resolving check blocks internal/private IPs
        try {
            await assertNotSSRF(openApiUrl);
        } catch {
            res.status(400).json({
                error: "Blocked URL",
                message:
                    "URL resolves to a private/internal IP address and is not allowed.",
            });
            return;
        }


        // Delegate to the existing pipeline — rewrite body to match createTestRun schema
        req.body = { specUrl: openApiUrl };
        return createTestRun(req, res, next);
    } catch (err) {
        next(err);
    }
}

// ---------------------------------------------------------------------------
// POST /api/test-runs/:id/abort — Stop an in-progress attack
// ---------------------------------------------------------------------------

export async function abortTestRun(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        const id = req.params.id as string;

        // Find the test run and verify ownership
        const testRun = await prisma.testRun.findUnique({
            where: { id },
            include: { endpoints: true },
        });

        if (!testRun) {
            res.status(404).json({ error: "Test run not found" });
            return;
        }

        if (testRun.userId && testRun.userId !== req.user?.id) {
            res.status(403).json({ error: "Forbidden: Not your test run" });
            return;
        }

        // Only abort if it's still in progress
        if (testRun.status === "COMPLETED" || testRun.status === "FAILED") {
            res.status(400).json({
                error: "Cannot abort",
                message: `Test run is already ${testRun.status}`,
            });
            return;
        }

        // 1. Drain all waiting jobs from the BullMQ queue for this test run
        //    Get waiting + delayed jobs and remove ones matching this testRunId
        const { chaosQueue } = await import("../queues/chaos-queue.js");

        const [waiting, delayed] = await Promise.all([
            chaosQueue.getJobs(["waiting", "prioritized"]),
            chaosQueue.getJobs(["delayed"]),
        ]);

        const allJobs = [...waiting, ...delayed];
        let removedCount = 0;

        for (const job of allJobs) {
            if (job.data?.testRunId === id) {
                try {
                    await job.remove();
                    removedCount++;
                } catch {
                    // Job may have been picked up by the worker in the meantime
                }
            }
        }

        // 2. Update test run status in database
        // We set totalAttacks to completedAttacks so the progress bar hits 100% and logic concludes.
        const updated = await prisma.testRun.update({
            where: { id },
            data: {
                status: "FAILED",
                errorMessage: `Aborted by user. ${removedCount} pending jobs removed.`,
                completedAt: new Date(),
                totalAttacks: testRun.completedAttacks, // Cap the total so the UI knows it's fully done
            },
        });

        // 3. Broadcast abort via WebSocket
        const abortMsg: WsServerMessage = {
            type: "TEST_RUN_STATUS",
            data: {
                testRunId: id,
                status: "FAILED",
                completedAttacks: updated.completedAttacks,
                totalAttacks: updated.totalAttacks,
            },
        };
        wsManager.broadcast(id, abortMsg);

        console.log(
            `[Controller] Test run ${id.slice(0, 8)}... ABORTED — removed ${removedCount} pending jobs`,
        );

        res.json({
            status: "aborted",
            removedJobs: removedCount,
            message: `Attack sequence terminated. ${removedCount} pending payloads removed from queue.`,
        });
    } catch (err) {
        next(err);
    }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractBaseUrl(specUrl: string): string {
    try {
        const url = new URL(specUrl);
        return `${url.protocol}//${url.host}`;
    } catch {
        return specUrl;
    }
}

// =============================================================================
// BullMQ Worker — Processes attack jobs
// =============================================================================

import { Worker, Job } from "bullmq";
import { performance } from "node:perf_hooks";
import { prisma } from "../lib/prisma.js";
import { wsManager } from "../websockets/ws-manager.js";
import { redisConnectionOptions, CHAOS_QUEUE_NAME } from "./chaos-queue.js";
import {
    attackJobDataSchema,
    type AttackJobData,
} from "../validators/schemas.js";
import { assertNotSSRF } from "../lib/ssrf-guard.js";
import type { AttackResult, WsServerMessage } from "../types/shared.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const REQUEST_TIMEOUT_MS = 10_000; // 10 seconds
const RESPONSE_SNIPPET_MAX_LENGTH = 500;

// ---------------------------------------------------------------------------
// Worker
// ---------------------------------------------------------------------------

export function startOnyxWorker(): Worker {
    const worker = new Worker<AttackJobData>(
        CHAOS_QUEUE_NAME,
        async (job: Job<AttackJobData>) => {
            return processAttackJob(job);
        },
        {
            connection: redisConnectionOptions,
            concurrency: 5, // Process up to 5 attacks concurrently
            limiter: {
                max: 10,
                duration: 1000, // Max 10 jobs per second
            },
        },
    );

    worker.on("completed", (job) => {
        console.log(
            `[Worker] Job ${job.id} completed for ${job.data.method} ${job.data.path}`,
        );
    });

    worker.on("failed", (job, err) => {
        console.error(`[Worker] Job ${job?.id} failed:`, err.message);
    });

    worker.on("error", (err) => {
        console.error("[Worker] Error:", err.message);
    });

    console.log("[Worker] Onyx worker started");
    return worker;
}

// ---------------------------------------------------------------------------
// Job Processor
// ---------------------------------------------------------------------------

async function processAttackJob(job: Job<AttackJobData>): Promise<void> {
    // Validate job data
    const validation = attackJobDataSchema.safeParse(job.data);
    if (!validation.success) {
        console.error(
            `[Worker] Invalid job data for ${job.id}:`,
            validation.error.issues,
        );
        throw new Error("Invalid job data");
    }

    const {
        testRunId,
        endpointId,
        method,
        path,
        baseUrl,
        payload,
        attackType,
    } = validation.data;

    let statusCode: number | null = null;
    let latencyMs: number | null = null;
    let responseSnippet: string | null = null;
    let error: string | null = null;

    // Build the full URL
    const targetUrl = buildTargetUrl(baseUrl, path);

    // SSRF guard — block requests to private/internal IPs
    try {
        await assertNotSSRF(targetUrl);
    } catch {
        // Skip this job — target resolves to a private/internal IP
        const attackLog = await prisma.attackLog.create({
            data: {
                testRunId,
                endpointId,
                method,
                path,
                payload: payload.replace(/\0/g, "\\u0000"),
                statusCode: 0,
                latencyMs: 0,
                responseSnippet: null,
                attackType,
                error: "SSRF blocked: target resolves to internal/private IP",
            },
        });

        const testRun = await prisma.testRun.update({
            where: { id: testRunId },
            data: { completedAttacks: { increment: 1 } },
        });

        const wsMsg: WsServerMessage = {
            type: "ATTACK_RESULT",
            data: {
                id: attackLog.id,
                testRunId,
                method: method as any,
                endpoint: path,
                statusCode: 0,
                responseTime: 0,
                payload,
                responseSnippet: "",
                attackType: attackType as any,
                timestamp: attackLog.createdAt.toISOString(),
            },
        };
        wsManager.broadcast(testRunId, wsMsg);

        // Check completion
        if (testRun.completedAttacks >= testRun.totalAttacks) {
            await prisma.testRun.updateMany({
                where: { id: testRunId, status: { not: "COMPLETED" } },
                data: { status: "COMPLETED", completedAt: new Date() },
            });
        }
        return;
    }

    try {
        // Execute the HTTP request
        const result = await executeAttack(method, targetUrl, payload);
        statusCode = result.statusCode;
        latencyMs = result.latencyMs;
        responseSnippet = result.responseSnippet;
    } catch (err) {
        error = err instanceof Error ? err.message : String(err);
        latencyMs = 0;

        if (error.includes("AbortError") || error.includes("timeout")) {
            statusCode = 408;
            error = `Request timed out after ${REQUEST_TIMEOUT_MS}ms`;
        } else if (error.includes("ECONNREFUSED")) {
            statusCode = 503;
            error = "Connection refused — target API is unreachable";
        } else if (error.includes("ENOTFOUND")) {
            statusCode = 502;
            error = "DNS resolution failed — target host not found";
        } else {
            statusCode = 0;
        }
    }

    // Save to database
    const attackLog = await prisma.attackLog.create({
        data: {
            testRunId,
            endpointId,
            method,
            path,
            payload: payload.replace(/\0/g, "\\u0000"),
            statusCode,
            latencyMs,
            responseSnippet: responseSnippet?.replace(/\0/g, "\\u0000") ?? null,
            attackType,
            error: error?.replace(/\0/g, "\\u0000") ?? null,
        },
    });

    // Update test run progress
    const testRun = await prisma.testRun.update({
        where: { id: testRunId },
        data: {
            completedAttacks: { increment: 1 },
        },
    });

    // Build attack result for WebSocket broadcast
    const attackResult: AttackResult = {
        id: attackLog.id,
        testRunId,
        method: method as AttackResult["method"],
        endpoint: path,
        statusCode: statusCode ?? 0,
        responseTime: latencyMs ?? 0,
        payload,
        responseSnippet: responseSnippet ?? "",
        attackType: attackType as AttackResult["attackType"],
        timestamp: attackLog.createdAt.toISOString(),
    };

    // Broadcast via WebSocket
    const wsMessage: WsServerMessage = {
        type: "ATTACK_RESULT",
        data: attackResult,
    };
    wsManager.broadcast(testRunId, wsMessage);

    // Also send progress update
    const statusMessage: WsServerMessage = {
        type: "TEST_RUN_STATUS",
        data: {
            testRunId,
            status: testRun.status as any,
            completedAttacks: testRun.completedAttacks,
            totalAttacks: testRun.totalAttacks,
        },
    };
    wsManager.broadcast(testRunId, statusMessage);

    // Check if all attacks are complete (atomic: only update if not already COMPLETED)
    if (testRun.completedAttacks >= testRun.totalAttacks) {
        // Use updateMany with a status filter to prevent double-completion race
        const { count } = await prisma.testRun.updateMany({
            where: {
                id: testRunId,
                status: { not: "COMPLETED" },
            },
            data: {
                status: "COMPLETED",
                completedAt: new Date(),
            },
        });

        // Only broadcast if this worker was the one that actually set COMPLETED
        if (count > 0) {
            const completionMessage: WsServerMessage = {
                type: "TEST_RUN_STATUS",
                data: {
                    testRunId,
                    status: "COMPLETED",
                    completedAttacks: testRun.completedAttacks,
                    totalAttacks: testRun.totalAttacks,
                },
            };
            wsManager.broadcast(testRunId, completionMessage);

            console.log(
                `[Worker] Test run ${testRunId.slice(0, 8)}... COMPLETED`,
            );
        }
    }
}

// ---------------------------------------------------------------------------
// HTTP Attack Executor
// ---------------------------------------------------------------------------

interface AttackExecutionResult {
    statusCode: number;
    latencyMs: number;
    responseSnippet: string;
}

async function executeAttack(
    method: string,
    url: string,
    payload: string,
): Promise<AttackExecutionResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    const headers: Record<string, string> = {
        "User-Agent": "Onyx/1.0 (Security Testing)",
    };

    let body: string | undefined;

    // For methods that support a body, try to send the payload as JSON
    if (["POST", "PUT", "PATCH"].includes(method)) {
        headers["Content-Type"] = "application/json";
        body = isJsonLike(payload)
            ? payload
            : JSON.stringify({ data: payload });
    }

    const startTime = performance.now();

    try {
        const response = await fetch(url, {
            method,
            headers,
            body,
            signal: controller.signal,
            redirect: "follow",
        });

        const latencyMs = Math.round(performance.now() - startTime);

        // Read response text (capped)
        let responseText: string;
        try {
            responseText = await response.text();
        } catch {
            responseText = "[Failed to read response body]";
        }

        const responseSnippet =
            responseText.length > RESPONSE_SNIPPET_MAX_LENGTH
                ? responseText.slice(0, RESPONSE_SNIPPET_MAX_LENGTH) + "…"
                : responseText;

        return {
            statusCode: response.status,
            latencyMs,
            responseSnippet,
        };
    } finally {
        clearTimeout(timeout);
    }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildTargetUrl(baseUrl: string, path: string): string {
    // Ensure baseUrl doesn't end with / and path starts with /
    const base = baseUrl.replace(/\/+$/, "");
    const p = path.startsWith("/") ? path : `/${path}`;
    return `${base}${p}`;
}

function isJsonLike(str: string): boolean {
    const trimmed = str.trim();
    return (
        (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
        (trimmed.startsWith("[") && trimmed.endsWith("]"))
    );
}

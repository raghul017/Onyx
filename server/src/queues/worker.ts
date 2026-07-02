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
import { getSeverity } from "../utils/severity.js";

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
            // Higher concurrency = a steady in-flight pipeline. With ~12 requests
            // always in flight and each finishing in ~100-400ms, jobs stream
            // out continuously instead of firing in bursts of 10 with gaps.
            concurrency: 12,
            // A smooth ceiling (not a bursty batch cap). 30/sec spread across a
            // 100ms window means at most ~3 dispatched per tick — enough to
            // protect the target without the visible "10 then pause" stutter.
            limiter: {
                max: 3,
                duration: 100, // ~30 jobs/sec, evenly paced
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

        // CRITICAL: a permanently-failed job (retries exhausted) must still
        // count toward completion, otherwise completedAttacks can never reach
        // totalAttacks and the run hangs in ATTACKING forever (burning the
        // user's active-run slot). Only act on the FINAL attempt.
        if (!job) return;
        const attemptsAllowed = job.opts.attempts ?? 1;
        const isFinalAttempt = job.attemptsMade >= attemptsAllowed;
        if (!isFinalAttempt) return;

        const testRunId = job.data?.testRunId;
        if (typeof testRunId !== "string") return;

        // Fire-and-forget: record the failed attack as completed and finalize
        // the run if this was the last outstanding job.
        void recordFailedAttempt(testRunId).catch((e) => {
            console.error(
                `[Worker] Failed to record terminal failure for ${testRunId}:`,
                e instanceof Error ? e.message : e,
            );
        });
    });

    worker.on("error", (err) => {
        console.error("[Worker] Error:", err.message);
    });

    console.log("[Worker] Onyx worker started");
    return worker;
}

// ---------------------------------------------------------------------------
// Completion helpers (shared by success path, SSRF-block path, and the
// terminal-failure handler so the logic can never diverge).
// ---------------------------------------------------------------------------

/**
 * Atomically flip a run to COMPLETED iff all jobs are enqueued (enqueuedAt set)
 * and every attack has been accounted for. Uses updateMany with a status filter
 * so concurrent finishers can't double-complete. Broadcasts only if this call
 * was the one that actually set COMPLETED. Safe to call from any path.
 */
async function finalizeIfComplete(testRunId: string): Promise<void> {
    const run = await prisma.testRun.findUnique({
        where: { id: testRunId },
        select: {
            enqueuedAt: true,
            completedAttacks: true,
            totalAttacks: true,
            status: true,
        },
    });
    if (!run) return;
    // Don't resurrect a run the user aborted / that already failed.
    if (run.status === "FAILED" || run.status === "COMPLETED") return;
    if (run.enqueuedAt === null) return;
    if (run.completedAttacks < run.totalAttacks) return;

    // Only ATTACKING runs may transition to COMPLETED. This also closes the
    // race where a run is aborted (→ FAILED) between the read above and here:
    // the filter refuses to overwrite a FAILED/COMPLETED terminal state.
    const { count } = await prisma.testRun.updateMany({
        where: { id: testRunId, status: "ATTACKING" },
        data: { status: "COMPLETED", completedAt: new Date() },
    });

    if (count > 0) {
        const completionMessage: WsServerMessage = {
            type: "TEST_RUN_STATUS",
            data: {
                testRunId,
                status: "COMPLETED",
                completedAttacks: run.totalAttacks,
                totalAttacks: run.totalAttacks,
            },
        };
        wsManager.broadcast(testRunId, completionMessage);
        console.log(`[Worker] Test run ${testRunId.slice(0, 8)}... COMPLETED`);
    }
}

/**
 * Record a permanently-failed job as a completed attack so the run's progress
 * can still reach 100%. Called from the worker's `failed` handler on the final
 * attempt. Guards against counting past a run that's already terminal.
 */
async function recordFailedAttempt(testRunId: string): Promise<void> {
    const run = await prisma.testRun.findUnique({
        where: { id: testRunId },
        select: { status: true, completedAttacks: true, totalAttacks: true },
    });
    // If the run is already terminal, or would exceed its total, don't inflate.
    if (!run) return;
    if (run.status === "FAILED" || run.status === "COMPLETED") return;
    if (run.completedAttacks >= run.totalAttacks && run.totalAttacks > 0) return;

    await prisma.testRun.update({
        where: { id: testRunId },
        data: { completedAttacks: { increment: 1 } },
    });
    await finalizeIfComplete(testRunId);
}

// ---------------------------------------------------------------------------
// Job Processor
// ---------------------------------------------------------------------------

async function processAttackJob(job: Job<AttackJobData>): Promise<void> {
    // Short-circuit any job whose run was aborted/deleted while it waited in the
    // queue: don't attack the target, don't write logs, don't resurrect state.
    const runState = await prisma.testRun.findUnique({
        where: { id: job.data?.testRunId },
        select: { status: true },
    });
    if (!runState || runState.status === "FAILED" || runState.status === "COMPLETED") {
        return; // run is gone or terminal — silently drop this job
    }

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
                severity: getSeverity(attackType, 0, ""),
            },
        };
        wsManager.broadcast(testRunId, wsMsg);

        // Check completion — only once ALL jobs are enqueued (enqueuedAt set),
        // so an early-finishing job can't complete a run mid-enqueue.
        await finalizeIfComplete(testRunId);
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
        severity: getSeverity(attackType, statusCode ?? 0, responseSnippet ?? ""),
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

    // Check if all attacks are complete. Shared helper re-reads fresh counts,
    // guards on enqueuedAt + terminal status, and broadcasts COMPLETED exactly
    // once via an atomic status-filtered update.
    await finalizeIfComplete(testRunId);
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

// =============================================================================
// WebSocket Manager — Connection lifecycle & broadcasting
// =============================================================================

import { WebSocket, WebSocketServer } from "ws";
import type { IncomingMessage } from "node:http";
import type { WsServerMessage, WsClientMessage } from "../types/shared.js";
import { wsClientMessageSchema } from "../validators/schemas.js";
import { prisma } from "../lib/prisma.js";

class WsManager {
    private wss: WebSocketServer | null = null;

    /** testRunId → Set of connected WebSocket clients */
    private subscriptions = new Map<string, Set<WebSocket>>();

    /** ws → Set of testRunIds this client is subscribed to */
    private clientSubscriptions = new Map<WebSocket, Set<string>>();

    /** Ping interval handle */
    private pingInterval: ReturnType<typeof setInterval> | null = null;

    // -------------------------------------------------------------------------
    // Lifecycle
    // -------------------------------------------------------------------------

    init(wss: WebSocketServer): void {
        this.wss = wss;

        wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
            console.log(
                `[WS] Client connected from ${req.socket.remoteAddress}`,
            );

            this.clientSubscriptions.set(ws, new Set());

            ws.on("message", (raw) => {
                this.handleMessage(ws, raw);
            });

            ws.on("close", () => {
                this.handleDisconnect(ws);
            });

            ws.on("error", (err) => {
                console.error("[WS] Client error:", err.message);
                this.handleDisconnect(ws);
            });

            // Respond to pongs
            (ws as any).isAlive = true;
            ws.on("pong", () => {
                (ws as any).isAlive = true;
            });
        });

        // Keepalive ping every 30s
        this.pingInterval = setInterval(() => {
            wss.clients.forEach((ws) => {
                if ((ws as any).isAlive === false) {
                    console.log("[WS] Terminating dead connection");
                    ws.terminate();
                    return;
                }
                (ws as any).isAlive = false;
                ws.ping();
            });
        }, 30_000);
    }

    // -------------------------------------------------------------------------
    // Message Handling
    // -------------------------------------------------------------------------

    private handleMessage(ws: WebSocket, raw: unknown): void {
        try {
            const text =
                raw instanceof Buffer
                    ? raw.toString("utf-8")
                    : typeof raw === "string"
                      ? raw
                      : String(raw);

            const parsed = JSON.parse(text);
            const result = wsClientMessageSchema.safeParse(parsed);

            if (!result.success) {
                this.sendToClient(ws, {
                    type: "ERROR",
                    data: {
                        testRunId: "",
                        message: "Invalid message format",
                        code: "INVALID_MESSAGE",
                    },
                });
                return;
            }

            const msg: WsClientMessage = result.data;

            if (msg.type === "SUBSCRIBE") {
                this.subscribe(msg.testRunId, ws);
                console.log(
                    `[WS] Client subscribed to test run ${msg.testRunId}`,
                );
            } else if (msg.type === "UNSUBSCRIBE") {
                this.unsubscribe(msg.testRunId, ws);
                console.log(
                    `[WS] Client unsubscribed from test run ${msg.testRunId}`,
                );
            }
        } catch (err) {
            console.error("[WS] Failed to parse message:", err);
            this.sendToClient(ws, {
                type: "ERROR",
                data: {
                    testRunId: "",
                    message: "Failed to parse message",
                    code: "PARSE_ERROR",
                },
            });
        }
    }

    // -------------------------------------------------------------------------
    // Subscription Management
    // -------------------------------------------------------------------------

    async subscribe(testRunId: string, ws: WebSocket): Promise<void> {
        // Enforce Multi-Tenant Isolation
        const user = (ws as any).user;
        if (!user || (!user.id && !user.email)) {
            this.sendToClient(ws, {
                type: "ERROR",
                data: {
                    testRunId,
                    message: "Unauthorized",
                    code: "UNAUTHORIZED",
                },
            });
            ws.close();
            return;
        }

        try {
            const testRun = await prisma.testRun.findUnique({
                where: { id: testRunId },
            });
            if (!testRun || (testRun.userId && testRun.userId !== user.id)) {
                this.sendToClient(ws, {
                    type: "ERROR",
                    data: {
                        testRunId,
                        message: "Forbidden: Not your test run",
                        code: "FORBIDDEN",
                    },
                });
                return;
            }

            // Successfully authenticated and retrieved test run.
            // Immediately send the current status to this specific client
            // so the frontend UI can sync up without waiting for the next explicit broadcast.
            this.sendToClient(ws, {
                type: "TEST_RUN_STATUS",
                data: {
                    testRunId,
                    status: testRun.status as "PARSING" | "GENERATING" | "ATTACKING" | "COMPLETED" | "FAILED",
                    completedAttacks: testRun.completedAttacks,
                    totalAttacks: testRun.totalAttacks,
                },
            });
        } catch (err) {
            console.error("[WS] Error verifying test run ownership:", err);
            return;
        }

        if (!this.subscriptions.has(testRunId)) {
            this.subscriptions.set(testRunId, new Set());
        }
        this.subscriptions.get(testRunId)!.add(ws);

        const clientSubs = this.clientSubscriptions.get(ws);
        if (clientSubs) {
            clientSubs.add(testRunId);
        }
    }

    unsubscribe(testRunId: string, ws: WebSocket): void {
        const subs = this.subscriptions.get(testRunId);
        if (subs) {
            subs.delete(ws);
            if (subs.size === 0) {
                this.subscriptions.delete(testRunId);
            }
        }

        const clientSubs = this.clientSubscriptions.get(ws);
        if (clientSubs) {
            clientSubs.delete(testRunId);
        }
    }

    private handleDisconnect(ws: WebSocket): void {
        const clientSubs = this.clientSubscriptions.get(ws);
        if (clientSubs) {
            for (const testRunId of clientSubs) {
                this.unsubscribe(testRunId, ws);
            }
        }
        this.clientSubscriptions.delete(ws);
        console.log("[WS] Client disconnected");
    }

    // -------------------------------------------------------------------------
    // Broadcasting
    // -------------------------------------------------------------------------

    /** Send a message to all clients subscribed to a specific test run. */
    broadcast(testRunId: string, message: WsServerMessage): void {
        const subs = this.subscriptions.get(testRunId);
        if (!subs || subs.size === 0) return;

        const payload = JSON.stringify(message);

        for (const ws of subs) {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(payload);
            }
        }
    }

    /** Send a message to a single client. */
    private sendToClient(ws: WebSocket, message: WsServerMessage): void {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(message));
        }
    }

    // -------------------------------------------------------------------------
    // Cleanup
    // -------------------------------------------------------------------------

    shutdown(): void {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
        }
        this.wss?.close();
        this.subscriptions.clear();
        this.clientSubscriptions.clear();
        console.log("[WS] Server shut down");
    }
}

// Export singleton
export const wsManager = new WsManager();

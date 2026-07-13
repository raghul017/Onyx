// =============================================================================
// Onyx Server — Entry Point
// =============================================================================

import "dotenv/config"; // Load .env before anything else
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { createServer } from "node:http";
import { WebSocketServer } from "ws";
import jwt from "jsonwebtoken";
import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";

import routes from "./routes/index.js";
import { wsManager } from "./websockets/ws-manager.js";
import { startOnyxWorker } from "./queues/worker.js";
import { prisma } from "./lib/prisma.js";
import { logger } from "./lib/logger.js";
import {
    initSentry,
    captureException,
    installGlobalErrorHandlers,
} from "./lib/sentry.js";
// Redis connections are managed internally by BullMQ via connection options

// Initialize error tracking (no-op without SENTRY_DSN) + process-level guards
// as early as possible, before the app wires up its routes and the worker.
initSentry("http");
installGlobalErrorHandlers();

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const PORT = parseInt(process.env.PORT ?? "3000", 10);
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:8080";
const CORS_ORIGIN = CLIENT_URL.includes(",")
    ? CLIENT_URL.split(",")
    : CLIENT_URL;

// ---------------------------------------------------------------------------
// Express App
// ---------------------------------------------------------------------------

const app = express();

// Middleware
app.use(
    helmet({
        contentSecurityPolicy: false, // Not needed for API server
    }),
);
app.use(
    cors({
        origin: CORS_ORIGIN,
        credentials: true,
    }),
);
// Route HTTP access logs through the structured logger instead of raw stdout.
app.use(
    morgan("tiny", {
        stream: { write: (msg: string) => logger.info(msg.trim()) },
    }),
);

// Raw body capture for Razorpay webhook — must come before express.json()
app.use("/api/billing/webhook", express.raw({ type: "application/json" }));

app.use(express.json({ limit: "10mb" }));

// Routes
app.use("/api", routes);

// Global error handler
app.use(
    (
        err: Error,
        _req: express.Request,
        res: express.Response,
        _next: express.NextFunction,
    ) => {
        logger.error(
            { err, method: _req.method, path: _req.path },
            "Unhandled request error",
        );
        captureException(err, { method: _req.method, path: _req.path });
        res.status(500).json({
            error: "Internal server error",
            message:
                process.env.NODE_ENV === "development"
                    ? err.message
                    : "Something went wrong",
        });
    },
);

// ---------------------------------------------------------------------------
// HTTP + WebSocket Server
// ---------------------------------------------------------------------------

const server = createServer(app);

// Create WebSocket server (no-server mode — we handle the upgrade manually)
const wss = new WebSocketServer({ noServer: true });

// Initialize WebSocket manager
wsManager.init(wss);

// Handle HTTP upgrade requests for WebSocket
server.on(
    "upgrade",
    (request: IncomingMessage, socket: Duplex, head: Buffer) => {
        const urlObj = new URL(
            request.url ?? "/",
            `http://${request.headers.host}`,
        );

        if (urlObj.pathname === "/ws") {
            const token = urlObj.searchParams.get("token");
            if (!token) {
                socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
                socket.destroy();
                return;
            }

            try {
                // JWT_SECRET is guaranteed to exist — server crashes on
                // startup via middleware/auth.ts if it's missing.
                const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
                    id: string;
                    email: string;
                };

                wss.handleUpgrade(request, socket, head, (ws) => {
                    // Attach user to websocket instance
                    (ws as any).user = decoded;
                    wss.emit("connection", ws, request);
                });
            } catch (err) {
                socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
                socket.destroy();
                return;
            }
        } else {
            socket.destroy();
        }
    },
);

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

async function start(): Promise<void> {
    try {
        // Verify database connection
        await prisma.$connect();
        logger.info("PostgreSQL connected");

        // Start BullMQ worker
        const worker = startOnyxWorker();

        // Start HTTP server
        server.listen(PORT, () => {
            logger.info(
                {
                    port: PORT,
                    http: `http://localhost:${PORT}`,
                    ws: `ws://localhost:${PORT}/ws`,
                    cors: CORS_ORIGIN,
                },
                "⚡ Onyx Server v1.0 started",
            );
        });

        // Graceful shutdown
        const shutdown = async (signal: string) => {
            logger.info({ signal }, "Shutdown signal received");

            // Stop accepting new connections
            server.close();

            // Close WebSocket connections
            wsManager.shutdown();

            // Close BullMQ worker
            await worker.close();

            // Close Prisma
            await prisma.$disconnect();

            logger.info("Shutdown complete");
            process.exit(0);
        };

        process.on("SIGTERM", () => shutdown("SIGTERM"));
        process.on("SIGINT", () => shutdown("SIGINT"));
    } catch (err) {
        logger.fatal({ err }, "Server failed to start");
        captureException(err, { phase: "startup" });
        process.exit(1);
    }
}

start();

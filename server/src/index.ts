// =============================================================================
// Onyx Server — Entry Point
// =============================================================================

import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { createServer } from "node:http";
import { WebSocketServer } from "ws";
import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";

import routes from "./routes/index.js";
import { wsManager } from "./websockets/ws-manager.js";
import { startOnyxWorker } from "./queues/worker.js";
import { prisma } from "./lib/prisma.js";
// Redis connections are managed internally by BullMQ via connection options

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const PORT = parseInt(process.env.PORT ?? "3001", 10);
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? "http://localhost:8080";

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
app.use(morgan("dev"));
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
        console.error("[Server] Unhandled error:", err);
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
        const { pathname } = new URL(
            request.url ?? "/",
            `http://${request.headers.host}`,
        );

        if (pathname === "/ws") {
            wss.handleUpgrade(request, socket, head, (ws) => {
                wss.emit("connection", ws, request);
            });
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
        console.log("[DB] PostgreSQL connected");

        // Start BullMQ worker
        const worker = startOnyxWorker();

        // Start HTTP server
        server.listen(PORT, () => {
            console.log("");
            console.log("╔══════════════════════════════════════════════╗");
            console.log("║           ⚡ Onyx Server v1.0 ⚡            ║");
            console.log("╠══════════════════════════════════════════════╣");
            console.log(`║  HTTP  → http://localhost:${PORT}              ║`);
            console.log(`║  WS    → ws://localhost:${PORT}/ws              ║`);
            console.log(`║  CORS  → ${CORS_ORIGIN.padEnd(32)}║`);
            console.log("╚══════════════════════════════════════════════╝");
            console.log("");
        });

        // Graceful shutdown
        const shutdown = async (signal: string) => {
            console.log(`\n[Server] ${signal} received — shutting down...`);

            // Stop accepting new connections
            server.close();

            // Close WebSocket connections
            wsManager.shutdown();

            // Close BullMQ worker
            await worker.close();

            // Close Prisma
            await prisma.$disconnect();

            console.log("[Server] Shutdown complete");
            process.exit(0);
        };

        process.on("SIGTERM", () => shutdown("SIGTERM"));
        process.on("SIGINT", () => shutdown("SIGINT"));
    } catch (err) {
        console.error("[Server] Failed to start:", err);
        process.exit(1);
    }
}

start();

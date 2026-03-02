// =============================================================================
// Onyx Queue — BullMQ Configuration
// =============================================================================

import { Queue } from "bullmq";
import type { ConnectionOptions } from "bullmq";

// ---------------------------------------------------------------------------
// Redis Connection Config
// ---------------------------------------------------------------------------

let REDIS_HOST = process.env.REDIS_HOST ?? "localhost";
let REDIS_PORT = parseInt(process.env.REDIS_PORT ?? "6379", 10);

// Render sometimes provides REDIS_HOST with the port included (e.g. red-xxx:6379)
if (REDIS_HOST.includes(":")) {
    const parts = REDIS_HOST.split(":");
    REDIS_HOST = parts[0];
    REDIS_PORT = parseInt(parts[1], 10);
}

const REDIS_PASSWORD = process.env.REDIS_PASSWORD;
const REDIS_TLS = process.env.REDIS_TLS === "true" ? {} : undefined;

/** Shared Redis connection options for BullMQ (Queue + Worker). */
export const redisConnectionOptions: ConnectionOptions = {
    host: REDIS_HOST,
    port: REDIS_PORT,
    password: REDIS_PASSWORD,
    tls: REDIS_TLS,
    maxRetriesPerRequest: null, // Required by BullMQ
};

// Fallback to REDIS_URL if provided natively by Render or Upstash
if (process.env.REDIS_URL) {
    try {
        const url = new URL(process.env.REDIS_URL);
        redisConnectionOptions.host = url.hostname;
        redisConnectionOptions.port = parseInt(url.port || "6379", 10);
        if (url.password) {
            redisConnectionOptions.password = url.password;
        }
        if (url.protocol === "rediss:") {
            redisConnectionOptions.tls = {};
        }
    } catch (e) {
        console.warn(
            "[Queue] Failed to parse REDIS_URL, falling back to REDIS_HOST",
        );
    }
}

// ---------------------------------------------------------------------------
// Queue
// ---------------------------------------------------------------------------

export const CHAOS_QUEUE_NAME = "chaos-attacks";

export const chaosQueue = new Queue(CHAOS_QUEUE_NAME, {
    connection: redisConnectionOptions,
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: "exponential",
            delay: 1000,
        },
        removeOnComplete: {
            age: 3600, // Keep completed jobs for 1 hour
            count: 1000,
        },
        removeOnFail: {
            age: 86400, // Keep failed jobs for 24 hours
        },
    },
});

console.log(`[Queue] "${CHAOS_QUEUE_NAME}" initialized`);

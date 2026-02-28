// =============================================================================
// Onyx Queue — BullMQ Configuration
// =============================================================================

import { Queue } from "bullmq";
import type { ConnectionOptions } from "bullmq";

// ---------------------------------------------------------------------------
// Redis Connection Config
// ---------------------------------------------------------------------------

const REDIS_HOST = process.env.REDIS_HOST ?? "localhost";
const REDIS_PORT = parseInt(process.env.REDIS_PORT ?? "6379", 10);

/** Shared Redis connection options for BullMQ (Queue + Worker). */
export const redisConnectionOptions: ConnectionOptions = {
    host: REDIS_HOST,
    port: REDIS_PORT,
    maxRetriesPerRequest: null, // Required by BullMQ
};

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

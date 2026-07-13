// =============================================================================
// Prisma Client — Singleton (Prisma 7 + pg adapter)
// =============================================================================

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
    const connectionString = process.env.DATABASE_URL as string;

    const pool = new pg.Pool({
        connectionString,
        min: 2, // Keep warm connections to avoid Neon cold-start latency
        // Must comfortably exceed the BullMQ worker's concurrency (12 in-flight
        // attack jobs, each doing a few sequential queries) PLUS headroom for
        // concurrent HTTP requests — the web server and the worker share this
        // single pool. At max:10 the worker alone could starve the pool and
        // serialize jobs on connection acquisition. 20 = 12 worker + ~8 HTTP.
        max: 20,
        idleTimeoutMillis: 30_000,
        connectionTimeoutMillis: 5_000,
    });
    const adapter = new PrismaPg(pool);

    return new PrismaClient({ adapter } as any);
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = prisma;
}

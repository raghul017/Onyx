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
    const connectionString =
        process.env.DATABASE_URL ??
        "postgresql://neondb_owner:npg_ms89jVbOEHzc@ep-odd-bonus-a11zgwvr-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require";

    const pool = new pg.Pool({ connectionString });
    const adapter = new PrismaPg(pool);

    return new PrismaClient({ adapter } as any);
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = prisma;
}

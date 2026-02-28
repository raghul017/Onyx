import path from "node:path";
import { defineConfig } from "prisma/config";

export default defineConfig({
    schema: path.join(import.meta.dirname, "prisma", "schema.prisma"),

    migrate: {
        async adapter() {
            const { Pool } = await import("pg");
            const { PrismaPg } = await import("@prisma/adapter-pg");
            const connectionString =
                process.env.DATABASE_URL ??
                "postgresql://neondb_owner:***REMOVED***@ep-odd-bonus-a11zgwvr-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require";
            const pool = new Pool({ connectionString });
            return new PrismaPg(pool);
        },
    },
});

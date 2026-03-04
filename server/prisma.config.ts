import path from "node:path";
import { defineConfig } from "prisma/config";

const connectionString = process.env.DATABASE_URL;

export default defineConfig({
    schema: path.join(import.meta.dirname, "prisma", "schema.prisma"),

    migrate: {
        async adapter() {
            const { Pool } = await import("pg");
            const { PrismaPg } = await import("@prisma/adapter-pg");
            const pool = new Pool({ connectionString });
            return new PrismaPg(pool);
        },
    },

    datasource: {
        url: connectionString,
    },
});

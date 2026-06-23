// One-off: set a user's plan. Usage:
//   node scripts/set-plan.mjs <email> <PLAN>
// Example: node scripts/set-plan.mjs arraghul6@gmail.com PRO
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const email = process.argv[2];
const plan = (process.argv[3] || "PRO").toUpperCase();

if (!email) {
    console.error("Usage: node scripts/set-plan.mjs <email> <PLAN>");
    process.exit(1);
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const expires = new Date();
expires.setFullYear(expires.getFullYear() + 1);

const user = await prisma.user.update({
    where: { email },
    data: { plan, planExpiresAt: expires },
    select: { email: true, plan: true, planExpiresAt: true },
});

console.log("✅ Updated:", user);
await prisma.$disconnect();
await pool.end();

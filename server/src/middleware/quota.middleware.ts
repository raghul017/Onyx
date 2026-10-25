import { Request, Response, NextFunction } from "express";
import { prisma } from "../lib/prisma.js";
import { getEffectivePlan } from "../services/org.service.js";
import { PLAN_LIMITS } from "../lib/plan-limits.js";

export function checkQuota(resource: "testRun") {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ error: "Authentication required" });
            return;
        }

        const orgId = req.orgId;
        const plan = await getEffectivePlan(userId, orgId);
        const limits = PLAN_LIMITS[plan];

        if (resource === "testRun") {
            const now = new Date();
            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

            const used = await prisma.testRun.count({
                where: orgId
                    ? { orgId, createdAt: { gte: monthStart } }
                    : { userId, createdAt: { gte: monthStart } },
            });

            if (used >= limits.testRunsPerMonth) {
                res.status(429).json({
                    error: "QUOTA_EXCEEDED",
                    limit: limits.testRunsPerMonth,
                    used,
                    plan,
                    upgradeUrl: "/billing",
                });
                return;
            }
        }

        next();
    };
}

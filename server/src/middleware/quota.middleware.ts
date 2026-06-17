import { Request, Response, NextFunction } from "express";
import { prisma } from "../lib/prisma.js";
import { Plan } from "@prisma/client";
import { getEffectivePlan } from "../services/org.service.js";

const PLAN_LIMITS: Record<Plan, { testRunsPerMonth: number; endpointsPerRun: number }> = {
    FREE:       { testRunsPerMonth: 5,      endpointsPerRun: 10 },
    PRO:        { testRunsPerMonth: 100,    endpointsPerRun: 50 },
    TEAM:       { testRunsPerMonth: 500,    endpointsPerRun: 999999 },
    ENTERPRISE: { testRunsPerMonth: 999999, endpointsPerRun: 999999 },
};

export function checkQuota(resource: "testRun" | "endpoints") {
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

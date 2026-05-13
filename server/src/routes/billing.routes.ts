import { Router, Request, Response } from "express";
import crypto from "node:crypto";
import { authenticateToken } from "../middleware/auth.js";
import * as billingService from "../services/billing.service.js";
import { prisma } from "../lib/prisma.js";
import { Plan } from "@prisma/client";

const router = Router();

// ---------------------------------------------------------------------------
// POST /api/billing/subscribe
// ---------------------------------------------------------------------------
router.post("/subscribe", authenticateToken, async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.id;
    const { planId } = req.body as { planId?: string };

    if (!planId) {
        res.status(400).json({ error: "planId is required" });
        return;
    }

    const subscription = await billingService.createSubscription(planId, userId) as any;

    res.status(201).json({
        subscriptionId: subscription.id,
        shortUrl: subscription.short_url,
    });
});

// ---------------------------------------------------------------------------
// POST /api/billing/verify
// Called by the frontend immediately after Razorpay checkout succeeds.
// Fetches the subscription directly from Razorpay API and activates the plan
// without waiting for a webhook. Webhooks still handle renewals/cancellations.
// ---------------------------------------------------------------------------
router.post("/verify", authenticateToken, async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.id;
    const { subscriptionId } = req.body as { subscriptionId?: string };

    if (!subscriptionId) {
        res.status(400).json({ error: "subscriptionId is required" });
        return;
    }

    let sub: any;
    try {
        sub = await billingService.fetchSubscription(subscriptionId);
    } catch (err: any) {
        console.error("[Billing] verify: failed to fetch subscription", err?.message);
        res.status(502).json({ error: "Could not verify subscription with Razorpay" });
        return;
    }

    // Accept any state that means payment went through
    const activeStates = ["created", "authenticated", "active"];
    if (!activeStates.includes(sub.status)) {
        res.status(402).json({ error: `Subscription not active (status: ${sub.status})` });
        return;
    }

    const plan = resolvePlan(sub.plan_id);

    await prisma.user.update({
        where: { id: userId },
        data: { plan, razorpaySubId: subscriptionId },
    });

    console.log(`[Billing] verify: user ${userId} activated plan ${plan} via subscription ${subscriptionId}`);
    res.json({ plan });
});

// ---------------------------------------------------------------------------
// POST /api/billing/cancel
// ---------------------------------------------------------------------------
router.post("/cancel", authenticateToken, async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.id;

    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { razorpaySubId: true },
    });

    if (!user?.razorpaySubId) {
        res.status(400).json({ error: "No active subscription found" });
        return;
    }

    await billingService.cancelSubscription(user.razorpaySubId);

    await prisma.user.update({
        where: { id: userId },
        data: { plan: Plan.FREE, razorpaySubId: null, planExpiresAt: null },
    });

    res.json({ success: true });
});

// ---------------------------------------------------------------------------
// POST /api/billing/webhook  (no auth — Razorpay calls this directly)
// ---------------------------------------------------------------------------
router.post("/webhook", async (req: Request, res: Response): Promise<void> => {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!webhookSecret) {
        console.error("[Billing] RAZORPAY_WEBHOOK_SECRET not set");
        res.status(500).end();
        return;
    }

    const expectedSignature = crypto
        .createHmac("sha256", webhookSecret)
        .update(req.body as Buffer)
        .digest("hex");

    const receivedSignature = req.headers["x-razorpay-signature"] as string | undefined;

    if (!receivedSignature || receivedSignature !== expectedSignature) {
        res.status(400).json({ error: "Invalid signature" });
        return;
    }

    const payload = JSON.parse((req.body as Buffer).toString());
    const event = payload?.event as string | undefined;
    const subEntity = payload?.payload?.subscription?.entity;

    switch (event) {
        case "subscription.activated": {
            const userId: string | undefined = subEntity?.notes?.userId;
            const subId: string | undefined = subEntity?.id;
            const planId: string | undefined = subEntity?.plan_id;

            if (!userId || !subId) {
                console.error("[Billing] subscription.activated missing userId or subId", req.body);
                break;
            }

            const plan = resolvePlan(planId);

            await prisma.user.update({
                where: { id: userId },
                data: { plan, razorpaySubId: subId },
            });
            break;
        }

        case "subscription.charged": {
            const subId: string | undefined = subEntity?.id;
            if (!subId) break;

            const nextMonth = new Date();
            nextMonth.setMonth(nextMonth.getMonth() + 1);

            await prisma.user.updateMany({
                where: { razorpaySubId: subId },
                data: { planExpiresAt: nextMonth },
            });
            break;
        }

        case "subscription.cancelled": {
            const subId: string | undefined = subEntity?.id;
            if (!subId) break;

            await prisma.user.updateMany({
                where: { razorpaySubId: subId },
                data: { plan: Plan.FREE, razorpaySubId: null, planExpiresAt: null },
            });
            break;
        }

        case "payment.failed": {
            const paymentEntity = payload?.payload?.payment?.entity;
            console.error("[Billing] payment.failed:", {
                paymentId: paymentEntity?.id,
                amount: paymentEntity?.amount,
                email: paymentEntity?.email,
                errorDescription: paymentEntity?.error_description,
            });
            break;
        }

        default:
            break;
    }

    res.status(200).json({ received: true });
});

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------
function resolvePlan(planId: string | undefined): Plan {
    if (planId === process.env.RAZORPAY_TEAM_PLAN_ID) return Plan.TEAM;
    if (planId === process.env.RAZORPAY_PRO_PLAN_ID) return Plan.PRO;
    return Plan.PRO; // safe default for any paid plan activation
}

export default router;

import { Router, Request, Response } from "express";
import crypto from "node:crypto";
import { authenticateToken } from "../middleware/auth.js";
import * as billingService from "../services/billing.service.js";
import { prisma } from "../lib/prisma.js";
import { Plan } from "@prisma/client";
import { subscribeSchema, verifySubscriptionSchema } from "../validators/schemas.js";
import { logger } from "../lib/logger.js";

const log = logger.child({ component: "billing" });

const router = Router();

// ---------------------------------------------------------------------------
// POST /api/billing/subscribe
// ---------------------------------------------------------------------------
router.post("/subscribe", authenticateToken, async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.id;
    const parsed = subscribeSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: "Validation failed", details: parsed.error.issues });
        return;
    }
    const { planId } = parsed.data;

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
    const parsed = verifySubscriptionSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: "Validation failed", details: parsed.error.issues });
        return;
    }
    const { subscriptionId } = parsed.data;

    let sub: any;
    try {
        sub = await billingService.fetchSubscription(subscriptionId);
    } catch (err: any) {
        log.error({ err, subscriptionId }, "verify: failed to fetch subscription");
        res.status(502).json({ error: "Could not verify subscription with Razorpay" });
        return;
    }

    // Only a genuinely ACTIVE subscription grants a paid plan. "created" and
    // "authenticated" mean the subscription exists but the first charge has NOT
    // been captured yet — accepting those would hand out paid plans for free.
    if (sub.status !== "active") {
        res.status(402).json({ error: `Subscription not active (status: ${sub.status})` });
        return;
    }

    // The subscription must belong to THIS user. Without this check, any user
    // could pass another user's subscriptionId and inherit their plan.
    if (sub.notes?.userId && sub.notes.userId !== userId) {
        log.warn(
            { subscriptionId, ownerUserId: sub.notes.userId, requestUserId: userId },
            "verify: subscription belongs to a different user",
        );
        res.status(403).json({ error: "This subscription does not belong to you" });
        return;
    }

    // Never grant a paid plan for an unrecognized plan id.
    const plan = resolvePlan(sub.plan_id);
    if (plan === Plan.FREE) {
        res.status(422).json({ error: "Unrecognized plan for this subscription" });
        return;
    }

    await prisma.user.update({
        where: { id: userId },
        data: { plan, razorpaySubId: subscriptionId },
    });

    log.info({ userId, plan, subscriptionId }, "verify: plan activated");
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
        log.error("RAZORPAY_WEBHOOK_SECRET not set");
        res.status(500).end();
        return;
    }

    const expectedSignature = crypto
        .createHmac("sha256", webhookSecret)
        .update(req.body as Buffer)
        .digest("hex");

    const receivedSignature = req.headers["x-razorpay-signature"] as string | undefined;

    // Constant-time comparison to avoid a signature-forging timing side channel.
    if (!receivedSignature || !timingSafeEqualHex(receivedSignature, expectedSignature)) {
        res.status(400).json({ error: "Invalid signature" });
        return;
    }

    const payload = JSON.parse((req.body as Buffer).toString());
    const event = payload?.event as string | undefined;
    const subEntity = payload?.payload?.subscription?.entity;

    // Idempotency / replay protection. Razorpay sends a unique event id header;
    // record it and skip if we've already processed this exact delivery, so a
    // replayed webhook can't re-apply plan changes or re-extend expiry.
    const eventId =
        (req.headers["x-razorpay-event-id"] as string | undefined) ?? undefined;
    if (eventId) {
        try {
            await prisma.webhookEvent.create({ data: { eventId, event: event ?? "unknown" } });
        } catch {
            // Unique-constraint violation → already processed this delivery.
            log.info({ eventId }, "duplicate webhook ignored");
            res.status(200).json({ received: true, duplicate: true });
            return;
        }
    }

    switch (event) {
        case "subscription.activated": {
            const userId: string | undefined = subEntity?.notes?.userId;
            const subId: string | undefined = subEntity?.id;

            if (!userId || !subId) {
                // Log identifiers only — never the raw webhook body.
                log.error({ hasUserId: !!userId, hasSubId: !!subId }, "subscription.activated missing userId or subId");
                break;
            }

            // Do NOT trust the plan_id / state in the webhook payload. Fetch the
            // real subscription from Razorpay and confirm it's active before
            // granting anything. This defeats forged/replayed activation events.
            let verified: any;
            try {
                verified = await billingService.fetchSubscription(subId);
            } catch (err: any) {
                log.error({ subId, err }, "webhook: could not fetch subscription");
                break;
            }
            if (verified.status !== "active") {
                log.warn({ subId, status: verified.status }, "webhook: subscription not active");
                break;
            }
            if (verified.notes?.userId && verified.notes.userId !== userId) {
                log.warn({ subId }, "webhook: subscription userId mismatch");
                break;
            }

            const plan = resolvePlan(verified.plan_id);
            if (plan === Plan.FREE) {
                log.error({ subId }, "webhook: unrecognized plan");
                break;
            }

            await prisma.user.update({
                where: { id: userId },
                data: { plan, razorpaySubId: subId },
            });
            break;
        }

        case "subscription.charged": {
            const subId: string | undefined = subEntity?.id;
            if (!subId) break;

            // Prefer Razorpay's authoritative period end (`current_end`, a unix
            // timestamp in seconds) over client-side month math, which is buggy
            // across month-length boundaries (Jan 31 → Mar 3). Fall back to +30d.
            const currentEnd: number | undefined = subEntity?.current_end;
            const expiresAt =
                typeof currentEnd === "number"
                    ? new Date(currentEnd * 1000)
                    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

            await prisma.user.updateMany({
                where: { razorpaySubId: subId },
                data: { planExpiresAt: expiresAt },
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
            log.warn(
                {
                    paymentId: paymentEntity?.id,
                    amount: paymentEntity?.amount,
                    errorDescription: paymentEntity?.error_description,
                },
                "payment.failed",
            );
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
/** Constant-time comparison of two hex signature strings. */
function timingSafeEqualHex(a: string, b: string): boolean {
    // Length must match for timingSafeEqual; a length diff is itself a mismatch.
    if (a.length !== b.length) return false;
    try {
        return crypto.timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
    } catch {
        return false;
    }
}

function resolvePlan(planId: string | undefined): Plan {
    if (planId && planId === process.env.RAZORPAY_TEAM_PLAN_ID) return Plan.TEAM;
    if (planId && planId === process.env.RAZORPAY_PRO_PLAN_ID) return Plan.PRO;
    // NEVER default to a paid plan. An unknown/empty plan id (misconfigured env,
    // forged webhook, bogus subscription) must not grant paid features.
    return Plan.FREE;
}

export default router;

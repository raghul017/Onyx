// =============================================================================
// Billing — subscription management & plan upgrade. Light-mono system:
// #fafafa surface, #ffffff cards, hairline #e6e6e6 borders, sharp corners,
// no shadows, Geist headings, JetBrains Mono labels, single blue (#3b82f6)
// accent, semantic red (#dc2626) for cancel. Matches landing / Settings / Profile.
// =============================================================================

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Loader2, CreditCard, ShieldCheck, AlertTriangle } from "lucide-react";
import {
    getCurrentUser,
    subscribeToPlan,
    cancelSubscription,
    verifySubscription,
    type Plan,
    type CurrentUser,
} from "@/services/api";
import AppHeader from "@/components/AppHeader";
import GoBackButton from "@/components/GoBackButton";

// ---------------------------------------------------------------------------
// Brand token — single blue accent (Razorpay checkout theme)
// ---------------------------------------------------------------------------

const ACCENT = "#3b82f6";

// ---------------------------------------------------------------------------
// Plan definitions
// ---------------------------------------------------------------------------

interface PlanDef {
    key: Plan;
    name: string;
    price: string;
    period: string;
    inrNote?: string;
    tagline: string;
    features: string[];
    envKey: "VITE_RAZORPAY_PRO_PLAN_ID" | "VITE_RAZORPAY_TEAM_PLAN_ID" | null;
    highlight: boolean;
}

const PLANS: PlanDef[] = [
    {
        key: "FREE",
        name: "Free",
        price: "$0",
        period: "/mo",
        tagline: "Kick the tires.",
        features: [
            "5 test runs / month",
            "10 endpoints per run",
            "5 attack types",
            "Community support",
        ],
        envKey: null,
        highlight: false,
    },
    {
        key: "PRO",
        name: "Pro",
        price: "$9",
        period: "/mo",
        inrNote: "Billed in INR (₹900/mo)",
        tagline: "For solo builders shipping fast.",
        features: [
            "100 test runs / month",
            "50 endpoints per run",
            "All attack types",
            "PDF reports",
            "Priority support",
        ],
        envKey: "VITE_RAZORPAY_PRO_PLAN_ID",
        highlight: true,
    },
    {
        key: "TEAM",
        name: "Team",
        price: "$18",
        period: "/mo",
        inrNote: "Billed in INR (₹1800/mo)",
        tagline: "For teams that ship together.",
        features: [
            "500 test runs / month",
            "Unlimited endpoints per run",
            "Everything in Pro",
            "Multi-user workspaces",
            "API access",
            "SLA support",
        ],
        envKey: "VITE_RAZORPAY_TEAM_PLAN_ID",
        highlight: false,
    },
];

// ---------------------------------------------------------------------------
// Razorpay loader
// ---------------------------------------------------------------------------

const loadRazorpayScript = () => {
    return new Promise((resolve) => {
        if (document.getElementById("razorpay-script")) {
            resolve(true);
            return;
        }
        const script = document.createElement("script");
        script.id = "razorpay-script";
        script.src = "https://checkout.razorpay.com/v1/checkout.js";
        script.onload = () => resolve(true);
        script.onerror = () => resolve(false);
        document.body.appendChild(script);
    });
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const Billing = () => {
    const [user, setUser] = useState<CurrentUser | null>(null);
    const [loadingUser, setLoadingUser] = useState(true);
    const [subscribingTo, setSubscribingTo] = useState<Plan | null>(null);
    const [cancelling, setCancelling] = useState(false);
    const [confirmingCancel, setConfirmingCancel] = useState(false);
    // Inline notice (replaces jarring native alert() popups).
    const [notice, setNotice] = useState<{ kind: "error" | "success"; text: string } | null>(null);

    const flash = (kind: "error" | "success", text: string) => setNotice({ kind, text });

    const fetchUser = useCallback(async () => {
        try {
            setLoadingUser(true);
            const u = await getCurrentUser();
            setUser(u);
            return u;
        } catch {
            // auth interceptor will redirect to /signin on 401
            return null;
        } finally {
            setLoadingUser(false);
        }
    }, []);

    useEffect(() => {
        fetchUser();
    }, [fetchUser]);

    const handleUpgrade = async (plan: PlanDef) => {
        if (!plan.envKey) return;
        setNotice(null);
        const planId = import.meta.env[plan.envKey] as string | undefined;
        const razorpayKeyId = import.meta.env.VITE_RAZORPAY_KEY_ID as string | undefined;

        if (!planId) {
            flash("error", `${plan.envKey} is not configured.`);
            return;
        }
        if (!razorpayKeyId) {
            flash("error", "VITE_RAZORPAY_KEY_ID is not configured in the client environment.");
            return;
        }

        setSubscribingTo(plan.key);
        try {
            const isLoaded = await loadRazorpayScript();
            if (!isLoaded) {
                flash("error", "Razorpay checkout failed to load. Check your connection and try again.");
                setSubscribingTo(null);
                return;
            }

            const { subscriptionId } = await subscribeToPlan(planId);

            const options = {
                key: razorpayKeyId,
                subscription_id: subscriptionId,
                name: "Onyx",
                description: `Upgrade to ${plan.name} Plan`,
                theme: {
                    color: ACCENT,
                },
                prefill: {
                    email: user?.email || "",
                },
                handler: async function () {
                    // Payment captured — verify subscription server-side immediately
                    // so the plan is activated without waiting for a webhook.
                    setLoadingUser(true);
                    try {
                        await verifySubscription(subscriptionId);
                        const updatedUser = await getCurrentUser();
                        setUser(updatedUser);
                        setSubscribingTo(null);
                        setLoadingUser(false);
                        flash("success", `You're on ${plan.name}. Welcome aboard.`);
                    } catch {
                        // Verify failed — fall back to polling (webhook may still arrive)
                        let retries = 0;
                        const poll = setInterval(async () => {
                            try {
                                const updatedUser = await getCurrentUser();
                                if (updatedUser.plan === plan.key || retries >= 15) {
                                    clearInterval(poll);
                                    setUser(updatedUser);
                                    setSubscribingTo(null);
                                    setLoadingUser(false);
                                    if (updatedUser.plan === plan.key) {
                                        flash("success", `You're on ${plan.name}. Welcome aboard.`);
                                    }
                                }
                                retries++;
                            } catch {
                                // ignore errors during polling
                            }
                        }, 2000);
                    }
                },
                modal: {
                    ondismiss: function () {
                        setSubscribingTo(null);
                    },
                },
            };

            const rzp = new (window as any).Razorpay(options);
            rzp.on("payment.failed", function (response: any) {
                flash("error", response?.error?.description || "Payment failed.");
                setSubscribingTo(null);
            });
            rzp.open();
        } catch (err: any) {
            flash("error", err?.response?.data?.error || "Failed to start checkout.");
            setSubscribingTo(null);
        }
    };

    const handleCancel = async () => {
        setCancelling(true);
        setNotice(null);
        try {
            await cancelSubscription();
            await fetchUser();
            setConfirmingCancel(false);
            flash("success", "Subscription cancelled. You're back on the Free plan.");
        } catch (err: any) {
            flash("error", err?.response?.data?.error || "Failed to cancel subscription.");
        } finally {
            setCancelling(false);
        }
    };

    const effectivePlan = user?.plan ?? "FREE";
    const isPaid = effectivePlan === "PRO" || effectivePlan === "TEAM";

    // -------------------------------------------------------------------------
    // Plan CTA
    // -------------------------------------------------------------------------

    const renderButton = (plan: PlanDef) => {
        const isCurrentPlan = effectivePlan === plan.key;
        const isLoading = subscribingTo === plan.key;

        if (isCurrentPlan) {
            return (
                <div className="w-full text-center py-2.5 text-[12px] font-mono uppercase tracking-wide border border-[#93c5fd] text-[#3b82f6]">
                    Current Plan
                </div>
            );
        }

        if (plan.key === "FREE") {
            return (
                <div className="w-full text-center py-2.5 text-[12px] font-mono uppercase tracking-wide border border-[#e6e6e6] text-[#999]">
                    Downgrade via Cancel
                </div>
            );
        }

        return (
            <button
                onClick={() => handleUpgrade(plan)}
                disabled={isLoading || !!subscribingTo}
                className="mono-btn w-full justify-center py-2.5 disabled:opacity-40 disabled:cursor-not-allowed"
            >
                {isLoading ? (
                    <>
                        <Loader2 size={13} className="animate-spin" />
                        Redirecting...
                    </>
                ) : (
                    <>
                        <CreditCard size={13} />
                        Upgrade to {plan.name}
                    </>
                )}
            </button>
        );
    };

    // -------------------------------------------------------------------------
    // Layout
    // -------------------------------------------------------------------------

    return (
        <div className="onyx-mono relative min-h-screen overflow-x-clip">
            <div className="relative z-10 flex flex-col min-h-screen">
                <AppHeader user={user} />

                <main className="w-full px-5 sm:px-8 lg:px-12 flex-1 py-8 sm:py-10">
                    <div className="max-w-[1100px] mx-auto">
                        {/* Header row */}
                        <div className="flex items-start justify-between gap-4 mb-7">
                            <div>
                                <h1 className="text-[clamp(1.75rem,4vw,2.5rem)] leading-tight font-normal tracking-tight text-balance">
                                    Subscription
                                </h1>
                                <p className="text-[#666] text-sm mt-2">
                                    Choose the plan that fits your security testing needs.
                                </p>
                            </div>
                            <GoBackButton to="/dashboard" label="Dashboard" size="sm" className="shrink-0" />
                        </div>

                        {/* Current-plan strip */}
                        <div className="mb-6 flex items-center gap-3 border border-[#e6e6e6] bg-white px-4 py-3">
                            <span className="grid place-items-center h-8 w-8 bg-[#f0f6ff] text-[#3b82f6] shrink-0">
                                <ShieldCheck size={16} />
                            </span>
                            <div className="min-w-0">
                                <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#999]">
                                    Current plan
                                </p>
                                <p className="text-sm font-medium tabular-nums text-black">
                                    {loadingUser ? (
                                        <span className="text-[#999]">Loading…</span>
                                    ) : (
                                        <>
                                            {PLANS.find((p) => p.key === effectivePlan)?.name ?? effectivePlan}
                                            {user?.email && (
                                                <span className="text-[#999] font-normal"> · {user.email}</span>
                                            )}
                                        </>
                                    )}
                                </p>
                            </div>
                        </div>

                        {/* Inline notice (replaces alert popups) */}
                        <AnimatePresence>
                            {notice && (
                                <motion.div
                                    initial={{ opacity: 0, y: -6 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -6 }}
                                    transition={{ duration: 0.2 }}
                                    className={`mb-6 flex items-start gap-2.5 border px-4 py-3 text-[13px] ${
                                        notice.kind === "error"
                                            ? "text-[#dc2626] border-[#fca5a5] bg-[#fef2f2]"
                                            : "text-[#16a34a] border-[#86efac] bg-[#f0fdf4]"
                                    }`}
                                >
                                    {notice.kind === "error" ? (
                                        <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                                    ) : (
                                        <Check size={15} className="shrink-0 mt-0.5" />
                                    )}
                                    <span>{notice.text}</span>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Pricing cards */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch">
                            {PLANS.map((plan, i) => {
                                const isActive = effectivePlan === plan.key;
                                const isHighlight = plan.highlight && !isActive;
                                return (
                                    <motion.div
                                        key={plan.key}
                                        initial={{ opacity: 0, y: 12 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.35, delay: i * 0.06, ease: [0.2, 0, 0, 1] }}
                                        className={`relative flex flex-col p-6 border ${
                                            isActive
                                                ? "border-[#3b82f6] bg-white"
                                                : isHighlight
                                                ? "border-[#93c5fd] bg-[#f0f6ff]"
                                                : "border-[#e6e6e6] bg-white"
                                        }`}
                                    >
                                        {/* Popular / Active badge */}
                                        {isHighlight && (
                                            <div className="absolute -top-px left-1/2 -translate-x-1/2 z-20">
                                                <span className="bg-black text-white text-[10px] font-bold font-mono tracking-widest uppercase px-3 py-0.5">
                                                    Most Popular
                                                </span>
                                            </div>
                                        )}
                                        {isActive && (
                                            <div className="absolute -top-px left-1/2 -translate-x-1/2 z-20">
                                                <span className="bg-[#3b82f6] text-white text-[10px] font-bold font-mono tracking-widest uppercase px-3 py-0.5">
                                                    Active
                                                </span>
                                            </div>
                                        )}

                                        <div className="flex flex-col flex-1">
                                            <div className="mb-4">
                                                <p className="text-[#999] text-[11px] font-mono uppercase tracking-widest mb-2">
                                                    {plan.name}
                                                </p>
                                                <div className="flex items-baseline gap-1">
                                                    <span className="text-3xl font-semibold tabular-nums text-black">{plan.price}</span>
                                                    <span className="text-[#666] text-sm">{plan.period}</span>
                                                </div>
                                                {plan.inrNote && (
                                                    <span className="text-xs text-[#999] mt-0.5 block">{plan.inrNote}</span>
                                                )}
                                                <p className="text-[12px] text-[#666] mt-2">{plan.tagline}</p>
                                            </div>

                                            <ul className="flex-1 space-y-2.5 mb-6">
                                                {plan.features.map((f) => (
                                                    <li key={f} className="flex items-start gap-2 text-[13px] text-[#333]">
                                                        <Check
                                                            size={13}
                                                            className="shrink-0 mt-0.5 text-[#3b82f6]"
                                                        />
                                                        {f}
                                                    </li>
                                                ))}
                                            </ul>

                                            {renderButton(plan)}
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </div>

                        {/* Cancel subscription */}
                        {isPaid && (
                            <div className="mt-10 pt-8 border-t border-[#e6e6e6]">
                                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                    <div>
                                        <p className="text-sm font-medium text-black">Cancel subscription</p>
                                        <p className="text-[#666] text-[12px] mt-0.5">
                                            You'll be immediately downgraded to the Free plan.
                                        </p>
                                    </div>
                                    {!confirmingCancel ? (
                                        <button
                                            onClick={() => setConfirmingCancel(true)}
                                            className="mono-btn-ghost !text-[#dc2626] !border-[#fca5a5] hover:!bg-[#fef2f2] hover:!border-[#dc2626] whitespace-nowrap"
                                        >
                                            Cancel subscription
                                        </button>
                                    ) : (
                                        <div className="flex items-center gap-2">
                                            <span className="text-[12px] text-[#666] mr-1">Are you sure?</span>
                                            <button
                                                onClick={handleCancel}
                                                disabled={cancelling}
                                                className="inline-flex items-center gap-2 px-4 py-2.5 text-[12px] font-mono uppercase tracking-wide bg-[#dc2626] text-white hover:bg-[#b91c1c] transition-colors active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                                                style={{ transitionProperty: "background-color, transform" }}
                                            >
                                                {cancelling ? (
                                                    <>
                                                        <Loader2 size={12} className="animate-spin" />
                                                        Cancelling...
                                                    </>
                                                ) : (
                                                    "Yes, cancel"
                                                )}
                                            </button>
                                            <button
                                                onClick={() => setConfirmingCancel(false)}
                                                disabled={cancelling}
                                                className="px-4 py-2.5 text-[12px] font-mono uppercase tracking-wide border border-[#e6e6e6] text-[#666] hover:text-black hover:border-black transition-colors active:scale-[0.98] disabled:opacity-40"
                                                style={{ transitionProperty: "color, border-color, transform" }}
                                            >
                                                Keep it
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </main>
            </div>
        </div>
    );
};

export default Billing;

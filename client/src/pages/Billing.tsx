// =============================================================================
// Billing — Subscription management & plan upgrade
// =============================================================================

import { useState, useEffect, useCallback } from "react";
import { Check, Loader2, CreditCard } from "lucide-react";
import {
    getCurrentUser,
    subscribeToPlan,
    cancelSubscription,
    verifySubscription,
    type Plan,
    type CurrentUser,
} from "@/services/api";
import AppHeader from "@/components/AppHeader";

// ---------------------------------------------------------------------------
// Plan definitions
// ---------------------------------------------------------------------------

interface PlanDef {
    key: Plan;
    name: string;
    price: string;
    period: string;
    inrNote?: string;
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
// Component
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

const Billing = () => {
    const [user, setUser] = useState<CurrentUser | null>(null);
    const [loadingUser, setLoadingUser] = useState(true);
    const [subscribingTo, setSubscribingTo] = useState<Plan | null>(null);
    const [cancelling, setCancelling] = useState(false);

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
        const planId = import.meta.env[plan.envKey] as string | undefined;
        const razorpayKeyId = import.meta.env.VITE_RAZORPAY_KEY_ID as string | undefined;
        
        if (!planId) {
            alert(`${plan.envKey} is not configured.`);
            return;
        }
        if (!razorpayKeyId) {
            alert("VITE_RAZORPAY_KEY_ID is not configured in client environment. Please add it.");
            return;
        }

        setSubscribingTo(plan.key);
        try {
            const isLoaded = await loadRazorpayScript();
            if (!isLoaded) {
                alert("Razorpay SDK failed to load. Are you online?");
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
                    color: "#06b6d4" // cyan-500
                },
                prefill: {
                    email: user?.email || ""
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
                                }
                                retries++;
                            } catch {
                                // ignore errors during polling
                            }
                        }, 2000);
                    }
                },
                modal: {
                    ondismiss: function() {
                        setSubscribingTo(null);
                    }
                }
            };
            
            const rzp = new (window as any).Razorpay(options);
            rzp.on('payment.failed', function (response: any){
                alert(response.error.description);
                setSubscribingTo(null);
            });
            rzp.open();
        } catch (err: any) {
            alert(err?.response?.data?.error || "Failed to start checkout.");
            setSubscribingTo(null);
        }
    };

    const handleCancel = async () => {
        if (!window.confirm("Are you sure? You'll be downgraded to Free immediately.")) return;
        setCancelling(true);
        try {
            await cancelSubscription();
            await fetchUser();
        } catch (err: any) {
            alert(err?.response?.data?.error || "Failed to cancel subscription.");
        } finally {
            setCancelling(false);
        }
    };

    // -------------------------------------------------------------------------
    // Render helpers
    // -------------------------------------------------------------------------

    const renderButton = (plan: PlanDef) => {
        const effectivePlan = user?.plan ?? "FREE";
        const isCurrentPlan = effectivePlan === plan.key;
        const isLoading = subscribingTo === plan.key;

        if (isCurrentPlan) {
            return (
                <div className="w-full text-center py-2.5 text-[12px] font-['JetBrains_Mono'] text-cyan-400 border border-cyan-500/30 rounded-full">
                    Current Plan
                </div>
            );
        }

        if (plan.key === "FREE") {
            return (
                <div className="w-full text-center py-2.5 text-[12px] font-['JetBrains_Mono'] text-neutral-600 border border-[#1A1A1A] rounded-full">
                    Downgrade via Cancel
                </div>
            );
        }

        return (
            <button
                onClick={() => handleUpgrade(plan)}
                disabled={isLoading || !!subscribingTo}
                className="w-full flex items-center justify-center gap-2 py-2.5 text-[13px] font-bold font-['Inter'] bg-white text-black rounded-full hover:bg-neutral-200 transition-all hover:-translate-y-0.5 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0"
            >
                {isLoading ? (
                    <>
                        <Loader2 size={12} className="animate-spin" />
                        Redirecting...
                    </>
                ) : (
                    <>
                        <CreditCard size={12} />
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
        <div className="relative min-h-screen bg-black text-white font-['Inter'] overflow-x-hidden">
            {/* Subtle gradient accent — matches landing/dashboard */}
            <div className="fixed inset-x-0 top-0 h-72 pointer-events-none z-0 c5-animated-gradient opacity-[0.08] blur-3xl" />
            <div className="fixed inset-0 pointer-events-none z-0 bg-gradient-to-b from-transparent via-black to-black" />

            <div className="relative z-10 flex flex-col min-h-screen">
                <AppHeader user={user} />

                {/* Body */}
                <main className="w-full px-5 sm:px-8 lg:px-12 flex-1 py-8 sm:py-10">
                    <div className="max-w-[1100px] mx-auto">
                        <div className="mb-8">
                            <h1
                                className="text-white"
                                style={{
                                    fontFamily: '"Satoshi Variable", sans-serif',
                                    fontWeight: 400,
                                    fontSize: "clamp(1.75rem,4vw,2.5rem)",
                                    lineHeight: 1.1,
                                    letterSpacing: "-0.03em",
                                }}
                            >
                                Subscription
                            </h1>
                            <p className="text-white/50 text-sm mt-2">
                                Choose the plan that fits your security testing needs.
                            </p>
                        </div>

                        {/* Pricing cards */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch">
                            {PLANS.map((plan) => {
                                const isActive = (user?.plan ?? "FREE") === plan.key;
                                return (
                                    <div
                                        key={plan.key}
                                        className={`relative flex flex-col p-6 rounded-2xl transition-colors ${
                                            isActive
                                                ? "border border-cyan-500/50 bg-cyan-500/[0.04]"
                                                : plan.highlight
                                                  ? "c5-animated-gradient shadow-[0_10px_30px_rgba(0,0,0,0.4)]"
                                                  : "border border-[#1A1A1A] bg-[#0A0A0A]"
                                        }`}
                                    >
                                        {/* Popular badge */}
                                        {plan.highlight && !isActive && (
                                            <div className="absolute -top-px left-1/2 -translate-x-1/2 z-20">
                                                <span className="bg-white text-black text-[10px] font-bold font-['JetBrains_Mono'] tracking-widest uppercase px-3 py-0.5 rounded-b-md">
                                                    Most Popular
                                                </span>
                                            </div>
                                        )}

                                        {/* Active badge */}
                                        {isActive && (
                                            <div className="absolute -top-px left-1/2 -translate-x-1/2 z-20">
                                                <span className="bg-cyan-500 text-black text-[10px] font-bold font-['JetBrains_Mono'] tracking-widest uppercase px-3 py-0.5 rounded-b-md">
                                                    Active
                                                </span>
                                            </div>
                                        )}

                                        {/* Inner panel for highlighted card so text stays legible over gradient */}
                                        <div
                                            className={`flex flex-col flex-1 ${
                                                plan.highlight && !isActive
                                                    ? "bg-black/40 backdrop-blur-[2px] -m-6 p-6 rounded-2xl"
                                                    : ""
                                            }`}
                                        >
                                            <div className="mb-4">
                                                <p className="text-white/60 text-[11px] font-['JetBrains_Mono'] uppercase tracking-widest mb-2">
                                                    {plan.name}
                                                </p>
                                                <div className="flex items-baseline gap-1">
                                                    <span className="text-3xl font-semibold tabular-nums">{plan.price}</span>
                                                    <span className="text-white/50 text-sm">{plan.period}</span>
                                                </div>
                                                {plan.inrNote && (
                                                    <span className="text-xs text-white/40 mt-0.5 block">{plan.inrNote}</span>
                                                )}
                                            </div>

                                            <ul className="flex-1 space-y-2.5 mb-6">
                                                {plan.features.map((f) => (
                                                    <li key={f} className="flex items-start gap-2 text-[13px] text-white/80">
                                                        <Check
                                                            size={13}
                                                            className={`shrink-0 mt-0.5 ${plan.highlight && !isActive ? "text-white" : "text-cyan-500"}`}
                                                        />
                                                        {f}
                                                    </li>
                                                ))}
                                            </ul>

                                            {renderButton(plan)}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Cancel subscription */}
                        {user && (user.plan === "PRO" || user.plan === "TEAM") && (
                            <div className="mt-10 pt-8 border-t border-[#1A1A1A] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                <div>
                                    <p className="text-sm font-medium">Cancel subscription</p>
                                    <p className="text-white/50 text-[12px] mt-0.5">
                                        You'll be immediately downgraded to the Free plan.
                                    </p>
                                </div>
                                <button
                                    onClick={handleCancel}
                                    disabled={cancelling}
                                    className="flex items-center gap-2 px-5 py-2.5 text-[12px] font-bold font-['Inter'] border border-red-500/40 text-red-400 hover:bg-red-500/10 transition-colors rounded-full disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                                >
                                    {cancelling ? (
                                        <>
                                            <Loader2 size={12} className="animate-spin" />
                                            Cancelling...
                                        </>
                                    ) : (
                                        "Cancel subscription"
                                    )}
                                </button>
                            </div>
                        )}
                    </div>
                </main>
            </div>
        </div>
    );
};

export default Billing;

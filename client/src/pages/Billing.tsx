// =============================================================================
// Billing — Subscription management & plan upgrade
// =============================================================================

import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
    Shield,
    ArrowLeft,
    Check,
    Loader2,
    CreditCard,
} from "lucide-react";
import {
    getCurrentUser,
    subscribeToPlan,
    cancelSubscription,
    type Plan,
    type CurrentUser,
} from "@/services/api";

// ---------------------------------------------------------------------------
// Plan definitions
// ---------------------------------------------------------------------------

interface PlanDef {
    key: Plan;
    name: string;
    price: string;
    period: string;
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
        price: "$29",
        period: "/mo",
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
        price: "$99",
        period: "/mo",
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

const Billing = () => {
    const navigate = useNavigate();
    const [user, setUser] = useState<CurrentUser | null>(null);
    const [loadingUser, setLoadingUser] = useState(true);
    const [subscribingTo, setSubscribingTo] = useState<Plan | null>(null);
    const [cancelling, setCancelling] = useState(false);

    const fetchUser = useCallback(async () => {
        try {
            setLoadingUser(true);
            const u = await getCurrentUser();
            setUser(u);
        } catch {
            // auth interceptor will redirect to /signin on 401
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
        if (!planId) {
            alert(`${plan.envKey} is not configured.`);
            return;
        }

        setSubscribingTo(plan.key);
        try {
            const { shortUrl } = await subscribeToPlan(planId);
            window.location.href = shortUrl;
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
        if (!user) return null;

        const isCurrentPlan = user.plan === plan.key;
        const isLoading = subscribingTo === plan.key;

        if (isCurrentPlan) {
            return (
                <div className="w-full text-center py-2 text-[12px] font-['JetBrains_Mono'] text-cyan-400 border border-cyan-500/30 rounded-sm">
                    Current Plan
                </div>
            );
        }

        if (plan.key === "FREE") {
            return (
                <div className="w-full text-center py-2 text-[12px] font-['JetBrains_Mono'] text-neutral-600 border border-neutral-800 rounded-sm">
                    Downgrade via Cancel
                </div>
            );
        }

        return (
            <button
                onClick={() => handleUpgrade(plan)}
                disabled={isLoading || !!subscribingTo}
                className="w-full flex items-center justify-center gap-2 py-2 text-[12px] font-bold font-['Inter'] bg-white text-black rounded-sm hover:bg-neutral-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
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
            {/* Background lines */}
            <div
                className="fixed inset-0 pointer-events-none z-0"
                style={{
                    backgroundImage:
                        "repeating-linear-gradient(45deg, #111 0, #111 1px, transparent 1px, transparent 16px)",
                    WebkitMaskImage: "linear-gradient(to bottom, black 10%, transparent 80%)",
                    maskImage: "linear-gradient(to bottom, black 10%, transparent 80%)",
                }}
            />

            <div className="w-[90%] max-w-5xl mx-auto min-h-screen flex flex-col border-x border-[#2A2A2A] relative bg-black z-10 shadow-[0_0_40px_rgba(0,0,0,0.8)]">
                {/* Header */}
                <header className="shrink-0 border-b border-neutral-800 bg-[#0A0A0A]">
                    <div className="h-14 flex items-center justify-between px-4 sm:px-6 gap-3">
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => navigate("/dashboard")}
                                className="text-neutral-600 hover:text-white transition-colors p-1"
                                aria-label="Back to dashboard"
                            >
                                <ArrowLeft size={16} />
                            </button>
                            <div className="w-px h-5 bg-neutral-800" />
                            <div className="flex items-center gap-2">
                                <Shield size={16} className="text-white" />
                                <span className="text-white text-sm font-semibold tracking-tight">Onyx</span>
                            </div>
                            <div className="w-px h-4 bg-neutral-800 mx-1 hidden sm:block" />
                            <div className="hidden sm:flex items-center gap-4">
                                <button
                                    onClick={() => navigate("/dashboard")}
                                    className="text-neutral-500 hover:text-white text-[13px] font-medium transition-colors"
                                >
                                    Dashboard
                                </button>
                                <button
                                    onClick={() => navigate("/history")}
                                    className="text-neutral-500 hover:text-white text-[13px] font-medium transition-colors"
                                >
                                    History
                                </button>
                                <span className="text-white text-[13px] font-medium">Billing</span>
                            </div>
                        </div>

                        {user && (
                            <div className="flex items-center gap-2 text-[11px] font-['JetBrains_Mono'] text-neutral-500">
                                <span className="uppercase tracking-wider">Plan:</span>
                                <span className={`font-bold ${user.plan === "FREE" ? "text-neutral-400" : "text-cyan-400"}`}>
                                    {user.plan}
                                </span>
                            </div>
                        )}
                    </div>
                </header>

                {/* Body */}
                <div className="flex-1 px-4 sm:px-8 py-10">
                    <div className="mb-8">
                        <h1 className="text-2xl font-semibold tracking-tight">Subscription</h1>
                        <p className="text-neutral-500 text-sm mt-1">
                            Choose the plan that fits your security testing needs.
                        </p>
                    </div>

                    {loadingUser ? (
                        <div className="flex items-center justify-center h-48 text-neutral-600 font-['JetBrains_Mono'] text-xs gap-2">
                            <Loader2 size={16} className="animate-spin" />
                            Loading plan info...
                        </div>
                    ) : (
                        <>
                            {/* Pricing cards */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {PLANS.map((plan) => {
                                    const isActive = user?.plan === plan.key;
                                    return (
                                        <div
                                            key={plan.key}
                                            className={`relative flex flex-col p-6 border rounded-sm transition-colors ${
                                                isActive
                                                    ? "border-cyan-500/50 bg-cyan-500/[0.04]"
                                                    : plan.highlight
                                                      ? "border-neutral-600 bg-[#0D0D0D]"
                                                      : "border-neutral-800 bg-[#0A0A0A]"
                                            }`}
                                        >
                                            {/* Popular badge */}
                                            {plan.highlight && !isActive && (
                                                <div className="absolute -top-px left-1/2 -translate-x-1/2">
                                                    <span className="bg-white text-black text-[10px] font-bold font-['JetBrains_Mono'] tracking-widest uppercase px-3 py-0.5">
                                                        Most Popular
                                                    </span>
                                                </div>
                                            )}

                                            {/* Active badge */}
                                            {isActive && (
                                                <div className="absolute -top-px left-1/2 -translate-x-1/2">
                                                    <span className="bg-cyan-500 text-black text-[10px] font-bold font-['JetBrains_Mono'] tracking-widest uppercase px-3 py-0.5">
                                                        Active
                                                    </span>
                                                </div>
                                            )}

                                            <div className="mb-4">
                                                <p className="text-neutral-400 text-[11px] font-['JetBrains_Mono'] uppercase tracking-widest mb-2">
                                                    {plan.name}
                                                </p>
                                                <div className="flex items-baseline gap-1">
                                                    <span className="text-3xl font-semibold tabular-nums">{plan.price}</span>
                                                    <span className="text-neutral-500 text-sm">{plan.period}</span>
                                                </div>
                                            </div>

                                            <ul className="flex-1 space-y-2.5 mb-6">
                                                {plan.features.map((f) => (
                                                    <li key={f} className="flex items-start gap-2 text-[13px] text-neutral-300">
                                                        <Check size={13} className="text-cyan-500 shrink-0 mt-0.5" />
                                                        {f}
                                                    </li>
                                                ))}
                                            </ul>

                                            {renderButton(plan)}
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Cancel subscription */}
                            {user && (user.plan === "PRO" || user.plan === "TEAM") && (
                                <div className="mt-10 pt-8 border-t border-neutral-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                    <div>
                                        <p className="text-sm font-medium">Cancel subscription</p>
                                        <p className="text-neutral-500 text-[12px] mt-0.5">
                                            You'll be immediately downgraded to the Free plan.
                                        </p>
                                    </div>
                                    <button
                                        onClick={handleCancel}
                                        disabled={cancelling}
                                        className="flex items-center gap-2 px-4 py-2 text-[12px] font-bold font-['Inter'] border border-red-500/40 text-red-400 hover:bg-red-500/10 transition-colors rounded-sm disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
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
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Billing;

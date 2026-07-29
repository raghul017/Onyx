// =============================================================================
// PricingSection — the homepage pricing tiers, extracted from Landing.tsx (T21a)
// so the new standalone /pricing route reuses the exact same real content.
// The homepage renders <PricingSection /> at #pricing; the /pricing page renders
// the same component. Full standalone page treatment lands in T21d.
// =============================================================================
import { Check, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";

export interface PricingPlan {
    name: string;
    price: string;
    period: string;
    inrNote?: string;
    features: string[];
    cta: string;
    href: string;
    highlight: boolean;
}

export const pricingPlans: PricingPlan[] = [
    {
        name: "Free",
        price: "$0",
        period: "/mo",
        features: [
            "5 test runs / month",
            "10 endpoints per run",
            "5 attack types",
            "Community support",
        ],
        cta: "Start free scan",
        href: "/dashboard",
        highlight: false,
    },
    {
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
        cta: "Upgrade to Pro",
        href: "/billing",
        highlight: true,
    },
    {
        name: "Team",
        price: "$18",
        period: "/mo",
        inrNote: "Billed in INR (₹1800/mo)",
        features: [
            "500 test runs / month",
            "Unlimited endpoints",
            "Everything in Pro",
            "Multi-user workspaces",
            "API access",
            "SLA support",
        ],
        cta: "Upgrade to Team",
        href: "/billing",
        highlight: false,
    },
];

const PricingSection = () => {
    const navigate = useNavigate();
    return (
        <section id="pricing" className="w-full border-b border-[#e6e6e6] px-6 py-16 lg:py-24">
            <div className="max-w-[1280px] mx-auto">
                {/* Section Header */}
                <div className="mb-12 flex flex-col items-start text-left">
                    <div className="mono-eyebrow mb-4">
                        <span className="sq" /> PRICING
                    </div>
                    <h2 className="text-[44px] leading-tight text-balance">
                        Simple, transparent pricing
                    </h2>
                    <p className="text-[15px] text-[#666] mt-4 max-w-md leading-relaxed">
                        Start free. Upgrade when you need more power.
                    </p>
                    <p className="text-[13px] text-[#666] mt-4 flex items-center gap-2">
                        <Check size={13} className="text-[#3b82f6] shrink-0" />
                        No credit card required · Cancel anytime
                    </p>
                </div>

                {/* Pricing Cards — hairline grid, rounded container */}
                <div className="grid grid-cols-1 md:grid-cols-3 border-t border-l border-[#e6e6e6] overflow-hidden">
                    {pricingPlans.map((plan, i) => (
                        <motion.div
                            key={plan.name}
                            initial={{ opacity: 0, y: 24 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true, margin: "-80px" }}
                            transition={{
                                delay: i * 0.1,
                                duration: 0.5,
                                ease: [0.2, 0, 0, 1],
                            }}
                            className={`relative flex flex-col p-8 border-r border-b border-[#e6e6e6] transition-colors ${
                                plan.highlight ? "bg-white" : "bg-transparent hover:bg-white"
                            }`}
                        >
                            {plan.highlight && (
                                <span className="absolute top-0 right-0 mono-pill !border-b !border-l !border-t-0 !border-r-0 !border-[#93c5fd] !text-[#3b82f6] uppercase text-[10px] tracking-wider bg-white">
                                    Most Popular
                                </span>
                            )}

                            <p className="font-mono text-[12px] uppercase tracking-wider text-[#666] mb-4">
                                {plan.name}
                            </p>
                            <div className="flex items-baseline gap-1">
                                <span className="text-[44px] leading-none font-medium">
                                    {plan.price}
                                </span>
                                <span className="text-[#666] text-[15px]">{plan.period}</span>
                            </div>
                            {plan.inrNote ? (
                                <span className="text-xs text-[#999] mt-2 mb-8">{plan.inrNote}</span>
                            ) : (
                                <div className="mb-8 mt-2 h-4" />
                            )}

                            <ul className="flex-1 space-y-3 mb-8">
                                {plan.features.map((f) => (
                                    <li
                                        key={f}
                                        className="flex items-start gap-2.5 text-[13.5px] leading-relaxed text-[#333]"
                                    >
                                        <Check size={14} className="shrink-0 mt-0.5 text-[#3b82f6]" />
                                        {f}
                                    </li>
                                ))}
                            </ul>

                            <button
                                onClick={() => navigate(plan.href)}
                                aria-label={`${plan.cta}, ${plan.name} plan`}
                                className={
                                    plan.highlight
                                        ? "mono-btn w-full justify-center"
                                        : "mono-btn-ghost w-full justify-center"
                                }
                            >
                                {plan.cta}
                                <ArrowRight size={14} />
                            </button>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
};

export default PricingSection;

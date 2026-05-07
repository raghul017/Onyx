import { Check } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import Hero from "../components/Hero";
import FeatureShowcase from "../components/FeatureShowcase";
import SupportedTech from "../components/SupportedTech";
import Pipeline from "../components/Pipeline";
import Footer from "../components/Footer";

// ---------------------------------------------------------------------------
// Social Proof Bar
// ---------------------------------------------------------------------------
const SocialProofBar = () => (
    <div className="w-full border-t border-b border-[#1A1A1A] bg-[#050505] py-3 px-8">
        <p className="font-['Inter',sans-serif] font-normal text-[13px] text-[#555555] text-center tracking-wide">
            Used by developers across{" "}
            <span className="text-[#777777]">10+ countries</span>
            {" · "}
            Powered by{" "}
            <span className="text-[#777777]">Gemini AI</span>
            {" · "}
            Built with{" "}
            <span className="text-[#777777]">Node.js + Redis</span>
        </p>
    </div>
);

// ---------------------------------------------------------------------------
// Stats Section
// ---------------------------------------------------------------------------
const stats = [
    { value: "500+", label: "API Scans Run" },
    { value: "10+",  label: "Attack Types" },
    { value: "Live", label: "Real-time Results" },
];

const StatsSection = () => (
    <section className="w-full px-8 py-24">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {stats.map((s) => (
                <div
                    key={s.label}
                    className="bg-[#0A0A0A] border-t-2 border-cyan-500 border-x border-b border-x-[#1A1A1A] border-b-[#1A1A1A] rounded-xl p-8 flex flex-col items-center justify-center text-center"
                >
                    <span
                        className="bg-gradient-to-r from-cyan-400 to-cyan-600 bg-clip-text text-transparent mb-1 drop-shadow-[0_0_20px_rgba(6,182,212,0.4)]"
                        style={{
                            fontFamily: '"Satoshi Variable", sans-serif',
                            fontWeight: 900,
                            fontSize: "48px",
                            lineHeight: "56px",
                        }}
                    >
                        {s.value}
                    </span>
                    <span className="font-['Inter',sans-serif] text-[#A1A1AA] text-[15px] mt-1">
                        {s.label}
                    </span>
                </div>
            ))}
        </div>
    </section>
);

// ---------------------------------------------------------------------------
// Pricing Section
// ---------------------------------------------------------------------------
const pricingPlans = [
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
        cta: "Get Started Free",
        href: "/dashboard",
        highlight: false,
    },
    {
        name: "Pro",
        price: "$9",
        period: "/mo",
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
        price: "$29",
        period: "/mo",
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
        <section id="pricing" className="w-full pt-24 pb-32 px-8 relative">
            {/* Section Header */}
            <div className="mb-12">
                <div className="flex items-center gap-6 mb-8">
                    <div className="h-px flex-1 bg-white/10" />
                    <span className="uppercase text-xs tracking-widest text-cyan-500 font-['Inter'] border-b border-cyan-500/40 pb-px">
                        Pricing
                    </span>
                    <div className="h-px flex-1 bg-white/10" />
                </div>
                <h2
                    className="max-w-2xl text-white font-bold"
                    style={{
                        fontFamily: '"Satoshi Variable", sans-serif',
                        fontSize: "clamp(36px, 5vw, 52px)",
                        lineHeight: "1.15",
                    }}
                >
                    Simple, transparent pricing.
                </h2>
                <p className="font-['Inter'] text-[17px] leading-[29px] text-[#ADADAD] mt-3 max-w-xl">
                    Start free. Upgrade when you need more power.
                </p>
            </div>

            {/* Pricing Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch">
                {pricingPlans.map((plan) => (
                    <div
                        key={plan.name}
                        className={`relative group bg-[#0A0A0A] border rounded-xl flex flex-col transition-all duration-300 overflow-hidden hover:scale-105 ${
                            plan.highlight
                                ? "border-2 border-cyan-500 shadow-[0_0_60px_rgba(6,182,212,0.15)]"
                                : "border-[#1A1A1A] hover:border-[#333]"
                        }`}
                    >
                        {/* Hover glow */}
                        <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/[0.03] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

                        {/* Most Popular badge */}
                        {plan.highlight && (
                            <div className="absolute top-0 left-1/2 -translate-x-1/2">
                                <span className="bg-cyan-500 text-black text-[10px] font-bold font-['Inter'] tracking-widest uppercase px-4 py-1 rounded-full translate-y-[-50%] inline-block">
                                    Most Popular
                                </span>
                            </div>
                        )}

                        <div className={`p-8 relative z-10 flex flex-col flex-1 ${plan.highlight ? "pt-10" : ""}`}>
                            <p className="font-['Inter'] text-[#A1A1AA] text-[12px] uppercase tracking-widest mb-4">
                                {plan.name}
                            </p>
                            <div className="flex items-baseline gap-1 mb-6">
                                <span
                                    className="text-white font-black"
                                    style={{
                                        fontFamily: '"Satoshi Variable", sans-serif',
                                        fontSize: "52px",
                                        lineHeight: "1",
                                    }}
                                >
                                    {plan.price}
                                </span>
                                <span className="font-['Inter'] text-[#A1A1AA] text-[15px]">
                                    {plan.period}
                                </span>
                            </div>

                            <ul className="flex-1 space-y-3 mb-8">
                                {plan.features.map((f) => (
                                    <li
                                        key={f}
                                        className="flex items-center gap-2.5 font-['Inter'] text-[#A1A1AA] text-[15px] leading-relaxed"
                                    >
                                        <Check size={14} className="text-[#22d3ee] shrink-0" />
                                        {f}
                                    </li>
                                ))}
                            </ul>

                            <button
                                onClick={() => navigate(plan.href)}
                                className={`w-full py-3 rounded-md font-['Inter'] text-[14px] font-medium transition-colors ${
                                    plan.highlight
                                        ? "bg-white text-black hover:bg-neutral-200"
                                        : "bg-transparent border border-[#333] text-[#888888] hover:border-[#555] hover:text-white"
                                }`}
                            >
                                {plan.cta}
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
const Landing = () => {
    return (
        <div className="relative min-h-screen bg-black text-white selection:bg-cyan-400 selection:text-black font-['Inter'] overflow-x-hidden">
            {/* Slanted Background Lines */}
            <div
                className="fixed inset-0 pointer-events-none z-0"
                style={{
                    backgroundImage:
                        "repeating-linear-gradient(45deg, #222 0, #222 1px, transparent 1px, transparent 16px)",
                    WebkitMaskImage:
                        "linear-gradient(to bottom, black 10%, transparent 100%)",
                    maskImage:
                        "linear-gradient(to bottom, black 10%, transparent 100%)",
                }}
            />

            <Navbar />

            {/* Master Content Grid */}
            <div className="w-[90%] max-w-6xl mx-auto min-h-screen border-x border-[#333333] relative bg-black z-10 pt-16">
                <main>
                    <Hero />
                    <SocialProofBar />
                    <StatsSection />
                    <Pipeline />
                    <FeatureShowcase />
                    <PricingSection />
                    <SupportedTech />
                    <Footer />
                </main>
            </div>
        </div>
    );
};

export default Landing;

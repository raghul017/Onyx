import { useEffect } from "react";
import { Check } from "lucide-react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Navbar from "../components/Navbar";
import Hero from "../components/Hero";
import PoweredBy from "../components/PoweredBy";
import FeatureShowcase from "../components/FeatureShowcase";
import HowItWorks from "../components/HowItWorks";
import AboutSection from "../components/AboutSection";
import FaqCta from "../components/FaqCta";
import Footer from "../components/Footer";

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
        <section id="pricing" className="w-full py-16 sm:py-20 lg:py-24 px-5 sm:px-8 lg:px-12 relative overflow-hidden">
            {/* Subtle hero-matched gradient glow behind the section */}
            <div className="absolute inset-0 c5-animated-gradient opacity-[0.12] blur-3xl pointer-events-none" />
            <div className="absolute inset-0 bg-gradient-to-b from-[#080808] via-transparent to-[#080808] pointer-events-none" />

            <div className="max-w-[1280px] mx-auto relative z-10">
                {/* Section Header — centered */}
                <div className="mb-10 sm:mb-12 flex flex-col items-start text-left">
                    <h2
                        className="text-white max-w-2xl text-balance"
                        style={{
                            fontFamily: '"Satoshi Variable", sans-serif',
                            fontWeight: 400,
                            fontSize: "clamp(1.875rem, 4vw, 2.75rem)",
                            lineHeight: 1.1,
                            letterSpacing: "-0.03em",
                        }}
                    >
                        Simple, transparent pricing.
                    </h2>
                    <p className="font-['Inter'] text-[16px] sm:text-[17px] leading-[1.6] text-[#ADADAD] mt-4 max-w-xl">
                        Start free. Upgrade when you need more power.
                    </p>
                    <p className="font-['Inter'] text-[13px] text-white/50 mt-4 flex items-center gap-2">
                        <Check size={13} className="text-[#22d3ee] shrink-0" />
                        No credit card required · Cancel anytime
                    </p>
                </div>

                {/* Pricing Cards */}
                <motion.div
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, margin: "-80px" }}
                    variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.1 } } }}
                    className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch"
                >
                    {pricingPlans.map((plan) => (
                        <motion.div
                            key={plan.name}
                            variants={{
                                hidden: { opacity: 0, y: 24 },
                                visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
                            }}
                            className={`relative group rounded-2xl flex flex-col transition-colors duration-300 overflow-hidden ${
                                plan.highlight
                                    ? "c5-animated-gradient shadow-[0_10px_30px_rgba(0,0,0,0.4)] md:-my-2"
                                    : "bg-[#0A0A0A] border border-[#1A1A1A] hover:border-[#333]"
                            }`}
                        >
                            {/* Most Popular badge */}
                            {plan.highlight && (
                                <div className="absolute top-0 left-1/2 -translate-x-1/2 z-20">
                                    <span className="bg-white text-black text-[10px] font-bold font-['Inter'] tracking-widest uppercase px-4 py-1 rounded-b-md">
                                        Most Popular
                                    </span>
                                </div>
                            )}

                            {/* Inner panel — keeps text legible over the gradient */}
                            <div
                                className={`relative z-10 flex flex-col flex-1 p-6 pt-9 ${
                                    plan.highlight
                                        ? "bg-black/40 backdrop-blur-[2px] m-[1.5px] rounded-2xl"
                                        : ""
                                }`}
                            >
                                <p className="font-['Inter'] text-white/70 text-[12px] uppercase tracking-widest mb-3">
                                    {plan.name}
                                </p>
                                <div className="flex items-baseline gap-1">
                                    <span
                                        className="text-white drop-shadow-[0_1px_8px_rgba(0,0,0,0.4)]"
                                        style={{
                                            fontFamily: '"Satoshi Variable", sans-serif',
                                            fontWeight: 400,
                                            fontSize: "40px",
                                            lineHeight: "48px",
                                        }}
                                    >
                                        {plan.price}
                                    </span>
                                    <span className="font-['Inter'] text-white/60 text-[15px]">
                                        {plan.period}
                                    </span>
                                </div>
                                {plan.inrNote && (
                                    <span className="text-xs text-white/40 mt-1 mb-6">
                                        {plan.inrNote}
                                    </span>
                                )}
                                {!plan.inrNote && <div className="mb-6" />}

                                <ul className="flex-1 space-y-3 mb-8">
                                    {plan.features.map((f) => (
                                        <li
                                            key={f}
                                            className={`flex items-center gap-2.5 font-['Inter'] text-[15px] leading-relaxed ${
                                                plan.highlight
                                                    ? "text-white/90"
                                                    : "text-[#A1A1AA]"
                                            }`}
                                        >
                                            <Check
                                                size={14}
                                                className={`shrink-0 ${plan.highlight ? "text-white" : "text-[#22d3ee]"}`}
                                            />
                                            {f}
                                        </li>
                                    ))}
                                </ul>

                                <button
                                    onClick={() => navigate(plan.href)}
                                    aria-label={`${plan.cta}, ${plan.name} plan`}
                                    className={`group w-full py-2.5 rounded-full font-['Inter'] text-[14px] font-semibold transition-transform duration-200 hover:-translate-y-0.5 active:scale-[0.96] flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-black focus-visible:ring-[#22d3ee] cursor-pointer ${
                                        plan.highlight
                                            ? "bg-white text-black hover:bg-neutral-100 shadow-[0_10px_20px_rgba(0,0,0,0.3)]"
                                            : "bg-transparent border border-[#333] text-[#888888] hover:border-[#555] hover:text-white"
                                    }`}
                                >
                                    <span className="relative overflow-hidden h-[20px] flex flex-col leading-[20px]">
                                        <span className="flex flex-col transition-transform duration-500 ease-[cubic-bezier(0.25,0.1,0.25,1)] group-hover:-translate-y-1/2">
                                            <span>{plan.cta}</span>
                                            <span>{plan.cta}</span>
                                        </span>
                                    </span>
                                </button>
                            </div>
                        </motion.div>
                    ))}
                </motion.div>
            </div>
        </section>
    );
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
const Landing = () => {
    // Recalculate ScrollTrigger positions once fonts and lazy assets settle, so
    // scrubbed animations don't "stick" against post-load layout shifts.
    useEffect(() => {
        const refresh = () => ScrollTrigger.refresh();
        const t = window.setTimeout(refresh, 400);
        if (document.fonts?.ready) document.fonts.ready.then(refresh);
        window.addEventListener("load", refresh);
        return () => {
            window.clearTimeout(t);
            window.removeEventListener("load", refresh);
        };
    }, []);

    return (
        <div className="relative min-h-screen bg-[#080808] text-white selection:bg-cyan-400 selection:text-black font-['Inter'] overflow-x-hidden antialiased">
            <Navbar />

            <main>
                {/* Hero, full-bleed; shader spans behind navbar too */}
                <Hero />

                {/* Full-width sections below the hero */}
                <div className="relative bg-[#080808] w-full">
                    <PoweredBy />
                    <AboutSection />
                    <HowItWorks />
                    <FeatureShowcase />
                    <PricingSection />
                    <FaqCta />
                    <Footer />
                </div>
            </main>
        </div>
    );
};

export default Landing;

// =============================================================================
// FaqCta — composio's big-stat split + FAQ accordion + black CTA banner.
// Light-mono theme, Onyx content.
// =============================================================================

import { useState, useEffect, useRef } from "react";
import { Minus, Plus, ArrowRight } from "lucide-react";
import {
    AnimatePresence,
    motion,
    useInView,
    useMotionValue,
    animate,
} from "framer-motion";
import { useNavigate } from "react-router-dom";

// Count-up stat — mirrors composio's number-flow on "50,000+".
const CountUp = ({ to }: { to: number }) => {
    const ref = useRef<HTMLSpanElement>(null);
    const inView = useInView(ref, { once: true, margin: "-80px" });
    const mv = useMotionValue(0);
    const [display, setDisplay] = useState("0");

    useEffect(() => {
        const unsub = mv.on("change", (v) =>
            setDisplay(Math.round(v).toLocaleString()),
        );
        return unsub;
    }, [mv]);

    useEffect(() => {
        if (inView) {
            const controls = animate(mv, to, {
                duration: 1.4,
                ease: [0.2, 0, 0, 1],
            });
            return controls.stop;
        }
    }, [inView, mv, to]);

    return (
        <span ref={ref} className="tabular-nums">
            {display}
        </span>
    );
};

const faqs = [
    {
        q: "What kind of APIs can Onyx test?",
        a: "Any REST API with an OpenAPI v3 or Swagger 2.0 spec. Paste the spec URL and Onyx parses every endpoint, parameter, and request body automatically.",
    },
    {
        q: "Do I need to own the API I'm testing?",
        a: "Yes. Onyx requires domain ownership verification (via a file probe or DNS TXT record) before it will fire a single payload at any target.",
    },
    {
        q: "How are the attack payloads generated?",
        a: "Gemini 2.5 Flash analyzes your specific endpoints and crafts targeted payloads (SQL injection, XSS, auth bypass, type confusion, and more), with a static fallback set if AI is unavailable.",
    },
    {
        q: "Is it safe to run against production?",
        a: "Onyx enforces SSRF protection, per-plan rate limiting, and a 10-second job timeout. Still, we recommend testing against staging environments where possible.",
    },
    {
        q: "What do the results look like?",
        a: "Every payload streams live to your dashboard via WebSockets, scored with CVSS-inspired severity. Pro+ plans can export full PDF reports with remediation steps.",
    },
];

const FaqCta = () => {
    const navigate = useNavigate();
    const [activeIndex, setActiveIndex] = useState<number | null>(0);

    const toggle = (i: number) =>
        setActiveIndex((prev) => (prev === i ? null : i));

    return (
        <>
            {/* Big-stat split (composio "50,000+") */}
            <section className="border-b border-[#e6e6e6] flex flex-col md:flex-row">
                <div className="p-12 lg:p-24 md:w-1/2 border-b md:border-b-0 md:border-r border-[#e6e6e6] flex flex-col justify-center">
                    <div className="mono-eyebrow mb-4">
                        <span className="sq" /> BUILT-IN GUARDRAILS
                    </div>
                    <h2 className="text-[44px] mb-6 leading-tight text-balance max-w-md">
                        Aggressive on targets. Safe by design.
                    </h2>
                    <p className="text-[#666] max-w-md leading-relaxed text-pretty">
                        Domain-ownership verification, SSRF protection, per-plan rate
                        limiting and a hard job timeout mean Onyx only ever hits the API
                        you actually own.
                    </p>
                </div>
                <div className="p-12 lg:p-24 md:w-1/2 flex flex-col justify-center bg-white/60">
                    <div className="font-mono text-[12px] uppercase tracking-wider text-[#999] mb-4">
                        Attack vectors per run
                    </div>
                    <div className="text-[80px] leading-none mb-6 tabular-nums">
                        <CountUp to={400} />
                        <span className="text-[#ccc]">+</span>
                    </div>
                    <p className="text-[#666] text-[15px]">
                        Schema-aware payloads across 8 OWASP categories.
                    </p>
                </div>
            </section>

            {/* FAQ accordion */}
            <section className="border-b border-[#e6e6e6] p-12 lg:p-24">
                <div className="max-w-[1280px] mx-auto grid grid-cols-1 md:grid-cols-[0.9fr_1.4fr] gap-10">
                    <div>
                        <div className="mono-eyebrow mb-4">
                            <span className="sq" /> FAQ
                        </div>
                        <h2 className="text-[44px] leading-tight text-balance">
                            Questions, answered
                        </h2>
                    </div>

                    <div className="flex flex-col border-t border-[#e6e6e6]">
                        {faqs.map((item, i) => {
                            const active = activeIndex === i;
                            const panelId = `faq-panel-${i}`;
                            const buttonId = `faq-button-${i}`;
                            return (
                                <div key={i} className="border-b border-[#e6e6e6]">
                                    <button
                                        id={buttonId}
                                        onClick={() => toggle(i)}
                                        aria-expanded={active}
                                        aria-controls={panelId}
                                        className="w-full flex justify-between items-center text-left text-[15px] gap-4 py-5 cursor-pointer hover:opacity-70 transition-opacity"
                                    >
                                        <span>{item.q}</span>
                                        {active ? (
                                            <Minus size={18} className="shrink-0 text-[#3b82f6]" />
                                        ) : (
                                            <Plus size={18} className="shrink-0 text-[#666]" />
                                        )}
                                    </button>
                                    <AnimatePresence initial={false}>
                                        {active && (
                                            <motion.div
                                                id={panelId}
                                                role="region"
                                                aria-labelledby={buttonId}
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: "auto", opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                transition={{ duration: 0.25, ease: "easeInOut" }}
                                                className="overflow-hidden"
                                            >
                                                <div className="pb-5 text-[13.5px] text-[#666] leading-relaxed max-w-xl text-pretty">
                                                    {item.a}
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </section>

            {/* Black CTA banner (composio footer-action) */}
            <section className="bg-black text-white p-12 lg:p-24 border-b border-black">
                <motion.div
                    initial={{ opacity: 0, y: 24 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-80px" }}
                    transition={{ duration: 0.6, ease: [0.2, 0, 0, 1] }}
                    className="max-w-[1280px] mx-auto flex flex-col md:flex-row justify-between items-center gap-8"
                >
                    <h2 className="text-[44px] text-center md:text-left leading-[1.05] text-balance">
                        Your API has flaws.
                        <br />
                        Find them first.
                    </h2>
                    <div className="flex flex-wrap gap-4 justify-center">
                        <a
                            href="https://github.com/raghul017/Onyx"
                            target="_blank"
                            rel="noreferrer"
                            className="border border-[#333] text-white px-6 py-3 font-mono uppercase text-[13px] tracking-wide hover:bg-[#111] transition-colors flex items-center gap-2"
                        >
                            View on GitHub
                        </a>
                        <button
                            onClick={() => navigate("/signup")}
                            className="group bg-white text-black px-6 py-3 font-mono uppercase text-[13px] tracking-wide font-medium hover:bg-neutral-200 transition-colors flex items-center gap-2 active:scale-[0.96]"
                            style={{ transitionProperty: "background-color, transform" }}
                        >
                            Start free scan
                            <ArrowRight
                                size={14}
                                className="transition-transform duration-300 group-hover:translate-x-0.5"
                            />
                        </button>
                    </div>
                </motion.div>
            </section>
        </>
    );
};

export default FaqCta;

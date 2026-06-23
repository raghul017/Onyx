// =============================================================================
// FaqCta — Animated gradient CTA + FAQ accordion (dark theme, Onyx content)
// =============================================================================

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import RollButton from "./RollButton";

const faqs = [
    {
        q: "What kind of APIs can Onyx test?",
        a: "Any REST API with an OpenAPI v3 or Swagger 2.0 spec. Paste the spec URL and Onyx parses every endpoint, parameter, and request body automatically.",
    },
    {
        q: "Do I need to own the API I'm testing?",
        a: "Yes. Onyx requires domain ownership verification — via a file probe or DNS TXT record — before it will fire a single payload at any target.",
    },
    {
        q: "How are the attack payloads generated?",
        a: "Gemini 2.5 Flash analyzes your specific endpoints and crafts targeted payloads — SQL injection, XSS, auth bypass, type confusion, and more — with a static fallback set if AI is unavailable.",
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
        <section className="w-full py-16 sm:py-20 lg:py-24 px-5 sm:px-8 lg:px-12">
            <div className="max-w-[1280px] w-full mx-auto">
                <div className="grid grid-cols-[1.6fr_1fr] gap-[30px] items-stretch max-[900px]:grid-cols-1 max-[900px]:gap-[60px]">
                    {/* ----------------------------------------------------- */}
                    {/* Left — Animated gradient CTA                          */}
                    {/* ----------------------------------------------------- */}
                    <div
                        className="c5-animated-gradient rounded-[24px] py-16 sm:py-20 px-8 sm:px-10 text-white flex flex-col justify-center items-center text-center"
                        style={{ boxShadow: "0 10px 30px rgba(0, 0, 0, 0.4)" }}
                    >
                        <h2
                            className="font-normal mb-4 drop-shadow-[0_2px_12px_rgba(0,0,0,0.5)]"
                            style={{
                                fontFamily: '"Satoshi Variable", sans-serif',
                                fontSize: "clamp(2rem, 4.5vw, 3.25rem)",
                                lineHeight: 1.1,
                                letterSpacing: "-0.03em",
                            }}
                        >
                            Break Your API.
                            <br />
                            Before They Do.
                        </h2>
                        <p className="text-[15px] sm:text-base leading-[1.6] mb-7 sm:mb-8 font-normal text-white/90 drop-shadow-[0_1px_8px_rgba(0,0,0,0.5)] max-w-sm">
                            Find vulnerabilities before attackers exploit them.
                        </p>
                        <RollButton
                            label="Start Testing Free"
                            onClick={() => navigate("/signup")}
                            variant="white"
                        />
                    </div>

                    {/* ----------------------------------------------------- */}
                    {/* Right — FAQ accordion (dark)                          */}
                    {/* ----------------------------------------------------- */}
                    <div className="flex flex-col justify-center gap-3">
                        {faqs.map((item, i) => {
                            const active = activeIndex === i;
                            const panelId = `faq-panel-${i}`;
                            const buttonId = `faq-button-${i}`;
                            return (
                                <div
                                    key={i}
                                    className={`bg-[#0A0A0A] border rounded-[10px] transition-colors duration-200 ${
                                        active
                                            ? "border-[#2A2A2A]"
                                            : "border-[#1A1A1A] hover:border-[#2A2A2A]"
                                    }`}
                                    style={{
                                        boxShadow: active
                                            ? "0 4px 12px rgba(0,0,0,0.3)"
                                            : "0 2px 8px rgba(0,0,0,0.2)",
                                    }}
                                >
                                    <button
                                        id={buttonId}
                                        onClick={() => toggle(i)}
                                        aria-expanded={active}
                                        aria-controls={panelId}
                                        className="w-full flex justify-between items-center text-left font-medium text-[15px] leading-snug text-white gap-4 py-[18px] px-5 cursor-pointer rounded-[10px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22d3ee]/60"
                                    >
                                        <span>{item.q}</span>
                                        <ChevronDown
                                            size={20}
                                            className={`text-neutral-400 shrink-0 transition-transform duration-300 ${active ? "rotate-180" : ""}`}
                                            aria-hidden="true"
                                        />
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
                                                <div className="px-5 pb-[18px] text-[14px] text-[#A1A1AA] leading-[1.65]">
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
            </div>
        </section>
    );
};

export default FaqCta;

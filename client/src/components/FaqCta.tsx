// =============================================================================
// FaqCta — Animated gradient CTA + FAQ accordion (dark theme, Onyx content)
// =============================================================================

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
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
                        className="c5-animated-gradient rounded-[24px] py-20 px-10 text-white flex flex-col justify-center items-center text-center"
                        style={{ boxShadow: "0 10px 30px rgba(0, 0, 0, 0.4)" }}
                    >
                        <h2
                            className="font-normal leading-[1.1] mb-[15px] drop-shadow-[0_2px_12px_rgba(0,0,0,0.5)]"
                            style={{
                                fontSize: "3.5rem",
                                letterSpacing: "-0.03em",
                            }}
                        >
                            Break Your API.
                            <br />
                            Before They Do.
                        </h2>
                        <p className="text-[0.95rem] mb-[30px] font-normal text-white/90 drop-shadow-[0_1px_8px_rgba(0,0,0,0.5)]">
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
                            return (
                                <div
                                    key={i}
                                    onClick={() => toggle(i)}
                                    className={`bg-[#0A0A0A] border rounded-[10px] py-[18px] px-5 cursor-pointer transition-all duration-200 ${
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
                                    <div className="flex justify-between items-center font-normal text-[0.9rem] text-white gap-4">
                                        <span>{item.q}</span>
                                        {active ? (
                                            <ChevronUp
                                                size={20}
                                                className="text-neutral-400 shrink-0"
                                            />
                                        ) : (
                                            <ChevronDown
                                                size={20}
                                                className="text-neutral-500 shrink-0"
                                            />
                                        )}
                                    </div>
                                    {active && (
                                        <div className="mt-3 text-[0.9rem] text-[#A1A1AA] leading-[1.6]">
                                            {item.a}
                                        </div>
                                    )}
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

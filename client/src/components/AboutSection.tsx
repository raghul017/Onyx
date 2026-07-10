// =============================================================================
// AboutSection — composio "Never leave the chat" split, adapted for Onyx.
// Left: statement + CTA. Right: a LIVE attack-stream checklist that ticks its
// rows one-by-one on an infinite loop, with the "NN / 05" counter advancing in
// step. Rounded surfaces, hairline borders, NO shadows.
// =============================================================================

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Check } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";

type Row = {
    label: string;
    tags: string[];
    sev?: "CRIT" | "HIGH" | "MED";
};

const ROWS: Row[] = [
    {
        label: "SQL injection on /users?sort=, error-based leak",
        tags: ["POST", "SQLI"],
        sev: "CRIT",
    },
    {
        label: "Auth bypass on /admin, missing role check",
        tags: ["GET", "AUTH"],
        sev: "HIGH",
    },
    {
        label: "Type confusion on /orders, array coerced to object",
        tags: ["PUT", "TYPE"],
        sev: "MED",
    },
    {
        label: "Reflected XSS on /search?q=, payload echoed unescaped",
        tags: ["GET", "XSS"],
        sev: "MED",
    },
    {
        label: "Mass assignment on /profile, is_admin writable",
        tags: ["PATCH", "BOLA"],
        sev: "HIGH",
    },
];

const sevColor: Record<NonNullable<Row["sev"]>, string> = {
    CRIT: "border-[#fca5a5] text-[#dc2626]",
    HIGH: "border-[#fdba74] text-[#ea580c]",
    MED: "border-[#93c5fd] text-[#3b82f6]",
};

const AboutSection = () => {
    const navigate = useNavigate();
    const reduce = useReducedMotion();

    // active = the row currently "running". Everything before it is done.
    // Advances every ~1.4s, wrapping back to 0 for an infinite loop.
    const [active, setActive] = useState(0);

    useEffect(() => {
        if (reduce) {
            setActive(2); // a representative static frame
            return;
        }
        const id = setInterval(() => {
            setActive((a) => (a + 1) % (ROWS.length + 1)); // +1 → a brief "all done" beat
        }, 1400);
        return () => clearInterval(id);
    }, [reduce]);

    const doneCount = Math.min(active, ROWS.length);

    return (
        <section className="border-b border-[#e6e6e6] grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-[#e6e6e6]">
            {/* Left — statement + CTA */}
            <motion.div
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.6, ease: [0.2, 0, 0, 1] }}
                className="p-12 lg:p-24 flex flex-col justify-center"
            >
                <div className="mono-eyebrow mb-4">
                    <span className="sq" /> STOP GUESSING. START BREAKING.
                </div>
                <h2 className="text-[44px] mb-6 leading-[1.05] text-balance">
                    Never miss a vuln
                </h2>
                <p className="text-[#000]/70 mb-8 max-w-md text-[17px] leading-7 text-pretty">
                    Onyx plugs an AI attacker into your OpenAPI spec. It fires SQL
                    injection, auth bypass, XSS, type confusion and more at every
                    endpoint you expose.
                </p>

                <div className="flex flex-wrap items-center gap-2 mb-10 text-[13px]">
                    All
                    <span className="inline-flex items-center gap-1 border border-[#e6e6e6] bg-white px-2 py-1 font-mono text-[11px] uppercase">
                        <span className="w-3.5 h-3.5 bg-black text-white text-[8px] flex items-center justify-center font-bold">
                            {"{}"}
                        </span>
                        SPEC
                    </span>
                    needed was
                    <span className="inline-flex items-center gap-1 border border-[#e6e6e6] bg-white px-2 py-1 font-mono text-[11px] uppercase">
                        <span className="w-3.5 h-3.5 bg-[#3b82f6]" />
                        ONYX
                    </span>
                </div>

                <button
                    onClick={() => navigate("/signup")}
                    className="mono-btn-ghost w-fit"
                >
                    Start free scan <ArrowRight size={14} />
                </button>
            </motion.div>

            {/* Right — live, looping attack-stream checklist */}
            <div className="p-12 lg:p-24 bg-white/50 flex items-center justify-center">
                <motion.div
                    initial={{ opacity: 0, y: 24 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-100px" }}
                    transition={{ duration: 0.6, ease: [0.2, 0, 0, 1] }}
                    className="mono-card w-full max-w-lg overflow-hidden"
                >
                    <div className="border-b border-[#e6e6e6] px-4 py-3 flex justify-between items-center font-mono text-[11px] text-[#666] uppercase tracking-wide">
                        <span className="flex items-center gap-2">
                            <span className="relative flex h-1.5 w-1.5">
                                <span className="absolute inline-flex h-full w-full rounded-full bg-[#3b82f6] opacity-75 motion-safe:animate-ping" />
                                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#3b82f6]" />
                            </span>
                            Attack running
                        </span>
                        {/* Counter advances in step with the ticking rows */}
                        <span className="tabular-nums">
                            {String(doneCount).padStart(2, "0")} / 05
                        </span>
                    </div>
                    <div className="p-2 space-y-1 text-[13px] text-[#555]">
                        {ROWS.map((row, i) => {
                            const done = i < active;
                            const running = i === active;
                            return (
                                <div
                                    key={i}
                                    className={`flex items-center gap-3 p-2 transition-colors duration-300 ${
                                        done
                                            ? "opacity-50"
                                            : running
                                              ? "text-black bg-[#f5f5f5]"
                                              : "opacity-90"
                                    }`}
                                >
                                    {/* status box — animates check on completion */}
                                    <span
                                        className={`w-4 h-4 flex items-center justify-center shrink-0 transition-colors duration-300 ${
                                            done
                                                ? "bg-[#16a34a] text-white"
                                                : running
                                                  ? "border border-[#999]"
                                                  : "border border-[#ccc]"
                                        }`}
                                    >
                                        {done && (
                                            <motion.span
                                                initial={{ scale: 0.2, opacity: 0 }}
                                                animate={{ scale: 1, opacity: 1 }}
                                                transition={{
                                                    type: "spring",
                                                    duration: 0.35,
                                                    bounce: 0,
                                                }}
                                            >
                                                <Check size={10} />
                                            </motion.span>
                                        )}
                                        {running && (
                                            <motion.span
                                                className="w-2 h-2 bg-black"
                                                animate={{ opacity: [1, 0.3, 1] }}
                                                transition={{
                                                    duration: 1,
                                                    repeat: Infinity,
                                                    ease: "easeInOut",
                                                }}
                                            />
                                        )}
                                    </span>

                                    {/* method + attack tags */}
                                    <span className="flex gap-1 shrink-0">
                                        {row.tags.map((t) => (
                                            <span
                                                key={t}
                                                className="border border-[#e6e6e6] bg-white px-1 font-mono text-[9px] uppercase text-[#666]"
                                            >
                                                {t}
                                            </span>
                                        ))}
                                    </span>

                                    <span
                                        className={`truncate flex-1 transition-all duration-300 ${
                                            done ? "line-through" : ""
                                        }`}
                                    >
                                        {row.label}
                                    </span>

                                    {row.sev && (
                                        <span
                                            className={`border px-1 font-mono text-[9px] uppercase shrink-0 ${sevColor[row.sev]}`}
                                        >
                                            {row.sev}
                                        </span>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </motion.div>
            </div>
        </section>
    );
};

export default AboutSection;

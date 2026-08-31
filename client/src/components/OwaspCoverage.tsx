// =============================================================================
// OwaspCoverage (#owasp) — homepage section (T21b).
// A compact API1–API10 grid (OWASP API Security Top 10, 2023). HONESTY: the
// categories Onyx actively detects today (API1/API2/API3/API4/API5/API8 — the
// codes the engine actually emits) are emphasized with an accent border +
// "detected" chip; the rest are shown muted as "expanding coverage". A one-line
// legend explains the two states. No overclaim of full detection.
//
// Layout mirrors the light-mono sections: mono-eyebrow, text-[44px] headline,
// p-12 lg:p-24 rhythm, hairline grid, sharp corners, single blue accent.
// =============================================================================
import { motion } from "framer-motion";

const enter = {
    initial: { opacity: 0, y: 24 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: "-100px" },
    transition: { duration: 0.6, ease: [0.2, 0, 0, 1] as const },
};

export interface OwaspCategory {
    code: string; // "API1" … "API10"
    title: string; // official 2023 title
    /** True when Onyx actively maps findings to this category today. */
    detected: boolean;
}

// Titles match server/src/services/owasp-mapping.ts (OWASP API Top 10, 2023).
// detected = codes the engine actually emits today:
//   API1 — BOLA cross-identity replays (T13a/T13b)
//   API2 — broken auth / missing-auth probes
//   API3 — mass assignment (T14b) + excessive data exposure (T14c)
//   API4 — resource consumption (oversized payload, rate limit)
//   API5 — BFLA privileged-function probes (T14a)
//   API8 — injection / misconfiguration signals
export const OWASP_CATEGORIES: OwaspCategory[] = [
    { code: "API1", title: "Broken Object Level Authorization", detected: true },
    { code: "API2", title: "Broken Authentication", detected: true },
    { code: "API3", title: "Broken Object Property Level Authorization", detected: true },
    { code: "API4", title: "Unrestricted Resource Consumption", detected: true },
    { code: "API5", title: "Broken Function Level Authorization", detected: true },
    { code: "API6", title: "Unrestricted Access to Sensitive Business Flows", detected: false },
    { code: "API7", title: "Server Side Request Forgery", detected: false },
    { code: "API8", title: "Security Misconfiguration", detected: true },
    { code: "API9", title: "Improper Inventory Management", detected: false },
    { code: "API10", title: "Unsafe Consumption of APIs", detected: false },
];

const OwaspCoverage = () => (
    <section
        id="owasp"
        className="scroll-mt-24 border-b border-[#e6e6e6] px-6 py-16 lg:py-24"
    >
        <div className="max-w-[1280px] mx-auto">
            {/* Header */}
            <motion.div {...enter} className="flex flex-col items-start text-left mb-10">
                <div className="mono-eyebrow mb-4">
                    <span className="sq" /> OWASP API TOP 10
                </div>
                <h2 className="text-[44px] leading-tight text-balance">Every finding, named.</h2>
                <p className="text-[15px] text-[#666] mt-4 max-w-2xl leading-relaxed text-pretty">
                    From injection to broken authentication to resource exhaustion, every
                    result is mapped to the OWASP API Security Top 10 (2023) — API1 through
                    API10 — with a coverage matrix in every report and PDF export.
                </p>

                {/* Legend for the two states */}
                <div className="flex flex-wrap items-center gap-5 mt-6 text-[12px] text-[#666]">
                    <span className="inline-flex items-center gap-2">
                        <span className="w-3 h-3 border border-[#3b82f6] bg-[#eff6ff]" aria-hidden="true" />
                        Actively detected today
                    </span>
                    <span className="inline-flex items-center gap-2">
                        <span className="w-3 h-3 border border-[#e6e6e6] bg-white" aria-hidden="true" />
                        Mapped &mdash; expanding coverage
                    </span>
                </div>
            </motion.div>

            {/* 10-category grid */}
            <motion.ul
                {...enter}
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 border-t border-l border-[#e6e6e6]"
            >
                {OWASP_CATEGORIES.map((c) => (
                    <li
                        key={c.code}
                        className={`relative border-r border-b border-[#e6e6e6] p-4 flex flex-col gap-2 min-h-[112px] ${
                            c.detected ? "bg-[#eff6ff]" : "bg-white"
                        }`}
                    >
                        {/* accent left rail on detected cells */}
                        {c.detected && (
                            <span
                                className="absolute inset-y-0 left-0 w-[2px] bg-[#3b82f6]"
                                aria-hidden="true"
                            />
                        )}
                        <div className="flex items-center justify-between">
                            <span className="font-mono text-[12px] font-medium tracking-wide text-black">
                                {c.code}
                            </span>
                            {c.detected ? (
                                <span className="font-mono text-[9px] uppercase tracking-wider border border-[#93c5fd] text-[#3b82f6] px-1.5 py-0.5 leading-none">
                                    Detected
                                </span>
                            ) : (
                                <span className="font-mono text-[9px] uppercase tracking-wider border border-[#e6e6e6] text-[#999] px-1.5 py-0.5 leading-none">
                                    Mapped
                                </span>
                            )}
                        </div>
                        <span
                            className={`text-[12.5px] leading-snug ${
                                c.detected ? "text-black" : "text-[#666]"
                            }`}
                        >
                            {c.title}
                        </span>
                    </li>
                ))}
            </motion.ul>
        </div>
    </section>
);

export default OwaspCoverage;

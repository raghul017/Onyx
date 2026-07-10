// =============================================================================
// FeatureShowcase — "Built for how you work" use-case card rail, styled like the
// composio landing-page.html cards: tinted pastel card (sharp corners), title,
// description with min-height, a row of white icon tiles, colored "Explore" foot.
// =============================================================================

import { useRef } from "react";
import { ArrowRight, ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";
import {
    Brain,
    Bug,
    Code,
    Lightning,
    Broadcast,
    WifiHigh,
    Pulse,
    ChartLineUp,
    Gauge,
    ListChecks,
    MagnifyingGlass,
    Crosshair,
    Warning,
    FilePdf,
    FileText,
    DownloadSimple,
} from "@phosphor-icons/react";

const FEATURES = [
    {
        title: "AI Payload Generation",
        body: "Gemini crafts schema-aware attack payloads: SQL injection, XSS, type confusion, and auth bypass.",
        tint: "bg-blue-50/40",
        footBorder: "border-blue-100",
        footText: "text-blue-600",
        icons: [Brain, Code, Bug, Lightning],
    },
    {
        title: "Live Attack Stream",
        body: "Watch payloads execute in real time over a WebSocket feed, streaming straight to your dashboard.",
        tint: "bg-indigo-50/40",
        footBorder: "border-indigo-100",
        footText: "text-indigo-600",
        icons: [Broadcast, WifiHigh, Pulse],
    },
    {
        title: "Real-Time Dashboard",
        body: "A command center for your runs. Track critical failures and drill into each endpoint, live.",
        tint: "bg-orange-50/40",
        footBorder: "border-orange-100",
        footText: "text-orange-600",
        icons: [ChartLineUp, Gauge, ListChecks],
    },
    {
        title: "Deep Detection",
        body: "Pinpoint the exact query params, headers, and bodies that trigger data leaks or crashes.",
        tint: "bg-teal-50/40",
        footBorder: "border-teal-100",
        footText: "text-teal-600",
        icons: [MagnifyingGlass, Crosshair, Warning],
    },
    {
        title: "Detailed Reporting",
        body: "Export full PDF and JSON reports with severity classification and remediation steps.",
        tint: "bg-gray-50/60",
        footBorder: "border-[#e6e6e6]",
        footText: "text-black",
        icons: [FilePdf, FileText, DownloadSimple],
    },
];

const FeatureShowcase = () => {
    const railRef = useRef<HTMLDivElement>(null);

    const scrollByCards = (dir: 1 | -1) => {
        const rail = railRef.current;
        if (!rail) return;
        rail.scrollBy({ left: dir * 344, behavior: "smooth" });
    };

    return (
        <section
            id="features"
            className="border-b border-[#e6e6e6] p-16 lg:p-24 overflow-hidden"
        >
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.6, ease: [0.2, 0, 0, 1] }}
                className="flex flex-col md:flex-row justify-between md:items-end gap-6 mb-12"
            >
                <div>
                    <div className="mono-eyebrow mb-4">
                        <span className="sq" /> CAPABILITIES
                    </div>
                    <h2 className="text-[44px] font-normal mb-4 leading-[1.05] text-balance">
                        Built for how you break APIs
                    </h2>
                    <p className="text-[#000]/70 max-w-xl text-[17px] leading-7 text-pretty">
                        Every capability tuned to the way you actually test, automated and
                        real-time, all in one run.
                    </p>
                </div>

                <div className="hidden md:flex items-center gap-1 shrink-0">
                    <button
                        onClick={() => scrollByCards(-1)}
                        aria-label="Previous"
                        className="flex items-center justify-center w-10 h-10 border border-[#e6e6e6] bg-white text-[#999] hover:text-black hover:border-black transition-colors active:scale-95"
                        style={{ transitionProperty: "color, border-color, transform" }}
                    >
                        <ArrowLeft size={16} />
                    </button>
                    <button
                        onClick={() => scrollByCards(1)}
                        aria-label="Next"
                        className="flex items-center justify-center w-10 h-10 border border-[#e6e6e6] bg-white text-black hover:border-black transition-colors active:scale-95"
                        style={{ transitionProperty: "border-color, transform" }}
                    >
                        <ArrowRight size={16} />
                    </button>
                </div>
            </motion.div>

            <div
                ref={railRef}
                className="flex gap-6 overflow-x-auto onyx-no-scrollbar scroll-smooth pb-2"
            >
                {FEATURES.map((f, i) => (
                    <motion.div
                        key={f.title}
                        initial={{ opacity: 0, y: 24 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: "-60px" }}
                        transition={{
                            delay: i * 0.08,
                            duration: 0.5,
                            ease: [0.2, 0, 0, 1],
                        }}
                        className={`group min-w-[320px] flex flex-col justify-between border border-[#e6e6e6] p-6 hover:border-black transition-colors cursor-pointer ${f.tint}`}
                    >
                        <div>
                            <h3 className="text-lg font-medium mb-2 text-black">
                                {f.title}
                            </h3>
                            <p className="text-sm text-[#666] mb-8 min-h-[60px] leading-relaxed">
                                {f.body}
                            </p>
                            <div className="flex gap-2">
                                {f.icons.map((Icon, j) => (
                                    <div
                                        key={j}
                                        className="w-10 h-10 bg-white border border-[#e6e6e6] flex items-center justify-center text-black"
                                    >
                                        <Icon size={22} weight="duotone" />
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div
                            className={`mt-8 pt-4 border-t ${f.footBorder} flex justify-between items-center font-mono text-xs uppercase font-medium ${f.footText}`}
                        >
                            Explore
                            <ArrowRight
                                size={14}
                                className="transition-transform duration-300 group-hover:translate-x-1"
                            />
                        </div>
                    </motion.div>
                ))}
            </div>
        </section>
    );
};

export default FeatureShowcase;

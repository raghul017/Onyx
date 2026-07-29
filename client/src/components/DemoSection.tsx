// =============================================================================
// DemoSection (#demo) — product-proof "watch it attack, live" section (T21-demo).
// Primary visual: the light-mono LiveConsoleReplay. Below it, two clearly-marked
// placeholder frames reserved for real media added in the T21-media pass:
//   • client/public/demo-scan.mp4     — a real scan screen-recording
//   • client/public/report-sample.png — a sample report screenshot
// Mirrors the light-mono sections (mono-eyebrow, text-[44px], p-12 lg:p-24,
// hairline borders, sharp corners, blue #3b82f6 accent, shared enter motion).
// =============================================================================
import { motion } from "framer-motion";
import { Film, FileText } from "lucide-react";
import LiveConsoleReplay from "./LiveConsoleReplay";

const enter = {
    initial: { opacity: 0, y: 24 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: "-100px" },
    transition: { duration: 0.6, ease: [0.2, 0, 0, 1] as const },
};

// Intentional, captioned placeholder frame for media swapped in during T21-media.
const MediaPlaceholder = ({
    icon: Icon,
    caption,
    hint,
}: {
    icon: typeof Film;
    caption: string;
    hint: string;
}) => (
    <div className="mono-card aspect-video flex flex-col items-center justify-center gap-3 bg-[#f5f5f5] text-center px-6">
        <Icon size={22} className="text-[#999]" aria-hidden="true" />
        <span className="font-mono text-[11px] uppercase tracking-wider text-[#666]">
            {caption}
        </span>
        <span className="text-[12px] text-[#999] max-w-[240px] leading-snug">{hint}</span>
    </div>
);

const DemoSection = () => (
    <section id="demo" className="scroll-mt-24 border-b border-[#e6e6e6] px-6 py-16 lg:py-24">
        <div className="max-w-[1280px] mx-auto">
            {/* Header */}
            <motion.div {...enter} className="flex flex-col items-start text-left mb-10">
                <div className="mono-eyebrow mb-4">
                    <span className="sq" /> SEE IT WORK
                </div>
                <h2 className="text-[44px] leading-tight text-balance">Watch it attack, live.</h2>
                <p className="text-[15px] text-[#666] mt-4 max-w-2xl leading-relaxed text-pretty">
                    Every payload streams back in real time — method, status, latency — and
                    lands as a confirmed finding with the exact evidence and the fix.
                    Here&rsquo;s a replay.
                </p>
            </motion.div>

            {/* Primary visual — the canned live-console replay */}
            <motion.div {...enter}>
                <LiveConsoleReplay />
            </motion.div>

            {/* ---------------------------------------------------------------
                T21-media swap-in slots. Replace each placeholder below with the
                real asset once produced:
                  • demo-scan.mp4     → a <video autoPlay muted loop playsInline>
                                        src="/demo-scan.mp4"
                  • report-sample.png → an <img src="/report-sample.png"
                                        alt="Onyx sample report" />
                Keep the mono-card frame + aspect-video wrapper for layout parity.
            ---------------------------------------------------------------- */}
            <motion.div {...enter} className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                {/* SWAP-IN: client/public/demo-scan.mp4 */}
                <MediaPlaceholder
                    icon={Film}
                    caption="Product walkthrough"
                    hint="Screen-recording of a live scan — coming soon."
                />
                {/* SWAP-IN: client/public/report-sample.png */}
                <MediaPlaceholder
                    icon={FileText}
                    caption="Sample report"
                    hint="A real severity-scored report with OWASP coverage — coming soon."
                />
            </motion.div>
        </div>
    </section>
);

export default DemoSection;

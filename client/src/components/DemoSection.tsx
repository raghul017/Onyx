// =============================================================================
// DemoSection (#demo) — product-proof "watch it attack, live" section (T21-demo).
// Visual: the light-mono LiveConsoleReplay (a canned replay from a fixture). The
// "coming soon" media placeholders were removed until real media exists.
// Mirrors the light-mono sections (mono-eyebrow, text-[44px], p-12 lg:p-24,
// hairline borders, sharp corners, blue #3b82f6 accent, shared enter motion).
// =============================================================================
import { motion } from "framer-motion";
import LiveConsoleReplay from "./LiveConsoleReplay";

const enter = {
    initial: { opacity: 0, y: 24 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: "-100px" },
    transition: { duration: 0.6, ease: [0.2, 0, 0, 1] as const },
};

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
                    Every request streams back in real time (method, status, latency), and
                    anything that looks wrong becomes an explained finding with the evidence,
                    a confidence level, and the fix. Here&rsquo;s a replay of a sample scan.
                </p>
            </motion.div>

            {/* The canned live-console replay */}
            <motion.div {...enter}>
                <LiveConsoleReplay />
            </motion.div>
        </div>
    </section>
);

export default DemoSection;

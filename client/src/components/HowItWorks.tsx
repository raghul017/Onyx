// =============================================================================
// HowItWorks — "Key Benefits"-style 3-card layout, Onyx content (dark theme)
// =============================================================================

import { motion } from "framer-motion";

// Hero-matched gradient blob (teal / orange / slate sphere palette)
const BLOB_GRADIENT =
    "radial-gradient(circle at 30% 30%, #73bfc4, transparent 60%), radial-gradient(circle at 70% 70%, #ff810a, transparent 60%), radial-gradient(circle at 50% 50%, #8da0ce, transparent 70%)";

const cardContainer = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.12 } },
};

const cardItem = {
    hidden: { opacity: 0, y: 24 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
};

const STEPS = [
    {
        n: "[01]",
        blobClass: "top-1/2 -translate-y-1/2 -left-40",
        title: (
            <>
                Ingest
                <br />
                Your API Schema
            </>
        ),
        body: "Paste your OpenAPI v3 or Swagger URL. The engine parses every route, parameter, and request body schema automatically — no manual setup.",
    },
    {
        n: "[02]",
        blobClass: "-top-24 left-1/2 -translate-x-1/2",
        title: (
            <>
                Verify
                <br />
                Domain Ownership
            </>
        ),
        body: "Before a single request fires, prove you own the target via a file probe or DNS TXT record. SSRF guards block private and internal hosts outright.",
    },
    {
        n: "[03]",
        blobClass: "-top-24 -right-24",
        title: (
            <>
                AI-Generated
                <br />
                Attack Payloads
            </>
        ),
        body: "Gemini 2.5 Flash analyzes each endpoint and crafts targeted payloads — SQL injection, XSS, auth bypass, path traversal, and more — tuned to your schema.",
    },
    {
        n: "[04]",
        blobClass: "-bottom-24 -right-24",
        title: (
            <>
                Queue, Fire
                <br />
                &amp; Stream Results
            </>
        ),
        body: "Payloads load into a BullMQ Redis queue and fire at the target, with every result streaming back live over WebSockets and scored by CVSS severity.",
    },
];

const HowItWorks = () => {
    return (
        <section
            id="how-it-works"
            className="relative w-full bg-black px-5 sm:px-8 lg:px-12 py-16 sm:py-20 lg:py-24"
        >
            <div className="w-full max-w-[1280px] mx-auto">
                {/* Badge row */}
                <div className="flex items-center gap-3 mb-5 sm:mb-6">
                    <div className="flex items-center justify-center w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-white text-black text-[11px] sm:text-[12px] font-semibold">
                        02
                    </div>
                    <span className="text-[12px] sm:text-[13px] font-medium text-white/80 border border-[#2A2A2A] rounded-full px-3 sm:px-4 py-1 sm:py-1.5">
                        How it works
                    </span>
                </div>

                {/* Heading */}
                <h2
                    className="text-white max-w-2xl"
                    style={{
                        fontFamily: '"Satoshi Variable", sans-serif',
                        fontWeight: 400,
                        fontSize: "clamp(1.875rem, 4vw, 2.75rem)",
                        lineHeight: 1.1,
                        letterSpacing: "-0.03em",
                    }}
                >
                    How Onyx breaks your API.
                </h2>
                <p className="font-['Inter'] text-[16px] sm:text-[17px] leading-[1.6] text-[#ADADAD] mt-4 mb-10 sm:mb-14 max-w-xl">
                    Four steps from a spec URL to a live, severity-scored attack
                    stream — with ownership verification built in.
                </p>

                {/* Step card grid */}
                <motion.div
                    variants={cardContainer}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, margin: "-80px" }}
                    className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4"
                >
                    {STEPS.map((step) => (
                        <motion.div
                            key={step.n}
                            variants={cardItem}
                            className="group relative h-[300px] sm:h-[360px] rounded-2xl bg-neutral-950 border border-[#1A1A1A] hover:border-[#333] transition-colors duration-300 overflow-hidden p-6 sm:p-7"
                        >
                            {/* Hero-matched gradient blob */}
                            <div
                                className={`absolute ${step.blobClass} h-72 w-72 rounded-full blur-3xl opacity-50 group-hover:opacity-70 transition-opacity duration-500`}
                                style={{ background: BLOB_GRADIENT }}
                            />

                            <div className="relative z-10 flex flex-col h-full">
                                <div className="text-[#22d3ee] text-[13px] tracking-widest font-['JetBrains_Mono'] mb-4">
                                    {step.n}
                                </div>
                                <h3 className="text-white text-lg sm:text-xl font-light leading-[1.2] tracking-[-0.01em]">
                                    {step.title}
                                </h3>
                                <p className="mt-5 sm:mt-8 text-[13.5px] leading-[1.6] text-white/70 font-light">
                                    {step.body}
                                </p>
                            </div>
                        </motion.div>
                    ))}
                </motion.div>
            </div>
        </section>
    );
};

export default HowItWorks;

// =============================================================================
// HowItWorks — composio "One connection, every app" floating-pill section,
// adapted for Onyx: one spec, every attack category (scattered attack pills),
// followed by the four-step pipeline as hard-bordered mono cards.
// =============================================================================

import { lazy, Suspense } from "react";
import { ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

// Rotating dot-globe (three.js) is lazy — three loads after paint.
const DotGlobe = lazy(() => import("./DotGlobe"));

// OWASP attack categories anchored to the rotating globe.
const ATTACKS = [
    { label: "SQL Injection" },
    { label: "Auth Bypass" },
    { label: "Reflected XSS" },
    { label: "Type Confusion" },
    { label: "BOLA / IDOR" },
    { label: "Mass Assignment" },
    { label: "SSRF" },
    { label: "Rate-limit Bypass" },
    { label: "Path Traversal" },
    { label: "NoSQL Injection" },
    { label: "Command Injection" },
    { label: "JWT Tampering" },
    { label: "SSTI" },
    { label: "XXE" },
];

const STEPS = [
    {
        n: "01",
        verb: "Ingest",
        sub: "your API schema",
        body: "Paste your OpenAPI v3 or Swagger URL. The engine parses every route, parameter, and request body automatically, with no manual setup.",
    },
    {
        n: "02",
        verb: "Verify",
        sub: "domain ownership",
        body: "Before a single request fires, prove you own the target via a file probe or DNS TXT record. SSRF guards block private and internal hosts.",
    },
    {
        n: "03",
        verb: "Generate",
        sub: "attack payloads",
        body: "Gemini 2.5 Flash crafts targeted, schema-aware payloads across 8 OWASP attack categories, tuned to each endpoint.",
    },
    {
        n: "04",
        verb: "Fire",
        sub: "and stream results",
        body: "Payloads fire through a BullMQ Redis queue, streaming back live over WebSockets, each scored by CVSS severity.",
    },
];

const HowItWorks = () => {
    const navigate = useNavigate();

    return (
        <section id="how-it-works" className="border-b border-[#e6e6e6]">
            {/* Rotating dot-globe with orbiting attack pills */}
            <div className="relative overflow-hidden border-b border-[#e6e6e6] grid grid-cols-1 lg:grid-cols-2 items-center">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-100px" }}
                    transition={{ duration: 0.6, ease: [0.2, 0, 0, 1] }}
                    className="p-12 lg:p-24 max-w-2xl relative z-10"
                >
                    <div className="mono-eyebrow mb-4">
                        <span className="sq" /> 8 OWASP CATEGORIES
                    </div>
                    <h2 className="text-[44px] mb-6 leading-[1.05] text-balance">
                        One spec, every attack
                    </h2>
                    <p className="text-[#000]/70 mb-8 max-w-md text-[17px] leading-7 text-pretty">
                        From a single OpenAPI URL, Onyx probes every endpoint across 8
                        OWASP-mapped attack categories: injection, auth, access control,
                        and more, all in one run.
                    </p>
                    <button
                        onClick={() => navigate("/signup")}
                        className="mono-btn-ghost w-fit"
                    >
                        Start free scan <ArrowRight size={14} />
                    </button>
                </motion.div>

                {/* Rotating 3D dot-sphere — the container clips the bottom ~1/3 of the
                    globe (its inner canvas extends below the visible box). */}
                <div className="relative h-[420px] lg:h-[560px] w-full self-stretch overflow-hidden">
                    {/* Inner canvas is 1.5× the visible height, nudged down slightly so
                        a touch more of the bottom clips past the visible edge. */}
                    <div className="absolute inset-x-0 top-[6%] h-[150%]">
                        <Suspense fallback={null}>
                            <DotGlobe pills={ATTACKS} />
                        </Suspense>
                    </div>
                </div>
            </div>

            {/* Four-step pipeline grid — each card carries the mesh gradient */}
            <div className="p-12 lg:p-24">
                <div className="mono-eyebrow mb-4">
                    <span className="sq" /> HOW IT WORKS
                </div>
                <h2 className="text-[44px] mb-4 leading-tight text-balance max-w-2xl">
                    How Onyx breaks your API
                </h2>
                <p className="text-[#000]/70 mb-12 max-w-md text-[17px] leading-7 text-pretty">
                    Four steps from a spec URL to a live, severity-scored attack stream,
                    with ownership verification built in.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {STEPS.map((step, i) => (
                        <motion.div
                            key={step.verb}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true, margin: "-80px" }}
                            transition={{
                                delay: i * 0.1,
                                duration: 0.5,
                                ease: [0.2, 0, 0, 1],
                            }}
                            className="mono-mesh-card group flex flex-col border border-[#e6e6e6] overflow-hidden p-6 transition-colors"
                        >
                            <span className="mono-subbox inline-flex w-fit items-center justify-center font-mono text-[12px] tabular-nums text-[#3b82f6] px-2 py-1 mb-8">
                                {step.n}
                            </span>
                            <h3 className="text-[24px] font-medium leading-tight text-black">
                                {step.verb}
                            </h3>
                            <p className="text-[15px] text-black/70 mt-1">{step.sub}</p>
                            <p className="mt-8 text-[15px] leading-relaxed text-black/75 text-pretty">
                                {step.body}
                            </p>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
};

export default HowItWorks;

// =============================================================================
// HowItWorks — four-step pipeline. A connecting progress line draws across the
// steps as the section scrolls (motivated: reveals the sequence in order), and
// each card resolves on enter. useGSAP() handles cleanup; honors reduced motion.
// =============================================================================

import { useRef } from "react";
import { useReducedMotion } from "framer-motion";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import {
    FileMagnifyingGlass,
    ShieldCheck,
    Brain,
    Broadcast,
} from "@phosphor-icons/react";

gsap.registerPlugin(ScrollTrigger);

const TEAL = "#73bfc4";

const STEPS = [
    {
        verb: "Ingest",
        sub: "your API schema",
        icon: FileMagnifyingGlass,
        body: "Paste your OpenAPI v3 or Swagger URL. The engine parses every route, parameter, and request body automatically, with no manual setup.",
    },
    {
        verb: "Verify",
        sub: "domain ownership",
        icon: ShieldCheck,
        body: "Before a single request fires, prove you own the target via a file probe or DNS TXT record. SSRF guards block private and internal hosts.",
    },
    {
        verb: "Generate",
        sub: "attack payloads",
        icon: Brain,
        body: "Gemini 2.5 Flash crafts targeted, schema-aware payloads across 8 OWASP attack categories, tuned to each endpoint.",
    },
    {
        verb: "Fire",
        sub: "and stream results",
        icon: Broadcast,
        body: "Payloads fire through a BullMQ Redis queue, streaming back live over WebSockets, each scored by CVSS severity.",
    },
];

const HowItWorks = () => {
    const gridRef = useRef<HTMLDivElement>(null);
    const lineRef = useRef<HTMLDivElement>(null);
    const reduce = useReducedMotion();

    useGSAP(
        () => {
            const cards = gsap.utils.toArray<HTMLElement>("[data-step-card]");

            if (reduce) {
                if (lineRef.current) gsap.set(lineRef.current, { scaleX: 1 });
                gsap.set(cards, { opacity: 1, y: 0 });
                return;
            }

            // Establish the initial hidden state in the same frame (no flash).
            gsap.set(cards, { opacity: 0, y: 28 });

            // Connecting line draws across the step range (scrubbed to scroll).
            gsap.fromTo(
                lineRef.current,
                { scaleX: 0 },
                {
                    scaleX: 1,
                    ease: "none",
                    scrollTrigger: {
                        trigger: gridRef.current,
                        start: "top 75%",
                        end: "bottom 80%",
                        scrub: 0.8,
                    },
                },
            );

            // Cards resolve in quick succession as the grid enters.
            ScrollTrigger.batch(cards, {
                start: "top 88%",
                once: true,
                onEnter: (batch) =>
                    gsap.to(batch, {
                        opacity: 1,
                        y: 0,
                        duration: 0.7,
                        ease: "power3.out",
                        stagger: 0.12,
                        overwrite: true,
                    }),
            });
        },
        { scope: gridRef, dependencies: [reduce] },
    );

    return (
        <section
            id="how-it-works"
            className="relative w-full bg-[#080808] px-5 sm:px-8 lg:px-12 py-16 sm:py-20 lg:py-24"
        >
            <div className="w-full max-w-[1280px] mx-auto">
                {/* Eyebrow (1 of 2 allowed on the page) */}
                <span className="inline-block text-[12px] sm:text-[13px] font-medium text-white/80 border border-white/10 rounded-full px-3 sm:px-4 py-1 sm:py-1.5 mb-5 sm:mb-6">
                    How it works
                </span>

                {/* Heading */}
                <h2
                    className="text-white max-w-2xl text-balance"
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
                <p className="font-['Inter'] text-[16px] sm:text-[17px] leading-[1.6] text-[#9A9A9F] mt-4 mb-10 sm:mb-14 max-w-xl text-pretty">
                    Four steps from a spec URL to a live, severity-scored attack
                    stream, with ownership verification built in.
                </p>

                {/* Progress line connecting the steps (desktop), GSAP-scrubbed */}
                <div className="relative hidden lg:block h-px mb-6 bg-white/[0.07]">
                    <div
                        ref={lineRef}
                        className="absolute inset-y-0 left-0 w-full origin-left bg-gradient-to-r from-[#73bfc4] via-[#5eead4] to-[#73bfc4]"
                        style={{ transform: "scaleX(0)" }}
                    />
                </div>

                {/* Step card grid (entrance driven by GSAP) */}
                <div
                    ref={gridRef}
                    className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
                >
                    {STEPS.map((step, i) => {
                        const Icon = step.icon;
                        return (
                            <div
                                key={step.verb}
                                data-step-card
                                className="group relative flex flex-col h-full rounded-[24px] bg-[#0B0C0D] overflow-hidden p-6 sm:p-7 shadow-[0_0_0_1px_rgba(255,255,255,0.08)] hover:shadow-[0_0_0_1px_rgba(115,191,196,0.3)] transition-shadow duration-500"
                            >
                                {/* faint top sheen (matches bento) */}
                                <div
                                    className="pointer-events-none absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-[#73bfc4]/45 to-transparent opacity-70"
                                    aria-hidden="true"
                                />

                                {/* Header: icon tile */}
                                <span
                                    className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-[#73bfc4]/10 text-[#73bfc4]"
                                    style={{ boxShadow: `inset 0 0 0 1px ${TEAL}40` }}
                                >
                                    <Icon size={22} weight="duotone" />
                                </span>

                                {/* Verb + sub */}
                                <h3 className="mt-7 text-white text-[22px] sm:text-[24px] font-medium leading-[1.1] tracking-[-0.02em]">
                                    {step.verb}
                                </h3>
                                <p className="mt-1 text-[15px] text-white/45">{step.sub}</p>

                                {/* Body */}
                                <p className="mt-auto pt-6 text-[13.5px] leading-[1.6] text-white/60 text-pretty">
                                    {step.body}
                                </p>

                                {/* Active step tick row */}
                                <div className="flex items-center gap-1 mt-5" aria-hidden="true">
                                    {STEPS.map((_, j) => (
                                        <span
                                            key={j}
                                            className={`h-1 rounded-full transition-all duration-300 ${
                                                j === i ? "w-5 bg-[#73bfc4]" : "w-1.5 bg-white/15"
                                            }`}
                                        />
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </section>
    );
};

export default HowItWorks;

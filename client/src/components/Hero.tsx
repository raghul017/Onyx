import { useState, lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { useAuthStore } from "../store/useAuthStore";

// Lazy — three.js (~178KB gz) loads after paint; the CSS mesh shows meanwhile.
const ShaderHeroBG = lazy(() => import("./ShaderHeroBG"));

// Staggered entrance — each chunk rises independently (~90ms apart).
const rise = {
    hidden: { opacity: 0, y: 18 },
    show: (i: number) => ({
        opacity: 1,
        y: 0,
        transition: { delay: 0.05 + i * 0.09, duration: 0.6, ease: [0.2, 0, 0, 1] },
    }),
};

const Hero = () => {
    const navigate = useNavigate();
    const { isAuthenticated } = useAuthStore();
    const [urlInput, setUrlInput] = useState("");

    const handleLaunch = () => {
        if (!isAuthenticated) {
            if (urlInput.trim()) {
                sessionStorage.setItem("onyx-pending-url", urlInput.trim());
            }
            navigate("/signup");
            return;
        }
        navigate("/dashboard", { state: { targetUrl: urlInput } });
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") handleLaunch();
    };

    return (
        <header className="relative border-b border-[#e6e6e6] pt-24 pb-32 px-6 flex flex-col items-center justify-center text-center overflow-hidden">
            {/* Animated CSS mesh fallback (instant paint, renders everywhere) */}
            <div className="mono-hero-fallback absolute inset-0" aria-hidden="true" />
            {/* Live WebGL shader mesh paints over the fallback (progressive enhancement).
                ?noshader disables it for screenshot verification in headless. */}
            {!(typeof window !== "undefined" &&
                window.location.search.includes("noshader")) && (
                <Suspense fallback={null}>
                    <ShaderHeroBG />
                </Suspense>
            )}
            {/* faint grid overlay */}
            <div className="mono-hero-grid absolute inset-0 pointer-events-none" aria-hidden="true" />
            {/* legibility scrim → blends into the page bg at the bottom */}
            <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-b from-transparent to-[#fafafa] pointer-events-none" aria-hidden="true" />

            <div className="relative z-10 w-full max-w-3xl mx-auto flex flex-col items-center">
                {/* Status label */}
                <motion.div
                    custom={0}
                    variants={rise}
                    initial="hidden"
                    animate="show"
                    className="mono-eyebrow mb-8"
                >
                    <span className="relative flex h-2 w-2" aria-hidden="true">
                        <span className="absolute inline-flex h-full w-full rounded-full bg-[#3b82f6] opacity-75 motion-safe:animate-ping" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-[#3b82f6]" />
                    </span>
                    ONYX · API SECURITY TESTING
                </motion.div>

                {/* Headline — Geist sans, 64/64 like composio, product-in-box (rounded, no shadow) */}
                <motion.h1
                    custom={1}
                    variants={rise}
                    initial="hidden"
                    animate="show"
                    className="text-[clamp(1.85rem,7vw,64px)] leading-[1.05] font-normal mb-6 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 max-w-4xl text-balance"
                >
                    <span>Break your</span>
                    <span className="inline-flex items-center gap-2 sm:gap-3 bg-white px-2.5 py-1.5 sm:px-4 sm:py-2 border border-[#e6e6e6]">
                        <span className="flex items-center justify-center w-7 h-7 sm:w-10 sm:h-10 bg-black text-white text-[11px] sm:text-[13px] font-mono font-bold">
                            API
                        </span>
                        <span>API</span>
                    </span>
                    <span>before they do.</span>
                </motion.h1>

                {/* Subheadline — one line of value, kept short */}
                <motion.p
                    custom={2}
                    variants={rise}
                    initial="hidden"
                    animate="show"
                    className="text-[17px] leading-7 text-[#000]/70 max-w-xl mb-10 text-pretty"
                >
                    Onyx reads your OpenAPI spec, generates schema-aware attack
                    payloads, and streams every result back live.
                </motion.p>

                {/* Spec-URL console row — rounded, hairline, NO shadow */}
                <motion.div
                    custom={3}
                    variants={rise}
                    initial="hidden"
                    animate="show"
                    className="w-full max-w-2xl flex flex-col sm:flex-row items-stretch border border-[#e6e6e6] bg-white overflow-hidden"
                >
                    <label htmlFor="hero-api-url" className="sr-only">
                        API specification URL
                    </label>
                    <input
                        id="hero-api-url"
                        type="text"
                        value={urlInput}
                        onChange={(e) => setUrlInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="https://api.example.com/openapi.json"
                        className="flex-1 bg-transparent text-black font-mono text-[14px] leading-[21px] px-4 py-3.5 outline-none placeholder:text-[#999] border-b sm:border-b-0 sm:border-r border-[#e6e6e6]"
                        spellCheck={false}
                        autoComplete="off"
                    />
                    <button
                        onClick={handleLaunch}
                        className="group bg-black text-white font-mono uppercase text-[13px] tracking-wide px-6 py-3.5 flex items-center justify-center gap-2 hover:bg-[#1a1a1a] transition-colors whitespace-nowrap active:scale-[0.98]"
                        style={{ transitionProperty: "background-color, transform" }}
                    >
                        Start free scan
                        <ArrowRight
                            size={14}
                            className="transition-transform duration-300 group-hover:translate-x-0.5"
                        />
                    </button>
                </motion.div>

            </div>
        </header>
    );
};

export default Hero;

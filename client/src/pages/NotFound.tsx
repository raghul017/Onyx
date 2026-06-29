// =============================================================================
// NotFound (404) — branded, elegant. Matches the landing system: off-black,
// c5 gradient glow, Satoshi display, JetBrains Mono for the path, brand teal.
// =============================================================================

import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

const NotFound = () => {
    const location = useLocation();

    useEffect(() => {
        console.error(
            "404: route not found:",
            location.pathname,
        );
    }, [location.pathname]);

    return (
        <main className="relative min-h-screen flex items-center justify-center overflow-hidden bg-[#080808] text-white font-['Inter'] antialiased px-6">
            {/* Brand gradient glow, low opacity (matches landing) */}
            <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[460px] w-[460px] rounded-full c5-animated-gradient opacity-[0.14] blur-3xl" />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#080808]" />

            <div className="relative z-10 text-center max-w-md">
                {/* Status eyebrow */}
                <p className="font-['JetBrains_Mono'] text-[12px] tracking-[0.3em] uppercase text-[#73bfc4] mb-6">
                    404 · not found
                </p>

                {/* Big gradient numeral */}
                <h1
                    className="c5-text-gradient leading-none mb-6"
                    style={{
                        fontFamily: '"Satoshi Variable", sans-serif',
                        fontWeight: 500,
                        fontSize: "clamp(5rem, 18vw, 9rem)",
                        letterSpacing: "-0.04em",
                    }}
                >
                    404
                </h1>

                <h2
                    className="text-white text-balance mb-3"
                    style={{
                        fontFamily: '"Satoshi Variable", sans-serif',
                        fontWeight: 400,
                        fontSize: "clamp(1.5rem, 4vw, 2rem)",
                        letterSpacing: "-0.02em",
                        lineHeight: 1.1,
                    }}
                >
                    This route never existed.
                </h2>

                <p className="text-[15px] leading-[1.6] text-white/55 text-pretty mb-2">
                    Onyx couldn't find a page at
                </p>
                <code className="inline-block font-['JetBrains_Mono'] text-[13px] text-[#73bfc4] bg-[#0E0F10] rounded-lg px-3 py-1.5 mb-8 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)] max-w-full truncate">
                    {location.pathname}
                </code>

                {/* Real CTAs */}
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                    <Link
                        to="/"
                        className="group inline-flex items-center gap-2 bg-white text-black rounded-full px-5 py-2.5 text-[14px] font-semibold hover:bg-neutral-100 active:scale-[0.96] transition-[background-color,transform] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[#080808] focus-visible:ring-[#73bfc4]"
                    >
                        <ArrowLeft size={15} className="transition-transform group-hover:-translate-x-0.5" />
                        Back to home
                    </Link>
                    <Link
                        to="/dashboard"
                        className="inline-flex items-center justify-center rounded-full px-5 py-2.5 text-[14px] font-medium text-white/80 hover:text-white bg-white/[0.03] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)] hover:shadow-[inset_0_0_0_1px_rgba(115,191,196,0.4)] active:scale-[0.96] transition-[color,box-shadow,transform] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#73bfc4]/50"
                    >
                        Go to dashboard
                    </Link>
                </div>
            </div>
        </main>
    );
};

export default NotFound;

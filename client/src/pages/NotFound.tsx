// =============================================================================
// NotFound (404) — light-mono, matches the landing system: #fafafa surface,
// faint grid, Geist display numeral, JetBrains Mono for the path, sharp corners.
// =============================================================================

import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

const NotFound = () => {
    const location = useLocation();

    useEffect(() => {
        console.error("404: route not found:", location.pathname);
    }, [location.pathname]);

    return (
        <main className="onyx-mono relative min-h-screen flex items-center justify-center overflow-hidden px-6">
            {/* faint grid texture, fading out toward the edges */}
            <div className="mono-hero-grid absolute inset-0 pointer-events-none" aria-hidden="true" />
            <div className="absolute inset-0 bg-gradient-to-b from-[#fafafa]/40 via-transparent to-[#fafafa] pointer-events-none" aria-hidden="true" />

            <div className="relative z-10 text-center max-w-md">
                <div className="mono-eyebrow justify-center mb-6">
                    <span className="sq" /> 404 · NOT FOUND
                </div>

                <h1 className="text-[clamp(5rem,18vw,9rem)] leading-none font-normal tracking-tight mb-6">
                    404
                </h1>

                <h2 className="text-[clamp(1.5rem,4vw,2rem)] leading-tight font-normal tracking-tight text-balance mb-3">
                    This route never existed.
                </h2>

                <p className="text-[15px] leading-[1.6] text-[#666] text-pretty mb-2">
                    Onyx couldn't find a page at
                </p>
                <code className="inline-block font-mono text-[13px] text-[#3b82f6] bg-white border border-[#e6e6e6] px-3 py-1.5 mb-8 max-w-full truncate">
                    {location.pathname}
                </code>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                    <Link to="/" className="mono-btn">
                        <ArrowLeft size={15} />
                        Back to home
                    </Link>
                    <Link to="/dashboard" className="mono-btn-ghost">
                        Go to dashboard
                    </Link>
                </div>
            </div>
        </main>
    );
};

export default NotFound;

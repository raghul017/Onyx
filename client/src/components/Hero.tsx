import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/useAuthStore";
import ShaderBackground from "./ShaderBackground";
import RollButton from "./RollButton";

const Hero = () => {
    const navigate = useNavigate();
    const { isAuthenticated } = useAuthStore();
    const [urlInput, setUrlInput] = useState("");

    const handleLaunch = () => {
        if (!isAuthenticated) {
            // Preserve the URL so Dashboard can restore it after sign-up / sign-in
            if (urlInput.trim()) {
                sessionStorage.setItem("onyx-pending-url", urlInput.trim());
            }
            navigate("/signup");
            return;
        }
        navigate("/dashboard", { state: { targetUrl: urlInput } });
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            handleLaunch();
        }
    };

    return (
        <section className="w-full min-h-screen flex flex-col relative">
            {/* Shader spans the whole hero including the area behind the navbar */}
            <ShaderBackground />
            {/* Scrim at the bottom so content stays legible and blends into black sections below */}
            <div className="absolute inset-x-0 bottom-0 h-1/2 z-[1] bg-gradient-to-b from-transparent to-black pointer-events-none" />

            {/* Spacer pushes content to the bottom (Axion-style) */}
            <div className="flex-1" />

            {/* Bottom-anchored hero content */}
            <div className="relative z-10 w-full max-w-[1440px] mx-auto px-5 sm:px-8 lg:px-12 pb-14 sm:pb-16 lg:pb-20">
                {/* Small label */}
                <p className="text-[13px] sm:text-[14px] text-white/70 tracking-wide mb-6 sm:mb-10">
                    Onyx — API Security Testing
                </p>

                {/* Headline */}
                <h1
                    className="font-medium text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.5)]"
                    style={{
                        fontSize: "clamp(2.5rem,5vw,4.2rem)",
                        lineHeight: 1.08,
                        letterSpacing: "-0.03em",
                    }}
                >
                    Break your API.
                    <br className="hidden sm:block" />
                    <span className="sm:hidden"> </span>
                    Before they do.
                </h1>

                {/* Subheadline */}
                <p className="font-['Inter',sans-serif] text-[16px] sm:text-[18px] text-white/70 mt-6 max-w-xl drop-shadow-[0_1px_8px_rgba(0,0,0,0.5)]">
                    Most API vulnerabilities are found by hackers, not developers.
                    Onyx changes that.
                </p>

                {/* Interactive CTA Group */}
                <div className="mt-10 sm:mt-12 flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full max-w-2xl">
                    <input
                        type="text"
                        value={urlInput}
                        onChange={(e) => setUrlInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="https://api.example.com/openapi.json"
                        className="flex-1 bg-black/30 backdrop-blur-md border border-white/20 text-white font-['JetBrains_Mono'] text-[14px] px-4 py-3 rounded-full outline-none focus:border-white/50 transition-colors placeholder:text-white/40"
                        spellCheck={false}
                        autoComplete="off"
                    />
                    <RollButton
                        label="Start a scan"
                        onClick={handleLaunch}
                        className="whitespace-nowrap"
                    />
                    <a
                        href="#how-it-works"
                        onClick={(e) => {
                            e.preventDefault();
                            document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" });
                        }}
                        className="bg-white/5 backdrop-blur-md border border-white/30 text-white font-['Inter',sans-serif] text-[13px] sm:text-[14px] px-6 py-3 rounded-full hover:bg-white/10 hover:border-white/50 transition-colors flex items-center justify-center whitespace-nowrap"
                    >
                        How it works
                    </a>
                </div>
            </div>
        </section>
    );
};

export default Hero;

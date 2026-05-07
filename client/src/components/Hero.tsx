import { ArrowRight } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/useAuthStore";
import HeroTerminal from "./HeroTerminal";

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
        <section className="bg-black w-full min-h-screen flex flex-col justify-center pt-32 pb-16 px-8 relative">
            <div className="w-full flex flex-col items-start text-left">
                {/* Headline */}
                <h1 className="font-['Satoshi_Variable','Satoshi_Variable_Placeholder',sans-serif] font-black text-6xl md:text-8xl leading-[1.05] tracking-tight">
                    <span className="text-white">Break Your API.</span>
                    <br />
                    <span className="bg-gradient-to-r from-cyan-400 to-cyan-600 bg-clip-text text-transparent">
                        Before They Do.
                    </span>
                </h1>

                {/* Subheadline */}
                <p className="font-['Inter',sans-serif] font-normal text-lg text-[#888888] mt-6 max-w-xl">
                    Most API vulnerabilities are found by hackers, not developers.
                    Onyx changes that.
                </p>

                {/* Interactive CTA Group */}
                <div className="mt-8 flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full max-w-2xl">
                    <input
                        type="text"
                        value={urlInput}
                        onChange={(e) => setUrlInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="https://api.example.com/openapi.json"
                        className="flex-1 bg-[#111] border border-[#333] text-white font-['JetBrains_Mono'] text-[14px] px-4 py-3 rounded-md outline-none focus:border-[#555] transition-colors placeholder:text-neutral-600"
                        spellCheck={false}
                        autoComplete="off"
                    />
                    <button
                        onClick={handleLaunch}
                        className="bg-white text-black font-['Inter',sans-serif] font-normal text-[14px] leading-[21px] px-6 py-3 rounded-md hover:bg-neutral-200 transition-colors flex items-center justify-center gap-2 group whitespace-nowrap"
                    >
                        Start Testing
                        <ArrowRight
                            size={16}
                            className="text-neutral-500 group-hover:text-black transition-colors group-hover:translate-x-0.5"
                        />
                    </button>
                    <a
                        href="#how-it-works"
                        onClick={(e) => {
                            e.preventDefault();
                            document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" });
                        }}
                        className="bg-transparent border border-[#333] text-[#888888] font-['Inter',sans-serif] font-normal text-[14px] leading-[21px] px-6 py-3 rounded-md hover:border-[#555] hover:text-white transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
                    >
                        View Live Demo
                    </a>
                </div>
            </div>

            {/* Terminal Preview */}
            <HeroTerminal />
        </section>
    );
};

export default Hero;

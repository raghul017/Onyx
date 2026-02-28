import { ArrowRight } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import HeroTerminal from "./HeroTerminal";

const Hero = () => {
    const navigate = useNavigate();
    const [urlInput, setUrlInput] = useState("");

    const handleLaunch = () => {
        navigate("/dashboard", { state: { targetUrl: urlInput } });
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            handleLaunch();
        }
    };

    return (
        <section className="bg-black w-full pt-32 pb-16 px-8 relative">
            <div className="w-full flex flex-col items-start text-left">
                {/* Headline */}
                <h1 className="font-['Satoshi_Variable','Satoshi_Variable_Placeholder',sans-serif] font-normal text-[48px] leading-[58px] text-[rgb(255,255,255)] tracking-tight">
                    Break Your API.
                    <br />
                    Before They Do.
                </h1>

                {/* Subheadline */}
                <p className="font-['Inter',sans-serif] font-normal text-[20px] text-[#888888] mt-4 max-w-2xl">
                    The fastest AI-driven vulnerability testing engine for
                    modern infrastructure.
                </p>

                {/* Interactive CTA Group */}
                <div className="mt-8 flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full max-w-2xl">
                    <input
                        type="text"
                        value={urlInput}
                        onChange={(e) => setUrlInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="https://api.your-company.com/openapi.json"
                        className="flex-1 bg-[#111] border border-[#333] text-white font-['JetBrains_Mono'] text-[14px] px-4 py-3 rounded-md outline-none focus:border-[#555] transition-colors placeholder:text-neutral-600"
                        spellCheck={false}
                        autoComplete="off"
                    />
                    <button
                        onClick={handleLaunch}
                        className="bg-white text-black font-['Inter',sans-serif] font-normal text-[14px] leading-[21px] px-6 py-3 rounded-md hover:bg-neutral-200 transition-colors flex items-center justify-center gap-2 group whitespace-nowrap"
                    >
                        Launch Dashboard
                        <ArrowRight
                            size={16}
                            className="text-neutral-500 group-hover:text-black transition-colors"
                        />
                    </button>
                </div>
            </div>

            {/* Terminal Preview */}
            <HeroTerminal />
        </section>
    );
};

export default Hero;

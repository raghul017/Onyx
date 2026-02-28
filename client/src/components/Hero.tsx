import { ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import HeroTerminal from "./HeroTerminal";

const Hero = () => {
    const navigate = useNavigate();

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

                {/* CTA Button */}
                <button
                    onClick={() => navigate("/dashboard")}
                    className="mt-8 bg-white text-black font-['Inter',sans-serif] font-normal text-[14px] leading-[21px] px-6 py-2.5 rounded-md hover:bg-neutral-200 transition-colors flex items-center gap-2 group"
                >
                    Launch Dashboard
                    <ArrowRight
                        size={16}
                        className="text-neutral-500 group-hover:text-black transition-colors"
                    />
                </button>
            </div>

            {/* Terminal Preview */}
            <HeroTerminal />
        </section>
    );
};

export default Hero;

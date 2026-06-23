// =============================================================================
// RollButton — shared CTA with text-roll hover + rotating arrow (Axion style)
// =============================================================================

import { ArrowRight } from "lucide-react";

interface RollButtonProps {
    label: string;
    onClick?: () => void;
    /** "orange" (default) | "white" | "outline" | "gradient" */
    variant?: "orange" | "white" | "outline" | "gradient";
    className?: string;
}

const RollButton = ({
    label,
    onClick,
    variant = "orange",
    className = "",
}: RollButtonProps) => {
    const base =
        "group inline-flex items-center gap-3 rounded-full pl-5 sm:pl-6 pr-2 py-2 transition-colors w-fit text-[13px] sm:text-[14px] font-medium";

    const variants = {
        orange: "bg-[#F26522] hover:bg-[#e05a1a] text-white",
        white: "bg-white hover:bg-neutral-200 text-black",
        outline:
            "bg-white/5 backdrop-blur-md border border-white/30 hover:bg-white/10 hover:border-white/50 text-white",
        gradient:
            "c5-animated-gradient text-white shadow-[0_8px_24px_rgba(0,0,0,0.35)]",
    };

    // Arrow circle + arrow color per variant
    const circle = {
        orange: "bg-white",
        white: "bg-black",
        outline: "bg-white",
        gradient: "bg-white",
    };
    const arrow = {
        orange: "text-[#F26522]",
        white: "text-white",
        outline: "text-black",
        gradient: "text-black",
    };

    return (
        <button
            onClick={onClick}
            className={`${base} ${variants[variant]} ${className}`}
        >
            <span className="relative overflow-hidden h-[20px] flex flex-col leading-[20px]">
                <span className="flex flex-col transition-transform duration-500 ease-[cubic-bezier(0.25,0.1,0.25,1)] group-hover:-translate-y-1/2">
                    <span>{label}</span>
                    <span>{label}</span>
                </span>
            </span>
            <span
                className={`flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-full ${circle[variant]}`}
            >
                <ArrowRight
                    size={15}
                    className={`${arrow[variant]} transition-transform duration-500 ease-[cubic-bezier(0.25,0.1,0.25,1)] group-hover:-rotate-45`}
                />
            </span>
        </button>
    );
};

export default RollButton;

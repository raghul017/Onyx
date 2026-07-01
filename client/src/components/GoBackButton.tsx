// =============================================================================
// GoBackButton — animated "slide arrow" back button, brand-themed.
// Dark surface (#0B0C0D) + shadow-as-border ring + teal sliding pill, matching
// the app's card language. Concentric radii: inner = outer − inset (4px).
// Navigates back by default (or to `to`).
// =============================================================================

import { useNavigate } from "react-router-dom";

interface Props {
    to?: string;
    label?: string;
    size?: "sm" | "md";
    className?: string;
}

const GoBackButton = ({ to, label = "Go Back", size = "md", className = "" }: Props) => {
    const navigate = useNavigate();
    const sm = size === "sm";

    // Concentric: outer radius − 4px inset (top-1/left-1) = inner radius.
    // sm: outer rounded-lg (8) → inner rounded (4) ;  md: outer rounded-xl (12) → inner rounded-lg (8)
    const outer = sm ? "h-9 pl-9 pr-3.5 rounded-lg text-[13px]" : "h-11 pl-11 pr-5 rounded-xl text-[15px]";
    const innerBase = sm ? "rounded h-7 w-7 group-hover:w-[calc(100%-8px)]" : "rounded-lg h-9 w-9 group-hover:w-[calc(100%-8px)]";
    const iconPx = sm ? 16 : 20;

    return (
        <button
            type="button"
            onClick={() => (to ? navigate(to) : navigate(-1))}
            className={`group relative inline-flex items-center justify-center overflow-hidden bg-[#0B0C0D] text-white/85 font-medium ${outer} shadow-[0_0_0_1px_rgba(255,255,255,0.1)] hover:shadow-[0_0_0_1px_rgba(115,191,196,0.4)] transition-shadow duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#73bfc4]/60 active:scale-[0.97] ${className}`}
        >
            {/* sliding teal pill — starts as a square chip, expands to fill on hover */}
            <span
                className={`absolute left-1 top-1 z-10 grid place-items-center bg-[#73bfc4] ${innerBase} transition-[width] duration-500 ease-out`}
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 1024 1024"
                    height={`${iconPx}px`}
                    width={`${iconPx}px`}
                    aria-hidden="true"
                >
                    <path d="M224 480h640a32 32 0 1 1 0 64H224a32 32 0 0 1 0-64z" fill="#0B0C0D" />
                    <path
                        d="m237.248 512 265.408 265.344a32 32 0 0 1-45.312 45.312l-288-288a32 32 0 0 1 0-45.312l288-288a32 32 0 1 1 45.312 45.312L237.248 512z"
                        fill="#0B0C0D"
                    />
                </svg>
            </span>
            <span className="relative z-0">{label}</span>
        </button>
    );
};

export default GoBackButton;

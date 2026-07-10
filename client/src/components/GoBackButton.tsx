// =============================================================================
// GoBackButton — "slide arrow" back button in the light-mono system: sharp
// corners, hairline border, no shadow, a black pill that expands on hover.
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

    const outer = sm ? "h-9 pl-9 pr-3.5 text-[13px]" : "h-11 pl-11 pr-5 text-[15px]";
    const innerBase = sm ? "h-7 w-7 group-hover:w-[calc(100%-8px)]" : "h-9 w-9 group-hover:w-[calc(100%-8px)]";
    const iconPx = sm ? 16 : 20;

    return (
        <button
            type="button"
            onClick={() => (to ? navigate(to) : navigate(-1))}
            className={`group relative inline-flex items-center justify-center overflow-hidden bg-white text-black font-medium border border-[#e6e6e6] hover:border-black transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3b82f6]/40 active:scale-[0.97] ${outer} ${className}`}
        >
            {/* sliding black pill — starts as a square chip, expands to fill on hover */}
            <span
                className={`absolute left-1 top-1 z-10 grid place-items-center bg-black ${innerBase} transition-[width] duration-500 ease-out`}
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 1024 1024"
                    height={`${iconPx}px`}
                    width={`${iconPx}px`}
                    aria-hidden="true"
                >
                    <path d="M224 480h640a32 32 0 1 1 0 64H224a32 32 0 0 1 0-64z" fill="#ffffff" />
                    <path
                        d="m237.248 512 265.408 265.344a32 32 0 0 1-45.312 45.312l-288-288a32 32 0 0 1 0-45.312l288-288a32 32 0 1 1 45.312 45.312L237.248 512z"
                        fill="#ffffff"
                    />
                </svg>
            </span>
            <span className="relative z-0">{label}</span>
        </button>
    );
};

export default GoBackButton;

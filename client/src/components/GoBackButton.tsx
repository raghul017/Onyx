// =============================================================================
// GoBackButton — animated "slide arrow" back button (user-provided design,
// brand-adapted: teal fill instead of green). Navigates back by default.
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
    const outer = sm ? "w-28 h-9 rounded-xl text-[13px]" : "w-40 h-12 rounded-2xl text-[15px]";
    const inner = sm
        ? "rounded-lg h-7 group-hover:w-[104px]"
        : "rounded-xl h-10 group-hover:w-[152px]";
    const iconPx = sm ? 18 : 22;

    return (
        <button
            type="button"
            onClick={() => (to ? navigate(to) : navigate(-1))}
            className={`bg-white text-center ${outer} relative text-black font-semibold group overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#73bfc4]/60 ${className}`}
        >
            <div
                className={`bg-[#73bfc4] ${inner} w-1/4 grid place-items-center absolute left-1 top-1 z-10 duration-500 group-active:scale-[0.97]`}
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 1024 1024"
                    height={`${iconPx}px`}
                    width={`${iconPx}px`}
                    aria-hidden="true"
                >
                    <path d="M224 480h640a32 32 0 1 1 0 64H224a32 32 0 0 1 0-64z" fill="#000000" />
                    <path
                        d="m237.248 512 265.408 265.344a32 32 0 0 1-45.312 45.312l-288-288a32 32 0 0 1 0-45.312l288-288a32 32 0 1 1 45.312 45.312L237.248 512z"
                        fill="#000000"
                    />
                </svg>
            </div>
            <p className="translate-x-2">{label}</p>
        </button>
    );
};

export default GoBackButton;

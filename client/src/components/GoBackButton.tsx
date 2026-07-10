// =============================================================================
// GoBackButton — minimal back link in the light-mono system, matching the
// landing / app-header style (Linear / Stripe / Vercel cadence): muted label,
// hairline arrow that nudges left on hover, no chrome. Navigates back by
// default (or to `to`).
// =============================================================================

import { ArrowLeft } from "lucide-react";
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

    return (
        <button
            type="button"
            onClick={() => (to ? navigate(to) : navigate(-1))}
            className={`group inline-flex items-center gap-1.5 text-[#666] hover:text-black transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3b82f6]/40 ${
                sm ? "text-[13px]" : "text-[14px]"
            } ${className}`}
        >
            <ArrowLeft
                size={sm ? 15 : 16}
                className="transition-transform group-hover:-translate-x-0.5"
            />
            {label}
        </button>
    );
};

export default GoBackButton;

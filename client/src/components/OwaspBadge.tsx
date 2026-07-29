// =============================================================================
// OwaspBadge — a compact OWASP API Top 10 (2023) chip for a finding (T9b).
// Light-mono, sharp corners, hairline — styled like the severity chips but in a
// neutral slate so it reads as ADDITIVE context, not a severity. Shows the short
// code (e.g. "API8") with the full label on hover; null/absent => muted "Unmapped".
// =============================================================================

import { owaspShortCode, owaspLabel, type OwaspApiCategory } from "@/services/api";

export default function OwaspBadge({
    code,
    className = "",
}: {
    code?: OwaspApiCategory | null;
    className?: string;
}) {
    const mapped = !!code;
    return (
        <span
            title={owaspLabel(code)}
            className={
                "inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wide border shrink-0 " +
                (mapped
                    ? "text-[#475569] bg-white border-[#cbd5e1]"
                    : "text-[#999] bg-white border-[#e6e6e6]") +
                (className ? ` ${className}` : "")
            }
        >
            {owaspShortCode(code)}
        </span>
    );
}

// =============================================================================
// FindingDetailPanel — the expanded "what / why / cause / evidence / fix" view
// for a single attack result. Light-mono. Shared by the Report and the live
// Dashboard so a finding reads the same everywhere.
// =============================================================================

import type { FindingDetail } from "@/services/api";

const SEV_COLOR: Record<string, string> = {
    CRITICAL: "#dc2626",
    HIGH: "#ea580c",
    MEDIUM: "#ca8a04",
    LOW: "#3b82f6",
    INFO: "#64748b",
};

const CONFIDENCE_LABEL: Record<string, string> = {
    confirmed: "Confirmed",
    firm: "Likely",
    tentative: "Possible",
    info: "Info",
};

function Section({
    label,
    children,
    mono = false,
}: {
    label: string;
    children: React.ReactNode;
    mono?: boolean;
}) {
    return (
        <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#999] mb-1">
                {label}
            </p>
            {mono ? (
                <div className="font-mono text-[11.5px] leading-relaxed text-[#333] bg-white border border-[#e6e6e6] px-2.5 py-2 max-h-40 overflow-auto whitespace-pre-wrap break-words">
                    {children}
                </div>
            ) : (
                <p className="text-[13px] leading-relaxed text-[#333] text-pretty">
                    {children}
                </p>
            )}
        </div>
    );
}

export default function FindingDetailPanel({
    finding,
    payload,
    responseSnippet,
}: {
    finding: FindingDetail;
    payload?: string;
    responseSnippet?: string;
}) {
    const c = SEV_COLOR[finding.severity] ?? SEV_COLOR.INFO;

    return (
        <div className="px-4 sm:px-6 py-4 bg-[#fafafa] border-t border-[#e6e6e6] space-y-4">
            {/* Header — title + category + confidence */}
            <div className="flex flex-wrap items-center gap-2">
                <span
                    className="h-1.5 w-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: c }}
                />
                <span className="text-[13px] font-medium text-black">
                    {finding.title}
                </span>
                <span
                    className="font-mono text-[10px] uppercase tracking-wide px-1.5 py-0.5 border"
                    style={{ color: c, backgroundColor: c + "12", borderColor: c + "40" }}
                >
                    {finding.category}
                </span>
                <span className="font-mono text-[10px] uppercase tracking-wide text-[#999] border border-[#e6e6e6] px-1.5 py-0.5">
                    {CONFIDENCE_LABEL[finding.confidence] ?? finding.confidence}
                </span>
            </div>

            {/* Explanation grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-4">
                <Section label="Why this happened">{finding.cause}</Section>
                <Section label="How to fix">{finding.remediation}</Section>
                {finding.evidence && (
                    <Section label="Evidence" mono>
                        {finding.evidence}
                    </Section>
                )}
                {payload && (
                    <Section label="Payload sent" mono>
                        {payload}
                    </Section>
                )}
                {responseSnippet && responseSnippet.trim() !== "" && (
                    <Section label="Response body" mono>
                        {responseSnippet}
                    </Section>
                )}
            </div>
        </div>
    );
}

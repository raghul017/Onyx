// =============================================================================
// FindingDetailPanel — the expanded "what / why / cause / evidence / fix" view
// for a single attack result. Light-mono. Shared by the Report and the live
// Dashboard so a finding reads the same everywhere.
// =============================================================================

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import type { FindingDetail } from "@/services/api";
import OwaspBadge from "@/components/OwaspBadge";
import {
    FRAMEWORKS,
    getRemediationSnippet,
    frameworksWithSnippet,
    type Framework,
} from "@/data/remediation";

/** Remembered across findings so the user picks their stack once. */
const FRAMEWORK_STORAGE_KEY = "onyx-remediation-framework";

function loadFramework(): Framework | "generic" {
    try {
        const v = localStorage.getItem(FRAMEWORK_STORAGE_KEY);
        if (v && (v === "generic" || FRAMEWORKS.some((f) => f.id === v))) {
            return v as Framework | "generic";
        }
    } catch {
        /* storage unavailable — fall through to the default */
    }
    return "generic";
}

/**
 * "How to fix" (T15a) — the finding's generic remediation, plus an optional
 * framework-specific snippet from the CURATED library. Generic is the default
 * and is always shown; a snippet is additive. When the chosen framework has no
 * curated cell for this category, we say so rather than guessing.
 */
function RemediationSection({ finding }: { finding: FindingDetail }) {
    const [framework, setFramework] = useState<Framework | "generic">(loadFramework);
    const [copied, setCopied] = useState(false);

    const available = frameworksWithSnippet(finding.category);
    const snippet = getRemediationSnippet(finding.category, framework);

    const choose = (id: Framework | "generic") => {
        setFramework(id);
        try {
            localStorage.setItem(FRAMEWORK_STORAGE_KEY, id);
        } catch {
            /* storage unavailable — selection still applies for this session */
        }
    };

    const copy = async () => {
        if (!snippet) return;
        try {
            await navigator.clipboard.writeText(snippet.code);
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
        } catch {
            /* clipboard unavailable */
        }
    };

    return (
        <div className="min-w-0 lg:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#999]">
                    How to fix
                </p>
                {/* Framework picker — Generic first, then the four stacks. */}
                <div className="flex flex-wrap items-center gap-1">
                    {([{ id: "generic" as const, label: "Generic" }, ...FRAMEWORKS]).map((f) => {
                        const isActive = framework === f.id;
                        const hasSnippet =
                            f.id === "generic" || available.includes(f.id as Framework);
                        return (
                            <button
                                key={f.id}
                                onClick={() => choose(f.id as Framework | "generic")}
                                aria-pressed={isActive}
                                title={
                                    hasSnippet
                                        ? undefined
                                        : "No curated snippet for this finding type"
                                }
                                className={`font-mono text-[10px] uppercase tracking-wide px-1.5 py-0.5 border transition-colors ${
                                    isActive
                                        ? "border-[#3b82f6] text-[#3b82f6] bg-[#eff6ff]"
                                        : hasSnippet
                                          ? "border-[#e6e6e6] text-[#666] hover:border-black hover:text-black"
                                          : "border-[#e6e6e6] text-[#ccc]"
                                }`}
                            >
                                {f.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Generic guidance is ALWAYS shown — the snippet is additive. */}
            <p className="text-[13px] leading-relaxed text-[#333] text-pretty">
                {finding.remediation}
            </p>

            {snippet ? (
                <div className="mt-3">
                    <p className="text-[12.5px] text-[#666] leading-relaxed mb-1.5">
                        {snippet.summary}
                    </p>
                    <div className="relative border border-[#e6e6e6] bg-[#f5f5f5]">
                        <div className="flex items-center justify-between border-b border-[#e6e6e6] bg-white px-3 py-1.5">
                            <span className="font-mono text-[10px] uppercase tracking-wider text-[#999]">
                                {snippet.language}
                            </span>
                            <button
                                onClick={copy}
                                aria-label={copied ? "Copied" : "Copy snippet"}
                                className="flex items-center justify-center w-6 h-6 text-[#999] hover:text-black transition-colors"
                            >
                                {copied ? (
                                    <Check size={13} className="text-[#16a34a]" />
                                ) : (
                                    <Copy size={13} />
                                )}
                            </button>
                        </div>
                        <pre className="font-mono text-[11.5px] leading-[1.7] text-[#334155] p-3 overflow-x-auto">
                            <code>{snippet.code}</code>
                        </pre>
                    </div>
                </div>
            ) : framework !== "generic" ? (
                <p className="mt-2 font-mono text-[10.5px] text-[#999]">
                    No framework-specific snippet — generic guidance shown.
                </p>
            ) : null}
        </div>
    );
}

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
    wide = false,
}: {
    label: string;
    children: React.ReactNode;
    mono?: boolean;
    /** Span both grid columns + allow more height — for multi-request evidence. */
    wide?: boolean;
}) {
    return (
        <div className={`min-w-0${wide ? " lg:col-span-2" : ""}`}>
            <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#999] mb-1">
                {label}
            </p>
            {mono ? (
                <div
                    className={`font-mono text-[11.5px] leading-relaxed text-[#333] bg-white border border-[#e6e6e6] px-2.5 py-2 overflow-auto whitespace-pre-wrap break-words ${
                        wide ? "max-h-72" : "max-h-40"
                    }`}
                >
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
    // T13c: a BOLA finding (API1) compares TWO identities, so its evidence holds
    // both requests — render it wider and tag it so the cross-user nature is clear.
    const isCrossUser = finding.owaspCategory === "API1_BOLA";

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
                {/* OWASP API Top 10 category (T9) — additive context */}
                <OwaspBadge code={finding.owaspCategory} />
                {/* T13c: subtle marker that this finding spans two identities. */}
                {isCrossUser && (
                    <span className="font-mono text-[10px] uppercase tracking-wide text-[#3b82f6] border border-[#93c5fd] px-1.5 py-0.5">
                        Cross-user
                    </span>
                )}
            </div>

            {/* Explanation grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-4">
                <Section label="Why this happened">{finding.cause}</Section>
                <RemediationSection finding={finding} />
                {finding.evidence && (
                    // A cross-user (BOLA) finding's evidence is BOTH requests
                    // side by side, so give it the full width + more height.
                    <Section
                        label={isCrossUser ? "Evidence — both requests" : "Evidence"}
                        mono
                        wide={isCrossUser}
                    >
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

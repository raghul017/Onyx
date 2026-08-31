// =============================================================================
// FindingDetailPanel — the expanded "what / why / cause / evidence / fix" view
// for a single attack result. Light-mono. Shared by the Report and the live
// Dashboard so a finding reads the same everywhere.
// =============================================================================

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Check, Copy, RefreshCw, ShieldCheck, Loader2 } from "lucide-react";
import { rescanFinding, type FindingDetail, type RescanResult } from "@/services/api";
import {
    badgeStateFor,
    badgeStateForOutcome,
    isRescanSupported,
    relativeTime,
    type BadgeState,
} from "@/lib/rescan-state";
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


/**
 * Re-scan control (T15c) — verify whether a finding still reproduces.
 *
 * Rendered only when the caller supplies the run + log ids (the live Dashboard
 * has no persisted run yet, so it simply omits them and this stays hidden).
 * Safety rule: ONLY an explicit "resolved" outcome may show the Resolved badge —
 * "unsupported" and "error" never imply a fix.
 */
function RescanControl({
    testRunId,
    logId,
    attackType,
    resolvedAt,
    lastCheckedAt,
}: {
    testRunId: string;
    logId: string;
    attackType?: string;
    resolvedAt?: string | null;
    lastCheckedAt?: string | null;
}) {
    // Local view of the state so one finding updates without refetching the report.
    const [badge, setBadge] = useState<BadgeState>(() =>
        badgeStateFor({ resolvedAt, lastCheckedAt }),
    );
    const [checkedAt, setCheckedAt] = useState<string | null>(
        resolvedAt ?? lastCheckedAt ?? null,
    );
    const [note, setNote] = useState<string | null>(null);

    const supported = isRescanSupported(attackType);

    const rescan = useMutation({
        mutationFn: (): Promise<RescanResult> => rescanFinding(testRunId, logId),
        onMutate: () => setNote(null),
        onSuccess: (res) => {
            const next = badgeStateForOutcome(res.outcome);
            // "unsupported"/"error" leave the existing badge untouched.
            if (next !== "none") {
                setBadge(next);
                setCheckedAt(res.checkedAt);
            }
            if (res.outcome === "unsupported") {
                setNote("Re-scan isn't supported for this finding type yet.");
            } else if (res.outcome === "error") {
                setNote("Couldn't re-scan just now — please try again.");
            }
        },
        onError: () => setNote("Couldn't re-scan just now — please try again."),
    });

    return (
        <div className="flex flex-wrap items-center gap-2">
            {badge === "resolved" && (
                <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wide px-1.5 py-0.5 border border-[#86efac] text-[#16a34a] bg-[#f0fdf4]">
                    <ShieldCheck size={11} /> Resolved
                    {checkedAt && (
                        <span className="normal-case text-[#16a34a]/70">
                            · {relativeTime(checkedAt)}
                        </span>
                    )}
                </span>
            )}
            {badge === "still_present" && (
                <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wide px-1.5 py-0.5 border border-[#fdba74] text-[#ea580c] bg-[#fff7ed]">
                    Still present
                    {checkedAt && (
                        <span className="normal-case text-[#ea580c]/70">
                            · re-checked {relativeTime(checkedAt)}
                        </span>
                    )}
                </span>
            )}

            {supported ? (
                <button
                    onClick={() => rescan.mutate()}
                    disabled={rescan.isPending}
                    className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wide px-2 py-0.5 border border-[#e6e6e6] text-[#666] hover:border-black hover:text-black transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3b82f6]"
                >
                    {rescan.isPending ? (
                        <Loader2 size={11} className="animate-spin" />
                    ) : (
                        <RefreshCw size={11} />
                    )}
                    {rescan.isPending ? "Checking…" : "Verify fix"}
                </button>
            ) : (
                // BOLA/BFLA need a live second identity — say so instead of
                // offering a button that can only fail.
                <span
                    className="font-mono text-[10px] text-[#999]"
                    title="Cross-identity findings need a live second identity to re-verify"
                >
                    Re-scan not supported for cross-identity findings
                </span>
            )}

            {note && <span className="text-[11px] text-[#999]">{note}</span>}
        </div>
    );
}

export default function FindingDetailPanel({
    finding,
    payload,
    responseSnippet,
    testRunId,
    logId,
    attackType,
    resolvedAt,
    lastCheckedAt,
}: {
    finding: FindingDetail;
    payload?: string;
    responseSnippet?: string;
    /** T15c — supply the run + log ids to enable the re-scan control. Omitted by
     *  the live Dashboard, where the run isn't a persisted report yet. */
    testRunId?: string;
    logId?: string;
    attackType?: string;
    resolvedAt?: string | null;
    lastCheckedAt?: string | null;
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
                {/* T15c — re-scan + resolved/still-present state. */}
                {testRunId && logId && (
                    <RescanControl
                        testRunId={testRunId}
                        logId={logId}
                        attackType={attackType}
                        resolvedAt={resolvedAt}
                        lastCheckedAt={lastCheckedAt}
                    />
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

// =============================================================================
// ShareReportControl (T16b) — the Share affordance on the authed report page.
//
// Creates (or returns) a public read-only link for the run, shows it in a
// copyable field, and can revoke it. Light-mono, inline popover — no new colors,
// radii, or shadows. Uses TanStack Query (the app's data layer) so the status
// query is invalidated after create/revoke and the panel reflects reality.
// =============================================================================
import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Share2, Copy, Check, Link2Off, Loader2, X } from "lucide-react";
import {
    createReportShare,
    getReportShare,
    revokeReportShare,
} from "@/services/api";

export default function ShareReportControl({ testRunId }: { testRunId: string }) {
    const qc = useQueryClient();
    const [open, setOpen] = useState(false);
    const [copied, setCopied] = useState(false);
    const wrapRef = useRef<HTMLDivElement>(null);

    const shareKey = ["report-share", testRunId];

    const { data: status, isLoading } = useQuery({
        queryKey: shareKey,
        queryFn: () => getReportShare(testRunId),
        enabled: open, // only fetch once the panel is opened
    });

    const create = useMutation({
        mutationFn: () => createReportShare(testRunId),
        onSuccess: () => qc.invalidateQueries({ queryKey: shareKey }),
    });

    const revoke = useMutation({
        mutationFn: () => revokeReportShare(testRunId),
        onSuccess: () => qc.invalidateQueries({ queryKey: shareKey }),
    });

    // A freshly-created link is available before the status query refetches.
    const url = status?.url ?? create.data?.url ?? null;
    const isActive = Boolean(status?.shared || create.data?.url);

    // Close on outside click.
    useEffect(() => {
        if (!open) return;
        const onDocClick = (e: MouseEvent) => {
            if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener("mousedown", onDocClick);
        return () => document.removeEventListener("mousedown", onDocClick);
    }, [open]);

    const copy = async () => {
        if (!url) return;
        try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
        } catch {
            /* clipboard unavailable */
        }
    };

    return (
        <div ref={wrapRef} className="relative shrink-0">
            <button
                onClick={() => setOpen((v) => !v)}
                aria-expanded={open}
                aria-haspopup="dialog"
                className="flex items-center gap-1.5 px-4 py-1.5 border border-[#e6e6e6] bg-white text-[12px] font-medium text-[#666] hover:text-black hover:border-black transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3b82f6]"
            >
                <Share2 size={11} /> Share
            </button>

            {open && (
                <div
                    role="dialog"
                    aria-label="Share this report"
                    className="absolute right-0 top-full mt-2 z-50 w-[330px] bg-white border border-[#e6e6e6] p-4"
                >
                    <div className="flex items-center justify-between mb-3">
                        <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#999]">
                            Share report
                        </span>
                        <button
                            onClick={() => setOpen(false)}
                            aria-label="Close"
                            className="text-[#999] hover:text-black transition-colors"
                        >
                            <X size={13} />
                        </button>
                    </div>

                    {isLoading && !create.data ? (
                        <p className="text-[12px] text-[#999] flex items-center gap-2">
                            <Loader2 size={12} className="animate-spin" /> Checking…
                        </p>
                    ) : isActive && url ? (
                        <>
                            <p className="text-[12px] text-[#666] leading-relaxed mb-2">
                                <span className="inline-flex items-center gap-1.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#16a34a]" />
                                    Link active
                                </span>{" "}
                                — anyone with this link can view this report, read-only.
                                No sign-in required.
                            </p>
                            <div className="flex items-stretch border border-[#e6e6e6]">
                                <input
                                    readOnly
                                    value={url}
                                    onFocus={(e) => e.currentTarget.select()}
                                    aria-label="Public report link"
                                    className="flex-1 min-w-0 bg-[#fafafa] font-mono text-[11px] text-[#333] px-2 py-2 outline-none"
                                />
                                <button
                                    onClick={copy}
                                    aria-label={copied ? "Copied" : "Copy link"}
                                    className="px-2.5 border-l border-[#e6e6e6] text-[#666] hover:text-black transition-colors"
                                >
                                    {copied ? (
                                        <Check size={13} className="text-[#16a34a]" />
                                    ) : (
                                        <Copy size={13} />
                                    )}
                                </button>
                            </div>
                            <button
                                onClick={() => revoke.mutate()}
                                disabled={revoke.isPending}
                                className="mt-3 flex items-center gap-1.5 text-[12px] text-[#dc2626] hover:underline disabled:opacity-50"
                            >
                                {revoke.isPending ? (
                                    <Loader2 size={11} className="animate-spin" />
                                ) : (
                                    <Link2Off size={11} />
                                )}
                                Revoke link
                            </button>
                        </>
                    ) : (
                        <>
                            <p className="text-[12px] text-[#666] leading-relaxed mb-3">
                                No link yet. Create one to share this report read-only —
                                viewers won&rsquo;t need an Onyx account.
                            </p>
                            <button
                                onClick={() => create.mutate()}
                                disabled={create.isPending}
                                className="w-full justify-center flex items-center gap-1.5 bg-black text-white text-[12px] font-medium px-4 py-2 hover:bg-[#1a1a1a] transition-colors disabled:opacity-40"
                            >
                                {create.isPending ? (
                                    <Loader2 size={11} className="animate-spin" />
                                ) : (
                                    <Share2 size={11} />
                                )}
                                Create share link
                            </button>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}

// =============================================================================
// History Page — "Execution History"
// =============================================================================

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppHeader from "@/components/AppHeader";
import ColdStartBanner from "@/components/ColdStartBanner";
import { ArrowRight, Trash2, Clock } from "lucide-react";
import {
    getAllTestRuns,
    deleteTestRun,
    getCurrentUser,
    type GetAllTestRunsResponse,
    type ScoreLabel,
    type CurrentUser,
} from "@/services/api";

// Severity-aware score color (matches dashboard/report language).
function scoreColor(score: number) {
    return score <= 25 ? "#ef4444" : score <= 50 ? "#ff810a" : score <= 75 ? "#d8b24a" : "#73bfc4";
}

function scoreChip(score: number, label: ScoreLabel) {
    const c = scoreColor(score);
    return (
        <span
            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-bold font-['JetBrains_Mono'] tabular-nums"
            style={{ color: c, backgroundColor: `${c}1A` }}
        >
            {score}/100
            <span className="text-[9px] font-normal opacity-70">{label}</span>
        </span>
    );
}

const History = () => {
    const navigate = useNavigate();
    const [testRuns, setTestRuns] = useState<
        GetAllTestRunsResponse["testRuns"]
    >([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [user, setUser] = useState<CurrentUser | null>(null);

    useEffect(() => {
        getCurrentUser().then(setUser).catch(() => {});
    }, []);

    const fetchHistory = async () => {
        try {
            setLoading(true);
            const data = await getAllTestRuns();
            setTestRuns(data.testRuns);
        } catch (err: any) {
            setError(err.message || "Failed to load execution history.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchHistory();
    }, []);

    const handleDelete = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (
            !window.confirm(
                "Are you sure you want to permanently delete this test run?",
            )
        ) {
            return;
        }
        try {
            await deleteTestRun(id);
            // Refresh history table
            fetchHistory();
        } catch (err: any) {
            alert(err.message || "Failed to delete test run.");
        }
    };

    // Summary stats for the strip (completed runs only for the average).
    const completedRuns = testRuns.filter((r) => r.status === "COMPLETED");
    const avgScore =
        completedRuns.length > 0
            ? Math.round(completedRuns.reduce((a, r) => a + r.overallScore, 0) / completedRuns.length)
            : null;
    const totalPayloads = testRuns.reduce((a, r) => a + (r.totalAttacks || 0), 0);
    const atRiskRuns = completedRuns.filter((r) => r.overallScore <= 50).length;

    const formatDate = (isoString: string) => {
        const date = new Date(isoString);
        return new Intl.DateTimeFormat("en-US", {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
        }).format(date);
    };

    return (
        <div className="relative min-h-screen bg-[#080808] text-white font-['Inter'] antialiased selection:bg-[#73bfc4]/25 selection:text-black overflow-x-hidden">
            {/* Subtle gradient accent, matches landing/dashboard */}
            <div className="fixed inset-x-0 top-0 h-72 pointer-events-none z-0 c5-animated-gradient opacity-[0.08] blur-3xl" />
            <div className="fixed inset-0 pointer-events-none z-0 bg-gradient-to-b from-transparent via-[#080808] to-[#080808]" />

            <div className="relative z-10 flex flex-col min-h-screen">
                <AppHeader user={user} />
                <ColdStartBanner />

                <main className="w-full px-5 sm:px-8 lg:px-12 flex-1 py-8 sm:py-10">
                    {/* Page Header */}
                    <h1
                        className="text-white mb-2"
                        style={{
                            fontFamily: '"Satoshi Variable", sans-serif',
                            fontWeight: 400,
                            fontSize: "clamp(1.75rem,4vw,2.5rem)",
                            lineHeight: 1.1,
                            letterSpacing: "-0.03em",
                        }}
                    >
                        Execution History
                    </h1>
                    <p className="text-white/50 text-sm mb-6">
                        Review past vulnerability scans and access historical
                        payload data.
                    </p>

                    {/* Summary strip — flat, hairline-divided (mirrors the dashboard) */}
                    {!loading && !error && testRuns.length > 0 && (
                        <div className="mb-6 grid grid-cols-2 md:grid-cols-4 rounded-2xl bg-[#0B0C0D] shadow-[0_0_0_1px_rgba(255,255,255,0.07)] overflow-hidden divide-x divide-white/[0.06]">
                            {[
                                { l: "Total Runs", v: String(testRuns.length), c: "#ffffff" },
                                {
                                    l: "Avg Score",
                                    v: avgScore !== null ? `${avgScore}/100` : "—",
                                    c: avgScore !== null ? scoreColor(avgScore) : "#71717a",
                                },
                                { l: "Payloads Fired", v: totalPayloads.toLocaleString(), c: "#ffffff" },
                                {
                                    l: "At-Risk Runs",
                                    v: String(atRiskRuns),
                                    c: atRiskRuns > 0 ? "#ff810a" : "#71717a",
                                },
                            ].map((s) => (
                                <div key={s.l} className="px-4 sm:px-5 py-3.5">
                                    <div className="text-neutral-600 text-[10px] font-['JetBrains_Mono'] uppercase tracking-[0.15em]">
                                        {s.l}
                                    </div>
                                    <div
                                        className="mt-1.5 font-['JetBrains_Mono'] text-2xl leading-none tabular-nums"
                                        style={{ color: s.c }}
                                    >
                                        {s.v}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Audit Log Table — flat terminal surface */}
                    <div className="w-full bg-[#0B0C0D] shadow-[0_0_0_1px_rgba(255,255,255,0.07)] rounded-2xl overflow-hidden flex flex-col">
                        {/* Table Headers — desktop only */}
                        <div className="hidden md:grid grid-cols-[120px_1fr_120px_160px_100px_110px_120px] gap-4 px-6 py-3 bg-[#080808] border-b border-white/[0.06] text-[10px] text-neutral-600 font-['JetBrains_Mono'] uppercase tracking-[0.15em]">
                            <span>Date</span>
                            <span>Target API</span>
                            <span>Payloads</span>
                            <span>Completed</span>
                            <span>Status</span>
                            <span>Score</span>
                            <span className="text-right">Action</span>
                        </div>

                        {/* Mobile header */}
                        <div className="md:hidden px-4 py-3 bg-[#080808] border-b border-white/[0.06] text-[10px] text-neutral-600 font-['JetBrains_Mono'] uppercase tracking-[0.15em]">
                            Execution History
                        </div>

                        {/* Table Body */}
                        <div className="flex flex-col min-h-[400px]">
                            {loading ? (
                                <div className="flex-1 flex items-center justify-center text-neutral-500 font-mono text-sm">
                                    [ FETCHING_TELEMETRY ]
                                </div>
                            ) : error ? (
                                <div className="flex-1 flex items-center justify-center text-red-500 font-mono text-sm bg-red-500/5">
                                    {error}
                                </div>
                            ) : testRuns.length === 0 ? (
                                <div className="flex-1 flex flex-col items-center justify-center gap-4 py-16 text-center">
                                    <span className="flex items-center justify-center w-12 h-12 rounded-2xl bg-[#73bfc4]/10 shadow-[inset_0_0_0_1px_rgba(115,191,196,0.25)]">
                                        <Clock size={22} className="text-[#73bfc4]" />
                                    </span>
                                    <div>
                                        <p className="text-white text-[15px] font-medium">No scans yet</p>
                                        <p className="mt-1 text-neutral-500 text-[13px]">
                                            Your completed runs and their security scores will appear here.
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => navigate("/dashboard")}
                                        className="mt-1 inline-flex items-center gap-2 rounded-full bg-[#73bfc4] text-black text-[13px] font-semibold px-4 py-2 hover:bg-[#8fd0d4] transition-colors active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#73bfc4]/60"
                                    >
                                        Run your first scan
                                        <ArrowRight size={14} />
                                    </button>
                                </div>
                            ) : (
                                testRuns.map((row) => (
                                    <div key={row.id}>
                                        {/* Desktop row */}
                                        <div className="hidden md:grid grid-cols-[120px_1fr_120px_160px_100px_110px_120px] items-center gap-4 px-6 py-4 border-b border-white/[0.06] last:border-b-0 hover:bg-white/[0.025] transition-colors cursor-pointer group">
                                            <span className="text-sm text-neutral-400 truncate pr-2">
                                                {formatDate(row.createdAt)}
                                            </span>
                                            <span className="text-sm font-['JetBrains_Mono'] text-neutral-300 truncate pr-4">
                                                {row.specUrl}
                                            </span>
                                            <span className="text-sm text-neutral-400">
                                                {row.totalAttacks}
                                            </span>
                                            <span
                                                className={`text-sm font-semibold ${
                                                    row.completedAttacks > 0
                                                        ? "text-[#73bfc4]"
                                                        : "text-neutral-600"
                                                }`}
                                            >
                                                {row.completedAttacks}
                                            </span>
                                            <span
                                                className={`text-sm ${
                                                    row.status === "FAILED" ||
                                                    row.status === "ABORTED"
                                                        ? "text-[#ff810a]"
                                                        : row.status === "COMPLETED"
                                                          ? "text-neutral-400"
                                                          : "text-[#73bfc4]"
                                                }`}
                                            >
                                                {row.status}
                                            </span>
                                            <span>
                                                {row.status === "COMPLETED"
                                                    ? scoreChip(row.overallScore, row.scoreLabel)
                                                    : <span className="text-neutral-700 text-xs font-['JetBrains_Mono']">—</span>}
                                            </span>
                                            <div className="text-right">
                                                <div className="flex items-center justify-end gap-3 w-full">
                                                    <button
                                                        onClick={(e) =>
                                                            handleDelete(
                                                                e,
                                                                row.id,
                                                            )
                                                        }
                                                        className="p-1.5 text-neutral-600 hover:text-red-500 hover:bg-red-500/10 rounded transition-colors"
                                                        title="Delete Record"
                                                    >
                                                        <Trash2 size={15} />
                                                    </button>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            navigate(
                                                                `/report/${row.id}`,
                                                            );
                                                        }}
                                                        className="text-sm text-neutral-500 group-hover:text-white transition-colors flex items-center justify-end gap-1.5"
                                                    >
                                                        View Report
                                                        <ArrowRight
                                                            size={14}
                                                            className="opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all"
                                                        />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Mobile card */}
                                        <div className="md:hidden px-4 py-4 border-b border-white/[0.06] last:border-b-0 hover:bg-white/[0.025] transition-colors space-y-2">
                                            <div className="flex items-start justify-between gap-2">
                                                <span className="text-sm font-['JetBrains_Mono'] text-neutral-300 truncate flex-1 min-w-0">
                                                    {row.specUrl}
                                                </span>
                                                <div className="flex items-center gap-2 shrink-0">
                                                    {row.status === "COMPLETED" && scoreChip(row.overallScore, row.scoreLabel)}
                                                    <span
                                                        className={`text-xs px-2 py-0.5 rounded ${
                                                            row.status === "FAILED" || row.status === "ABORTED"
                                                                ? "text-[#ff810a] bg-[#ff810a]/10"
                                                                : row.status === "COMPLETED"
                                                                  ? "text-neutral-400 bg-white/[0.05]"
                                                                  : "text-[#73bfc4] bg-[#73bfc4]/10"
                                                        }`}
                                                    >
                                                        {row.status}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4 text-xs text-neutral-500">
                                                <span>
                                                    {formatDate(row.createdAt)}
                                                </span>
                                                <span>
                                                    {row.totalAttacks} payloads
                                                </span>
                                                <span
                                                    className={
                                                        row.completedAttacks > 0
                                                            ? "text-[#73bfc4]"
                                                            : ""
                                                    }
                                                >
                                                    {row.completedAttacks}{" "}
                                                    completed
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-3 pt-1">
                                                <button
                                                    onClick={(e) =>
                                                        handleDelete(e, row.id)
                                                    }
                                                    className="p-1.5 text-neutral-600 hover:text-red-500 hover:bg-red-500/10 rounded transition-colors"
                                                    title="Delete Record"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        navigate(
                                                            `/report/${row.id}`,
                                                        );
                                                    }}
                                                    className="text-sm text-[#73bfc4] flex items-center gap-1"
                                                >
                                                    View Report
                                                    <ArrowRight size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
};

export default History;

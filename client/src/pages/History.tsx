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

// Severity-aware score color (light-mono semantics: red → orange → amber → green).
function scoreColor(score: number) {
    return score <= 25 ? "#dc2626" : score <= 50 ? "#ea580c" : score <= 75 ? "#ca8a04" : "#16a34a";
}

function scoreChip(score: number, label: ScoreLabel) {
    const c = scoreColor(score);
    return (
        <span
            className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-bold font-mono tabular-nums border"
            style={{ color: c, backgroundColor: `${c}12`, borderColor: `${c}40` }}
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
        <div className="onyx-mono relative min-h-screen overflow-x-clip">
            <div className="relative z-10 flex flex-col min-h-screen">
                <AppHeader user={user} />
                <ColdStartBanner />

                <main className="w-full px-5 sm:px-8 lg:px-12 flex-1 py-8 sm:py-10">
                    {/* Page Header */}
                    <h1 className="text-[clamp(1.75rem,4vw,2.5rem)] leading-tight font-normal tracking-tight text-balance mb-2">
                        Execution History
                    </h1>
                    <p className="text-[#666] text-sm mb-6">
                        Review past vulnerability scans and access historical
                        payload data.
                    </p>

                    {/* Summary strip — flat, hairline-divided (mirrors the dashboard) */}
                    {!loading && !error && testRuns.length > 0 && (
                        <div className="mb-6 grid grid-cols-2 md:grid-cols-4 border border-[#e6e6e6] bg-white overflow-hidden divide-x divide-[#e6e6e6]">
                            {[
                                { l: "Total Runs", v: String(testRuns.length), c: "#000000" },
                                {
                                    l: "Avg Score",
                                    v: avgScore !== null ? `${avgScore}/100` : "—",
                                    c: avgScore !== null ? scoreColor(avgScore) : "#999999",
                                },
                                { l: "Payloads Fired", v: totalPayloads.toLocaleString(), c: "#000000" },
                                {
                                    l: "At-Risk Runs",
                                    v: String(atRiskRuns),
                                    c: atRiskRuns > 0 ? "#ea580c" : "#999999",
                                },
                            ].map((s) => (
                                <div key={s.l} className="px-4 sm:px-5 py-3.5">
                                    <div className="text-[#999] text-[10px] font-mono uppercase tracking-[0.15em]">
                                        {s.l}
                                    </div>
                                    <div
                                        className="mt-1.5 font-mono text-2xl leading-none tabular-nums"
                                        style={{ color: s.c }}
                                    >
                                        {s.v}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Audit Log Table — flat hairline surface */}
                    <div className="w-full border border-[#e6e6e6] bg-white overflow-hidden flex flex-col">
                        {/* Table Headers — desktop only */}
                        <div className="hidden md:grid grid-cols-[110px_1fr_90px_110px_100px_120px_150px] gap-4 px-6 py-3 bg-[#fafafa] border-b border-[#e6e6e6] text-[10px] text-[#999] font-mono uppercase tracking-[0.15em]">
                            <span>Date</span>
                            <span>Target API</span>
                            <span>Payloads</span>
                            <span>Completed</span>
                            <span>Status</span>
                            <span>Score</span>
                            <span className="text-right">Action</span>
                        </div>

                        {/* Mobile header */}
                        <div className="md:hidden px-4 py-3 bg-[#fafafa] border-b border-[#e6e6e6] text-[10px] text-[#999] font-mono uppercase tracking-[0.15em]">
                            Execution History
                        </div>

                        {/* Table Body */}
                        <div className="flex flex-col min-h-[400px]">
                            {loading ? (
                                <div className="flex-1 flex items-center justify-center text-[#999] font-mono text-sm">
                                    [ FETCHING_TELEMETRY ]
                                </div>
                            ) : error ? (
                                <div className="flex-1 flex items-center justify-center text-[#dc2626] font-mono text-sm bg-[#fef2f2]">
                                    {error}
                                </div>
                            ) : testRuns.length === 0 ? (
                                <div className="flex-1 flex flex-col items-center justify-center gap-4 py-16 text-center">
                                    <span className="flex items-center justify-center w-12 h-12 bg-[#f0f6ff] border border-[#93c5fd]">
                                        <Clock size={22} className="text-[#3b82f6]" />
                                    </span>
                                    <div>
                                        <p className="text-black text-[15px] font-medium">No scans yet</p>
                                        <p className="mt-1 text-[#666] text-[13px]">
                                            Your completed runs and their security scores will appear here.
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => navigate("/dashboard")}
                                        className="mono-btn mt-1"
                                    >
                                        Run your first scan
                                        <ArrowRight size={14} />
                                    </button>
                                </div>
                            ) : (
                                testRuns.map((row) => (
                                    <div key={row.id}>
                                        {/* Desktop row */}
                                        <div className="hidden md:grid grid-cols-[110px_1fr_90px_110px_100px_120px_150px] items-center gap-4 px-6 py-4 border-b border-[#e6e6e6] last:border-b-0 hover:bg-[#f9f9f9] transition-colors cursor-pointer group">
                                            <span className="text-sm text-[#666] truncate pr-2 tabular-nums">
                                                {formatDate(row.createdAt)}
                                            </span>
                                            <span className="text-sm font-mono text-[#333] truncate pr-4">
                                                {row.specUrl}
                                            </span>
                                            <span className="text-sm text-[#666] tabular-nums">
                                                {row.totalAttacks}
                                            </span>
                                            <span
                                                className={`text-sm font-semibold tabular-nums ${
                                                    row.completedAttacks > 0
                                                        ? "text-[#3b82f6]"
                                                        : "text-[#999]"
                                                }`}
                                            >
                                                {row.completedAttacks}
                                            </span>
                                            <span
                                                className={`text-sm ${
                                                    row.status === "FAILED" ||
                                                    row.status === "ABORTED"
                                                        ? "text-[#ea580c]"
                                                        : row.status === "COMPLETED"
                                                          ? "text-[#666]"
                                                          : "text-[#3b82f6]"
                                                }`}
                                            >
                                                {row.status}
                                            </span>
                                            <span>
                                                {row.status === "COMPLETED"
                                                    ? scoreChip(row.overallScore, row.scoreLabel)
                                                    : <span className="text-[#ccc] text-xs font-mono">—</span>}
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
                                                        className="p-1.5 text-[#999] hover:text-[#dc2626] hover:bg-[#fef2f2] transition-colors"
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
                                                        className="text-sm text-[#666] group-hover:text-black transition-colors flex items-center justify-end gap-1.5 whitespace-nowrap"
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
                                        <div className="md:hidden px-4 py-4 border-b border-[#e6e6e6] last:border-b-0 hover:bg-[#f9f9f9] transition-colors space-y-2">
                                            <div className="flex items-start justify-between gap-2">
                                                <span className="text-sm font-mono text-[#333] truncate flex-1 min-w-0">
                                                    {row.specUrl}
                                                </span>
                                                <div className="flex items-center gap-2 shrink-0">
                                                    {row.status === "COMPLETED" && scoreChip(row.overallScore, row.scoreLabel)}
                                                    <span
                                                        className={`text-xs px-2 py-0.5 border ${
                                                            row.status === "FAILED" || row.status === "ABORTED"
                                                                ? "text-[#ea580c] bg-[#fff7ed] border-[#fdba74]"
                                                                : row.status === "COMPLETED"
                                                                  ? "text-[#666] bg-[#fafafa] border-[#e6e6e6]"
                                                                  : "text-[#3b82f6] bg-[#f0f6ff] border-[#93c5fd]"
                                                        }`}
                                                    >
                                                        {row.status}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4 text-xs text-[#666]">
                                                <span className="tabular-nums">
                                                    {formatDate(row.createdAt)}
                                                </span>
                                                <span className="tabular-nums">
                                                    {row.totalAttacks} payloads
                                                </span>
                                                <span
                                                    className={
                                                        row.completedAttacks > 0
                                                            ? "text-[#3b82f6] tabular-nums"
                                                            : "tabular-nums"
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
                                                    className="p-1.5 text-[#999] hover:text-[#dc2626] hover:bg-[#fef2f2] transition-colors"
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
                                                    className="text-sm text-[#3b82f6] hover:text-black transition-colors flex items-center gap-1"
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

// =============================================================================
// Report Page — Static historical test run review
// =============================================================================

import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
    Crosshair,
    AlertTriangle,
    ShieldAlert,
    ShieldCheck,
    Gauge,
    Terminal,
    FileDown,
    Loader2,
} from "lucide-react";
import {
    getTestRun,
    exportTestRunPDF,
    getCurrentUser,
    type GetTestRunResponse,
    type SeverityLevel,
    type CurrentUser,
} from "@/services/api";
import ColdStartBanner from "@/components/ColdStartBanner";
import AppHeader from "@/components/AppHeader";
import GoBackButton from "@/components/GoBackButton";

// ---------------------------------------------------------------------------
// Severity helpers
// ---------------------------------------------------------------------------

// Brand severity palette (shared across dashboard / history / report)
const SEV_COLOR: Record<string, string> = {
    CRITICAL: "#ef4444",
    HIGH: "#ff810a",
    MEDIUM: "#d8b24a",
    LOW: "#73bfc4",
    INFO: "#8da0ce",
};

function severityBadge(severity: SeverityLevel) {
    const c = SEV_COLOR[severity] ?? SEV_COLOR.INFO;
    return (
        <span
            className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold font-['JetBrains_Mono']"
            style={{ color: c, backgroundColor: `${c}1A` }}
        >
            {severity}
        </span>
    );
}

// Score color as a hex (severity-aware): CRITICAL red → CLEAN teal
function scoreHex(score: number): string {
    if (score <= 25) return "#ef4444";
    if (score <= 50) return "#ff810a";
    if (score <= 75) return "#d8b24a";
    return "#73bfc4";
}

function scoreLabelText(label: string): string {
    switch (label) {
        case "CLEAN":    return "CLEAN";
        case "LOW":      return "LOW RISK";
        case "MEDIUM":   return "MEDIUM RISK";
        case "HIGH":     return "HIGH RISK";
        case "CRITICAL": return "CRITICAL RISK";
        default:         return label;
    }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const SEVERITY_FILTERS = ["ALL", "CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"] as const;
type FilterValue = typeof SEVERITY_FILTERS[number];

const Report = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const [data, setData] = useState<GetTestRunResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [exporting, setExporting] = useState(false);
    const [severityFilter, setSeverityFilter] = useState<FilterValue>("ALL");
    const [user, setUser] = useState<CurrentUser | null>(null);

    useEffect(() => {
        getCurrentUser().then(setUser).catch(() => {});
    }, []);

    useEffect(() => {
        if (!id) return;
        const fetchData = async () => {
            try {
                const res = await getTestRun(id);
                setData(res);
            } catch (err: any) {
                setError(err.response?.data?.error || "Failed to load report data");
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [id]);

    const logs = data?.logs || [];
    const summary = data?.summary;

    const completedCount = logs.length;
    const totalPayloads = summary?.totalAttacks || 0;

    const criticalCount = useMemo(
        () => logs.filter((l) => l.statusCode >= 500).length,
        [logs],
    );
    const blockedCount = useMemo(
        () => logs.filter((l) => l.statusCode >= 400 && l.statusCode < 500).length,
        [logs],
    );
    const infoCount = useMemo(
        () => logs.filter((l) => l.statusCode >= 200 && l.statusCode < 300).length,
        [logs],
    );
    const avgLatency = useMemo(() => {
        if (logs.length === 0) return 0;
        return Math.round(logs.reduce((acc, l) => acc + l.responseTime, 0) / logs.length);
    }, [logs]);

    const filteredLogs = useMemo(() => {
        if (severityFilter === "ALL") return logs;
        return logs.filter((l) => l.severity === severityFilter);
    }, [logs, severityFilter]);

    const progressPct =
        totalPayloads > 0 ? Math.min(100, Math.round((completedCount / totalPayloads) * 100)) : 0;

    const statusLabel =
        summary?.status === "COMPLETED"
            ? "SEQUENCE COMPLETE"
            : summary?.status === "FAILED" || summary?.status === "ABORTED"
              ? "SEQUENCE TERMINATED"
              : "UNKNOWN STATUS";

    const breakdown = summary?.severityBreakdown ?? { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    const breakdownTotal = breakdown.critical + breakdown.high + breakdown.medium + breakdown.low + breakdown.info;

    const overallScore = summary?.overallScore ?? 100;
    const scoreLabel = summary?.scoreLabel ?? "CLEAN";

    const getRowClass = (sev: SeverityLevel) => {
        switch (sev) {
            case "CRITICAL": return "bg-red-500/[0.05] border-l-2 border-l-red-500";
            case "HIGH":     return "bg-[#ff810a]/[0.04] border-l-2 border-l-[#ff810a]/60";
            case "MEDIUM":   return "bg-[#d8b24a]/[0.03] border-l-2 border-l-[#d8b24a]/40";
            case "LOW":      return "border-l-2 border-l-[#73bfc4]/25";
            default:         return "";
        }
    };

    const getMethodColor = (method: string) => {
        switch (method) {
            case "GET":    return "text-[#73bfc4]";
            case "POST":   return "text-emerald-400";
            case "PUT":    return "text-[#d8b24a]";
            case "DELETE": return "text-red-400";
            case "PATCH":  return "text-[#a78bfa]";
            default:       return "text-neutral-400";
        }
    };

    const formatTime = (ts: number | string) => {
        const d = new Date(ts);
        return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
    };

    const handleExportPDF = async () => {
        if (!id) return;
        setExporting(true);
        try {
            const result = await exportTestRunPDF(id);
            if (result === "plan_required") navigate("/billing");
        } catch {
            // silent
        } finally {
            setExporting(false);
        }
    };

    return (
        <div className="relative min-h-screen flex flex-col bg-[#080808] text-white font-['Inter'] antialiased selection:bg-[#73bfc4]/25 selection:text-black overflow-x-hidden">
            {/* Subtle gradient accent, matches landing/dashboard */}
            <div className="fixed inset-x-0 top-0 h-72 pointer-events-none z-0 c5-animated-gradient opacity-[0.08] blur-3xl" />
            <div className="fixed inset-0 pointer-events-none z-0 bg-gradient-to-b from-transparent via-[#080808] to-[#080808]" />

            {/* Shared app header */}
            <div className="relative z-30">
                <AppHeader user={user} />
            </div>

            <ColdStartBanner />

            {/* Report sub-bar: back to history · target · status · export */}
            <div className="relative z-10 shrink-0 border-b border-white/[0.06] bg-[#0B0C0D] px-5 sm:px-8 lg:px-12 py-3 flex items-center gap-3">
                <GoBackButton to="/history" label="History" size="sm" className="shrink-0" />
                <div className="hidden md:flex items-center gap-2 flex-1 min-w-0">
                    <Terminal size={12} className="text-neutral-600 shrink-0" />
                    <span className="font-['JetBrains_Mono'] text-[12px] text-neutral-400 truncate">
                        {loading ? "Decrypting logs..." : summary?.specUrl || "Unknown Target"}
                    </span>
                </div>
                <div className="hidden sm:flex items-center gap-2 text-[11px] font-['JetBrains_Mono'] uppercase tracking-wider shrink-0">
                    <span className={`w-2 h-2 rounded-full ${statusLabel === "SEQUENCE COMPLETE" ? "bg-[#73bfc4]" : "bg-red-500"}`} />
                    <span className="text-neutral-500">{statusLabel}</span>
                </div>
                {summary?.status === "COMPLETED" && (
                    <button
                        onClick={handleExportPDF}
                        disabled={exporting}
                        className="flex items-center gap-1.5 px-4 py-1.5 bg-[#73bfc4] text-black text-[12px] font-bold font-['Inter'] rounded-full hover:bg-[#8fd0d4] transition-transform active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#73bfc4]/60"
                    >
                        {exporting ? <Loader2 size={11} className="animate-spin" /> : <FileDown size={11} />}
                        {exporting ? "Exporting..." : "Export PDF"}
                    </button>
                )}
            </div>

            {/* 2. Telemetry Row */}
            <div className="relative z-10 shrink-0 grid grid-cols-2 lg:grid-cols-4 divide-x divide-white/[0.06] border-b border-white/[0.06]">
                <div className="bg-[#0B0C0D] p-4 sm:p-5 flex flex-col min-h-[96px] relative overflow-hidden">
                    <div className="flex items-center gap-2 text-neutral-600 text-[10px] font-['JetBrains_Mono'] uppercase tracking-[0.15em]">
                        <Crosshair size={11} /> Payloads Fired
                    </div>
                    <div className="mt-auto flex items-baseline gap-1">
                        <span className="text-3xl font-['JetBrains_Mono'] text-white tabular-nums">{completedCount}</span>
                        {totalPayloads > 0 && <span className="text-sm font-['JetBrains_Mono'] text-neutral-600">/ {totalPayloads}</span>}
                    </div>
                    {totalPayloads > 0 && (
                        <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-white/[0.05]">
                            <motion.div
                                className="h-full bg-[#73bfc4] opacity-70"
                                initial={{ width: 0 }}
                                animate={{ width: `${progressPct}%` }}
                                transition={{ duration: 0.5, ease: "easeOut" }}
                            />
                        </div>
                    )}
                </div>

                <div className="bg-[#0B0C0D] p-4 sm:p-5 flex flex-col min-h-[96px]">
                    <div className="flex items-center gap-2 text-neutral-600 text-[10px] font-['JetBrains_Mono'] uppercase tracking-[0.15em]">
                        <AlertTriangle size={11} className="text-red-500" /> Critical Failures
                    </div>
                    <div className="mt-auto flex items-baseline gap-2">
                        <span className="text-3xl font-['JetBrains_Mono'] text-red-500 font-bold tabular-nums">{criticalCount}</span>
                        {criticalCount > 0 && (
                            <span className="text-[10px] font-['JetBrains_Mono'] text-red-500/80 uppercase tracking-wider animate-pulse">VULN DETECTED</span>
                        )}
                    </div>
                </div>

                <div className="bg-[#0B0C0D] p-4 sm:p-5 flex flex-col min-h-[96px]">
                    <div className="flex items-center gap-2 text-neutral-600 text-[10px] font-['JetBrains_Mono'] uppercase tracking-[0.15em]">
                        <ShieldAlert size={11} className="text-orange-500" /> Payloads Blocked
                    </div>
                    <div className="mt-auto">
                        <span className="text-3xl font-['JetBrains_Mono'] tabular-nums text-[#ff810a]">{blockedCount}</span>
                    </div>
                </div>

                <div className="bg-[#0B0C0D] p-4 sm:p-5 flex flex-col min-h-[96px]">
                    <div className="flex items-center gap-2 text-neutral-600 text-[10px] font-['JetBrains_Mono'] uppercase tracking-[0.15em]">
                        <ShieldCheck size={11} className="text-neutral-500" /> Info / Passed
                    </div>
                    <div className="mt-auto">
                        <span className="text-3xl font-['JetBrains_Mono'] text-neutral-500 tabular-nums">{infoCount}</span>
                    </div>
                </div>
            </div>

            {/* 3. Score + Breakdown Bar */}
            {!loading && summary && (
                <div className={`relative z-10 shrink-0 border-b border-white/[0.06] px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center gap-4 bg-[#080808]`}>
                    {/* Score pill */}
                    <div
                        className="flex items-baseline gap-1.5 px-4 py-2.5 rounded-xl"
                        style={{ backgroundColor: `${scoreHex(overallScore)}14`, boxShadow: `inset 0 0 0 1px ${scoreHex(overallScore)}33` }}
                    >
                        <span className="text-4xl font-bold font-['JetBrains_Mono'] tabular-nums" style={{ color: scoreHex(overallScore) }}>
                            {overallScore}
                        </span>
                        <span className="text-neutral-500 text-lg font-['JetBrains_Mono']">/100</span>
                        <div className="ml-2 flex flex-col justify-center">
                            <Gauge size={14} style={{ color: scoreHex(overallScore) }} />
                        </div>
                        <div className="ml-1 flex flex-col">
                            <span className="text-[9px] font-bold font-['JetBrains_Mono'] uppercase tracking-widest" style={{ color: scoreHex(overallScore) }}>
                                {scoreLabelText(scoreLabel)}
                            </span>
                            <span className="text-[9px] text-neutral-600 font-['JetBrains_Mono'] uppercase tracking-wider">Security Score</span>
                        </div>
                    </div>

                    {/* Breakdown bar + counts */}
                    <div className="flex-1 flex flex-col gap-2 min-w-0">
                        {(() => {
                            const segs = [
                                { key: "critical", label: "critical", n: breakdown.critical, c: "#ef4444" },
                                { key: "high", label: "high", n: breakdown.high, c: "#ff810a" },
                                { key: "medium", label: "medium", n: breakdown.medium, c: "#d8b24a" },
                                { key: "low", label: "low", n: breakdown.low, c: "#73bfc4" },
                                { key: "info", label: "info", n: breakdown.info, c: "#8da0ce" },
                            ];
                            return (
                                <>
                                    {breakdownTotal > 0 && (
                                        <div className="flex h-2 rounded-full overflow-hidden gap-px w-full">
                                            {segs.map((s) => s.n > 0 ? (
                                                <div key={s.key} style={{ backgroundColor: s.c, width: `${(s.n / breakdownTotal) * 100}%` }} />
                                            ) : null)}
                                        </div>
                                    )}
                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-['JetBrains_Mono'] text-[11px]">
                                        {segs.map((s) => (
                                            <span key={s.key} className="flex items-center gap-1.5">
                                                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.c, opacity: s.n ? 1 : 0.35 }} />
                                                <span className="text-neutral-400"><span className="tabular-nums">{s.n}</span> {s.label}</span>
                                            </span>
                                        ))}
                                        <span className="hidden sm:block text-neutral-600 ml-auto text-[10px] tabular-nums">avg {avgLatency}ms</span>
                                    </div>
                                </>
                            );
                        })()}
                    </div>
                </div>
            )}

            {/* 4. Attack Log Table */}
            <div className="relative z-10 flex-1 flex flex-col overflow-hidden">
                {/* Filter buttons + column headers */}
                <div className="shrink-0 bg-[#080808] border-b border-white/[0.06]">
                    {/* Filter row */}
                    <div className="flex items-center gap-1 px-4 sm:px-6 py-2 border-b border-white/[0.06] overflow-x-auto">
                        <span className="text-[10px] font-['JetBrains_Mono'] text-neutral-600 uppercase tracking-wider mr-2 shrink-0">Filter:</span>
                        {SEVERITY_FILTERS.map((f) => {
                            const on = severityFilter === f;
                            const n =
                                f === "ALL" ? logs.length :
                                f === "CRITICAL" ? breakdown.critical :
                                f === "HIGH" ? breakdown.high :
                                f === "MEDIUM" ? breakdown.medium :
                                f === "LOW" ? breakdown.low : breakdown.info;
                            const dot = f === "ALL" ? undefined : SEV_COLOR[f];
                            return (
                                <button
                                    key={f}
                                    onClick={() => setSeverityFilter(f)}
                                    className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold font-['JetBrains_Mono'] uppercase tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#73bfc4]/60 ${
                                        on ? "bg-white/[0.08] text-white" : "text-neutral-500 hover:text-neutral-300"
                                    }`}
                                >
                                    {dot && <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: dot, opacity: n ? 1 : 0.35 }} />}
                                    {f} <span className="tabular-nums text-neutral-600">({n})</span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Column headers — desktop */}
                    <div className="hidden md:grid grid-cols-[72px_60px_1fr_100px_60px_72px_1.2fr] gap-0 px-4 sm:px-6 py-2.5 font-['JetBrains_Mono'] text-[10px] text-neutral-600 uppercase tracking-[0.15em]">
                        <span>Time</span>
                        <span>Method</span>
                        <span>Endpoint</span>
                        <span>Severity</span>
                        <span>Status</span>
                        <span>Latency</span>
                        <span>Payload</span>
                    </div>
                    <div className="md:hidden px-4 py-2.5 font-['JetBrains_Mono'] text-[10px] text-neutral-600 uppercase tracking-[0.15em]">
                        Attack Log Archive
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto bg-[#0B0C0D]">
                    {error && (
                        <div className="mx-4 sm:mx-6 mt-3 px-3 py-2.5 border border-red-500/30 bg-red-500/5 text-red-400 text-[11px] font-['JetBrains_Mono'] flex items-center gap-2 rounded-sm">
                            <AlertTriangle size={12} className="shrink-0" />
                            {error}
                        </div>
                    )}

                    {!loading && filteredLogs.length === 0 && !error && (
                        <div className="flex flex-col items-center justify-center h-52 text-neutral-700 font-['JetBrains_Mono'] text-xs gap-3">
                            <Terminal size={20} className="text-neutral-800" />
                            <span>{severityFilter === "ALL" ? "No logs recorded for this operation." : `No ${severityFilter} severity findings.`}</span>
                        </div>
                    )}

                    <AnimatePresence initial={false}>
                        {filteredLogs.map((log) => {
                            const payloadStr =
                                typeof log.payload === "string" ? log.payload : JSON.stringify(log.payload);

                            return (
                                <motion.div
                                    key={log.id}
                                    initial={{ opacity: 0, y: -16, height: 0 }}
                                    animate={{ opacity: 1, y: 0, height: "auto" }}
                                    exit={{ opacity: 0 }}
                                    transition={{ duration: 0.18, ease: "easeOut" }}
                                    className={getRowClass(log.severity)}
                                >
                                    {/* Desktop row */}
                                    <div className="hidden md:grid grid-cols-[72px_60px_1fr_100px_60px_72px_1.2fr] gap-0 px-4 sm:px-6 py-2 border-b border-white/[0.06] font-['JetBrains_Mono'] text-[12px] items-center hover:bg-white/[0.025] transition-colors">
                                        <span className="text-neutral-600 text-[11px] tabular-nums">
                                            {formatTime(log.timestamp)}
                                        </span>
                                        <span className={`text-[11px] font-semibold ${getMethodColor(log.method)}`}>
                                            {log.method}
                                        </span>
                                        <span className={`truncate pr-3 ${log.severity === "CRITICAL" || log.severity === "HIGH" ? "text-white" : "text-neutral-300"}`}>
                                            {log.endpoint}
                                        </span>
                                        <span className="flex items-center">
                                            {severityBadge(log.severity)}
                                        </span>
                                        <span className="text-neutral-500 tabular-nums">
                                            {log.statusCode || "ERR"}
                                        </span>
                                        <span className="text-neutral-500 text-[11px] tabular-nums">
                                            {log.responseTime}<span className="text-neutral-700">ms</span>
                                        </span>
                                        <span className="text-neutral-500 text-[11px] truncate" title={payloadStr}>
                                            {payloadStr}
                                        </span>
                                    </div>

                                    {/* Mobile card */}
                                    <div className="md:hidden px-4 py-3 border-b border-white/[0.06] font-['JetBrains_Mono'] text-[12px] hover:bg-white/[0.025] transition-colors space-y-1.5">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <span className={`text-[11px] font-semibold ${getMethodColor(log.method)}`}>{log.method}</span>
                                                <span className="text-neutral-500 tabular-nums text-[11px]">{log.statusCode || "ERR"}</span>
                                                {severityBadge(log.severity)}
                                            </div>
                                            <div className="flex items-center gap-2 text-neutral-600 text-[10px]">
                                                <span className="tabular-nums">{log.responseTime}ms</span>
                                                <span className="tabular-nums">{formatTime(log.timestamp)}</span>
                                            </div>
                                        </div>
                                        <div className={`text-[11px] truncate ${log.severity === "CRITICAL" || log.severity === "HIGH" ? "text-white" : "text-neutral-400"}`}>
                                            {log.endpoint}
                                        </div>
                                        <div className="text-neutral-600 text-[10px] truncate" title={payloadStr}>
                                            {payloadStr}
                                        </div>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>
                </div>

                <div className="shrink-0 h-7 bg-[#080808] border-t border-white/[0.06] flex items-center justify-between px-4 sm:px-6 font-['JetBrains_Mono'] text-[10px] text-neutral-600">
                    <span>
                        {filteredLogs.length} / {totalPayloads || "—"} results
                        {severityFilter !== "ALL" && <span className="text-neutral-500 ml-1">(filtered: {severityFilter})</span>}
                        {breakdown.critical > 0 && <span className="text-red-500/80 ml-2">● {breakdown.critical} critical</span>}
                        {breakdown.high > 0 && <span className="text-orange-500/80 ml-2">● {breakdown.high} high</span>}
                    </span>
                    <span className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-neutral-600" />
                        Log Terminal Immutable
                    </span>
                </div>
            </div>
        </div>
    );
};

export default Report;

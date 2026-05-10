// =============================================================================
// Report Page — Static historical test run review
// =============================================================================

import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
    Shield,
    ArrowLeft,
    Crosshair,
    AlertTriangle,
    ShieldAlert,
    ShieldCheck,
    Gauge,
    Radio,
    Terminal,
    FileDown,
    Loader2,
} from "lucide-react";
import {
    getTestRun,
    exportTestRunPDF,
    type GetTestRunResponse,
    type SeverityLevel,
} from "@/services/api";
import ColdStartBanner from "@/components/ColdStartBanner";

// ---------------------------------------------------------------------------
// Severity helpers
// ---------------------------------------------------------------------------

function severityBadge(severity: SeverityLevel) {
    switch (severity) {
        case "CRITICAL":
            return (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded-sm text-[10px] font-bold font-['JetBrains_Mono'] bg-red-500/20 text-red-400 border border-red-500/30">
                    CRITICAL
                </span>
            );
        case "HIGH":
            return (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded-sm text-[10px] font-bold font-['JetBrains_Mono'] bg-orange-500/20 text-orange-400 border border-orange-500/30">
                    HIGH
                </span>
            );
        case "MEDIUM":
            return (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded-sm text-[10px] font-bold font-['JetBrains_Mono'] bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                    MEDIUM
                </span>
            );
        case "LOW":
            return (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded-sm text-[10px] font-bold font-['JetBrains_Mono'] bg-blue-500/20 text-blue-400 border border-blue-500/30">
                    LOW
                </span>
            );
        default:
            return (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded-sm text-[10px] font-bold font-['JetBrains_Mono'] bg-neutral-800 text-neutral-500">
                    INFO
                </span>
            );
    }
}

function scoreColor(score: number): string {
    if (score <= 25) return "text-red-500";
    if (score <= 50) return "text-orange-500";
    if (score <= 75) return "text-yellow-400";
    return "text-emerald-500";
}

function scoreBgColor(score: number): string {
    if (score <= 25) return "bg-red-500/10 border-red-500/20";
    if (score <= 50) return "bg-orange-500/10 border-orange-500/20";
    if (score <= 75) return "bg-yellow-500/10 border-yellow-500/20";
    return "bg-emerald-500/10 border-emerald-500/20";
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
            case "CRITICAL": return "bg-red-500/[0.06] border-l-2 border-l-red-500";
            case "HIGH":     return "bg-orange-500/[0.04] border-l-2 border-l-orange-500/50";
            case "MEDIUM":   return "bg-yellow-500/[0.03] border-l-2 border-l-yellow-500/30";
            case "LOW":      return "bg-blue-500/[0.02] border-l-2 border-l-blue-500/20";
            default:         return "bg-neutral-500/[0.02]";
        }
    };

    const getMethodColor = (method: string) => {
        switch (method) {
            case "GET":    return "text-cyan-400";
            case "POST":   return "text-emerald-400";
            case "PUT":    return "text-yellow-400";
            case "DELETE": return "text-red-400";
            case "PATCH":  return "text-purple-400";
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
        <div className="h-screen flex flex-col bg-black text-white font-['Inter'] selection:bg-cyan-500/20 overflow-x-hidden">
            {/* 1. Header */}
            <header className="h-14 shrink-0 border-b border-neutral-800 bg-[#0A0A0A] flex items-center justify-between px-4 sm:px-6 gap-3">
                <div className="flex items-center gap-3 shrink-0">
                    <button
                        onClick={() => navigate("/history")}
                        className="text-neutral-600 hover:text-white transition-colors cursor-pointer p-1"
                        title="Back to History"
                    >
                        <ArrowLeft size={16} />
                    </button>
                    <div className="w-px h-5 bg-neutral-800" />
                    <div className="flex items-center gap-2">
                        <Shield size={16} className="text-white" />
                        <span className="text-white text-sm font-semibold tracking-tight">Onyx Report</span>
                    </div>
                    <div className="w-px h-4 bg-neutral-800 mx-1 hidden sm:block" />
                    <div className="hidden sm:flex items-center gap-4">
                        <button onClick={() => navigate("/dashboard")} className="text-neutral-500 hover:text-white text-[13px] font-medium transition-colors">
                            Dashboard
                        </button>
                        <button onClick={() => navigate("/history")} className="text-neutral-500 hover:text-white text-[13px] font-medium transition-colors">
                            History
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-2 flex-1 max-w-2xl mx-4">
                    <Terminal size={12} className="text-neutral-600 shrink-0" />
                    <div className="flex-1 bg-[#111] border border-neutral-800 text-neutral-400 font-['JetBrains_Mono'] text-[12px] px-3 py-1.5 transition-colors rounded-sm flex items-center">
                        {loading ? "Decrypting logs..." : summary?.specUrl || "Unknown Target"}
                    </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                    <div className="flex items-center gap-2 text-[11px] font-['JetBrains_Mono'] uppercase tracking-wider">
                        <span className={`w-2 h-2 rounded-full ${statusLabel === "SEQUENCE COMPLETE" ? "bg-neutral-500" : "bg-red-500"}`} />
                        <span className="text-neutral-500">{statusLabel}</span>
                    </div>
                    {summary?.status === "COMPLETED" && (
                        <button
                            onClick={handleExportPDF}
                            disabled={exporting}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-black text-[11px] font-bold font-['Inter'] rounded-sm hover:bg-neutral-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            {exporting ? <Loader2 size={11} className="animate-spin" /> : <FileDown size={11} />}
                            {exporting ? "Exporting..." : "Export PDF"}
                        </button>
                    )}
                </div>
            </header>

            <ColdStartBanner />

            {/* 2. Telemetry Row */}
            <div className="shrink-0 grid grid-cols-2 lg:grid-cols-4 gap-px bg-neutral-800 border-b border-neutral-800">
                <div className="bg-[#0A0A0A] p-4 sm:p-5 flex flex-col min-h-[96px] relative overflow-hidden">
                    <div className="flex items-center gap-2 text-neutral-600 text-[10px] font-['JetBrains_Mono'] uppercase tracking-[0.15em]">
                        <Crosshair size={11} /> Payloads Fired
                    </div>
                    <div className="mt-auto flex items-baseline gap-1">
                        <span className="text-3xl font-['JetBrains_Mono'] text-white tabular-nums">{completedCount}</span>
                        {totalPayloads > 0 && <span className="text-sm font-['JetBrains_Mono'] text-neutral-600">/ {totalPayloads}</span>}
                    </div>
                    {totalPayloads > 0 && (
                        <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-neutral-900">
                            <motion.div
                                className="h-full bg-cyan-400 opacity-50 shadow-[0_0_6px_rgba(34,211,238,0.4)]"
                                initial={{ width: 0 }}
                                animate={{ width: `${progressPct}%` }}
                                transition={{ duration: 0.5, ease: "easeOut" }}
                            />
                        </div>
                    )}
                </div>

                <div className="bg-[#0A0A0A] p-4 sm:p-5 flex flex-col min-h-[96px]">
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

                <div className="bg-[#0A0A0A] p-4 sm:p-5 flex flex-col min-h-[96px]">
                    <div className="flex items-center gap-2 text-neutral-600 text-[10px] font-['JetBrains_Mono'] uppercase tracking-[0.15em]">
                        <ShieldAlert size={11} className="text-orange-500" /> Payloads Blocked
                    </div>
                    <div className="mt-auto">
                        <span className="text-3xl font-['JetBrains_Mono'] tabular-nums text-yellow-500">{blockedCount}</span>
                    </div>
                </div>

                <div className="bg-[#0A0A0A] p-4 sm:p-5 flex flex-col min-h-[96px]">
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
                <div className={`shrink-0 border-b border-neutral-800 px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center gap-4 bg-[#080808]`}>
                    {/* Score pill */}
                    <div className={`flex items-baseline gap-1.5 px-4 py-2.5 border rounded-sm ${scoreBgColor(overallScore)}`}>
                        <span className={`text-4xl font-bold font-['JetBrains_Mono'] tabular-nums ${scoreColor(overallScore)}`}>
                            {overallScore}
                        </span>
                        <span className="text-neutral-500 text-lg font-['JetBrains_Mono']">/100</span>
                        <div className="ml-2 flex flex-col justify-center">
                            <Gauge size={14} className={scoreColor(overallScore)} />
                        </div>
                        <div className="ml-1 flex flex-col">
                            <span className={`text-[9px] font-bold font-['JetBrains_Mono'] uppercase tracking-widest ${scoreColor(overallScore)}`}>
                                {scoreLabelText(scoreLabel)}
                            </span>
                            <span className="text-[9px] text-neutral-600 font-['JetBrains_Mono'] uppercase tracking-wider">Security Score</span>
                        </div>
                    </div>

                    {/* Breakdown bar + counts */}
                    <div className="flex-1 flex flex-col gap-2 min-w-0">
                        {/* Stacked bar */}
                        {breakdownTotal > 0 && (
                            <div className="flex h-2 rounded-full overflow-hidden gap-px w-full">
                                {breakdown.critical > 0 && (
                                    <div className="bg-red-500" style={{ width: `${(breakdown.critical / breakdownTotal) * 100}%` }} />
                                )}
                                {breakdown.high > 0 && (
                                    <div className="bg-orange-500" style={{ width: `${(breakdown.high / breakdownTotal) * 100}%` }} />
                                )}
                                {breakdown.medium > 0 && (
                                    <div className="bg-yellow-400" style={{ width: `${(breakdown.medium / breakdownTotal) * 100}%` }} />
                                )}
                                {breakdown.low > 0 && (
                                    <div className="bg-blue-500" style={{ width: `${(breakdown.low / breakdownTotal) * 100}%` }} />
                                )}
                                {breakdown.info > 0 && (
                                    <div className="bg-neutral-600" style={{ width: `${(breakdown.info / breakdownTotal) * 100}%` }} />
                                )}
                            </div>
                        )}
                        {/* Counts */}
                        <div className="flex items-center gap-4 font-['JetBrains_Mono'] text-[11px]">
                            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500 shrink-0" /><span className="text-neutral-400">{breakdown.critical} critical</span></span>
                            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-orange-500 shrink-0" /><span className="text-neutral-400">{breakdown.high} high</span></span>
                            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-yellow-400 shrink-0" /><span className="text-neutral-400">{breakdown.medium} medium</span></span>
                            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" /><span className="text-neutral-400">{breakdown.low} low</span></span>
                            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-neutral-600 shrink-0" /><span className="text-neutral-500">{breakdown.info} info</span></span>
                            <span className="hidden sm:block text-neutral-600 ml-auto text-[10px]">avg {avgLatency}ms</span>
                        </div>
                    </div>
                </div>
            )}

            {/* 4. Attack Log Table */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Filter buttons + column headers */}
                <div className="shrink-0 bg-[#050505] border-b border-neutral-800">
                    {/* Filter row */}
                    <div className="flex items-center gap-1 px-4 sm:px-6 py-2 border-b border-neutral-800/60 overflow-x-auto">
                        <span className="text-[10px] font-['JetBrains_Mono'] text-neutral-600 uppercase tracking-wider mr-2 shrink-0">Filter:</span>
                        {SEVERITY_FILTERS.map((f) => (
                            <button
                                key={f}
                                onClick={() => setSeverityFilter(f)}
                                className={`px-2.5 py-0.5 rounded-sm text-[10px] font-bold font-['JetBrains_Mono'] uppercase tracking-wide transition-colors shrink-0 ${
                                    severityFilter === f
                                        ? f === "ALL"
                                            ? "bg-neutral-700 text-white"
                                            : f === "CRITICAL"
                                              ? "bg-red-500/30 text-red-300 border border-red-500/40"
                                              : f === "HIGH"
                                                ? "bg-orange-500/30 text-orange-300 border border-orange-500/40"
                                                : f === "MEDIUM"
                                                  ? "bg-yellow-500/30 text-yellow-300 border border-yellow-500/40"
                                                  : f === "LOW"
                                                    ? "bg-blue-500/30 text-blue-300 border border-blue-500/40"
                                                    : "bg-neutral-700 text-neutral-300 border border-neutral-600"
                                        : "text-neutral-600 hover:text-neutral-400 hover:bg-neutral-800/50"
                                }`}
                            >
                                {f === "ALL" ? `All (${logs.length})` : `${f} (${
                                    f === "CRITICAL" ? breakdown.critical :
                                    f === "HIGH"     ? breakdown.high :
                                    f === "MEDIUM"   ? breakdown.medium :
                                    f === "LOW"      ? breakdown.low :
                                                       breakdown.info
                                })`}
                            </button>
                        ))}
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

                <div className="flex-1 overflow-y-auto bg-[#0A0A0A]">
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
                                    <div className="hidden md:grid grid-cols-[72px_60px_1fr_100px_60px_72px_1.2fr] gap-0 px-4 sm:px-6 py-2 border-b border-neutral-800/40 font-['JetBrains_Mono'] text-[12px] items-center hover:bg-white/[0.015] transition-colors">
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
                                    <div className="md:hidden px-4 py-3 border-b border-neutral-800/40 font-['JetBrains_Mono'] text-[12px] hover:bg-white/[0.015] transition-colors space-y-1.5">
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

                <div className="shrink-0 h-7 bg-[#050505] border-t border-neutral-800 flex items-center justify-between px-4 sm:px-6 font-['JetBrains_Mono'] text-[10px] text-neutral-600">
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

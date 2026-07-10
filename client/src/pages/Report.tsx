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

// Light-mono severity palette (shared language: red → orange → amber → blue → slate)
const SEV_COLOR: Record<string, string> = {
    CRITICAL: "#dc2626",
    HIGH: "#ea580c",
    MEDIUM: "#ca8a04",
    LOW: "#3b82f6",
    INFO: "#64748b",
};

function severityBadge(severity: SeverityLevel) {
    const c = SEV_COLOR[severity] ?? SEV_COLOR.INFO;
    return (
        <span
            className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-bold font-mono border"
            style={{ color: c, backgroundColor: `${c}12`, borderColor: `${c}40` }}
        >
            {severity}
        </span>
    );
}

// Score color as a hex (severity-aware): CRITICAL red → CLEAN green
function scoreHex(score: number): string {
    if (score <= 25) return "#dc2626";
    if (score <= 50) return "#ea580c";
    if (score <= 75) return "#ca8a04";
    return "#16a34a";
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
            case "CRITICAL": return "bg-[#fef2f2] border-l-2 border-l-[#dc2626]";
            case "HIGH":     return "bg-[#fff7ed] border-l-2 border-l-[#ea580c]";
            case "MEDIUM":   return "bg-[#fefce8] border-l-2 border-l-[#ca8a04]";
            case "LOW":      return "border-l-2 border-l-[#93c5fd]";
            default:         return "border-l-2 border-l-transparent";
        }
    };

    const getMethodColor = (method: string) => {
        switch (method) {
            case "GET":    return "text-[#3b82f6]";
            case "POST":   return "text-[#16a34a]";
            case "PUT":    return "text-[#ca8a04]";
            case "DELETE": return "text-[#dc2626]";
            case "PATCH":  return "text-[#7c3aed]";
            default:       return "text-[#666]";
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
        <div className="onyx-mono relative min-h-screen flex flex-col overflow-x-clip">
            {/* Shared app header */}
            <div className="relative z-30">
                <AppHeader user={user} />
            </div>

            <ColdStartBanner />

            {/* Report sub-bar: back to history · target · status · export */}
            <div className="relative z-10 shrink-0 border-b border-[#e6e6e6] bg-white px-5 sm:px-8 lg:px-12 py-3 flex items-center gap-3">
                <GoBackButton to="/history" label="History" size="sm" className="shrink-0" />
                <span className="hidden md:block w-px h-4 bg-[#e6e6e6] shrink-0" aria-hidden="true" />
                <div className="hidden md:flex items-center gap-2 flex-1 min-w-0">
                    <Terminal size={12} className="text-[#999] shrink-0" />
                    <span className="font-mono text-[12px] text-[#666] truncate">
                        {loading ? "Decrypting logs..." : summary?.specUrl || "Unknown Target"}
                    </span>
                </div>
                <div className="hidden sm:flex items-center gap-2 text-[11px] font-mono uppercase tracking-wider shrink-0">
                    <span className={`w-2 h-2 rounded-full ${statusLabel === "SEQUENCE COMPLETE" ? "bg-[#16a34a]" : "bg-[#dc2626]"}`} />
                    <span className="text-[#999]">{statusLabel}</span>
                </div>
                {summary?.status === "COMPLETED" && (
                    <button
                        onClick={handleExportPDF}
                        disabled={exporting}
                        className="flex items-center gap-1.5 px-4 py-1.5 bg-black text-white text-[12px] font-medium hover:bg-[#1a1a1a] transition-[background-color,transform] active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3b82f6]"
                    >
                        {exporting ? <Loader2 size={11} className="animate-spin" /> : <FileDown size={11} />}
                        {exporting ? "Exporting..." : "Export PDF"}
                    </button>
                )}
            </div>

            {/* 2. Telemetry Row */}
            <div className="relative z-10 shrink-0 grid grid-cols-2 lg:grid-cols-4 divide-x divide-[#e6e6e6] border-b border-[#e6e6e6] bg-white">
                <div className="p-4 sm:p-5 flex flex-col min-h-[96px] relative overflow-hidden">
                    <div className="flex items-center gap-2 text-[#999] text-[10px] font-mono uppercase tracking-[0.15em]">
                        <Crosshair size={11} /> Payloads Fired
                    </div>
                    <div className="mt-auto flex items-baseline gap-1">
                        <span className="text-3xl font-mono text-black tabular-nums">{completedCount}</span>
                        {totalPayloads > 0 && <span className="text-sm font-mono text-[#999]">/ {totalPayloads}</span>}
                    </div>
                    {totalPayloads > 0 && (
                        <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#e6e6e6]">
                            <motion.div
                                className="h-full bg-[#3b82f6]"
                                initial={{ width: 0 }}
                                animate={{ width: `${progressPct}%` }}
                                transition={{ duration: 0.5, ease: "easeOut" }}
                            />
                        </div>
                    )}
                </div>

                <div className="p-4 sm:p-5 flex flex-col min-h-[96px]">
                    <div className="flex items-center gap-2 text-[#999] text-[10px] font-mono uppercase tracking-[0.15em]">
                        <AlertTriangle size={11} className="text-[#dc2626]" /> Critical Failures
                    </div>
                    <div className="mt-auto flex items-baseline gap-2">
                        <span className="text-3xl font-mono text-[#dc2626] font-bold tabular-nums">{criticalCount}</span>
                        {criticalCount > 0 && (
                            <span className="text-[10px] font-mono text-[#dc2626] uppercase tracking-wider animate-pulse">VULN DETECTED</span>
                        )}
                    </div>
                </div>

                <div className="p-4 sm:p-5 flex flex-col min-h-[96px]">
                    <div className="flex items-center gap-2 text-[#999] text-[10px] font-mono uppercase tracking-[0.15em]">
                        <ShieldAlert size={11} className="text-[#ea580c]" /> Payloads Blocked
                    </div>
                    <div className="mt-auto">
                        <span className="text-3xl font-mono tabular-nums text-[#ea580c]">{blockedCount}</span>
                    </div>
                </div>

                <div className="p-4 sm:p-5 flex flex-col min-h-[96px]">
                    <div className="flex items-center gap-2 text-[#999] text-[10px] font-mono uppercase tracking-[0.15em]">
                        <ShieldCheck size={11} className="text-[#16a34a]" /> Info / Passed
                    </div>
                    <div className="mt-auto">
                        <span className="text-3xl font-mono text-[#16a34a] tabular-nums">{infoCount}</span>
                    </div>
                </div>
            </div>

            {/* 3. Score + Breakdown Bar */}
            {!loading && summary && (
                <div className="relative z-10 shrink-0 border-b border-[#e6e6e6] px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center gap-4 bg-[#fafafa]">
                    {/* Score pill */}
                    <div
                        className="flex items-baseline gap-1.5 px-4 py-2.5 bg-white border"
                        style={{ backgroundColor: `${scoreHex(overallScore)}0f`, borderColor: `${scoreHex(overallScore)}40` }}
                    >
                        <span className="text-4xl font-bold font-mono tabular-nums" style={{ color: scoreHex(overallScore) }}>
                            {overallScore}
                        </span>
                        <span className="text-[#999] text-lg font-mono">/100</span>
                        <div className="ml-2 flex flex-col justify-center">
                            <Gauge size={14} style={{ color: scoreHex(overallScore) }} />
                        </div>
                        <div className="ml-1 flex flex-col">
                            <span className="text-[9px] font-bold font-mono uppercase tracking-widest" style={{ color: scoreHex(overallScore) }}>
                                {scoreLabelText(scoreLabel)}
                            </span>
                            <span className="text-[9px] text-[#999] font-mono uppercase tracking-wider">Security Score</span>
                        </div>
                    </div>

                    {/* Breakdown bar + counts */}
                    <div className="flex-1 flex flex-col gap-2 min-w-0">
                        {(() => {
                            const segs = [
                                { key: "critical", label: "critical", n: breakdown.critical, c: "#dc2626" },
                                { key: "high", label: "high", n: breakdown.high, c: "#ea580c" },
                                { key: "medium", label: "medium", n: breakdown.medium, c: "#ca8a04" },
                                { key: "low", label: "low", n: breakdown.low, c: "#3b82f6" },
                                { key: "info", label: "info", n: breakdown.info, c: "#64748b" },
                            ];
                            return (
                                <>
                                    {breakdownTotal > 0 && (
                                        <div className="flex h-2 overflow-hidden gap-px w-full bg-[#f0f0f0]">
                                            {segs.map((s) => s.n > 0 ? (
                                                <div key={s.key} style={{ backgroundColor: s.c, width: `${(s.n / breakdownTotal) * 100}%` }} />
                                            ) : null)}
                                        </div>
                                    )}
                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px]">
                                        {segs.map((s) => (
                                            <span key={s.key} className="flex items-center gap-1.5">
                                                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.c, opacity: s.n ? 1 : 0.3 }} />
                                                <span className="text-[#666]"><span className="tabular-nums">{s.n}</span> {s.label}</span>
                                            </span>
                                        ))}
                                        <span className="hidden sm:block text-[#999] ml-auto text-[10px] tabular-nums">avg {avgLatency}ms</span>
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
                <div className="shrink-0 bg-white border-b border-[#e6e6e6]">
                    {/* Filter row */}
                    <div className="flex items-center gap-1 px-4 sm:px-6 py-2 border-b border-[#e6e6e6] overflow-x-auto">
                        <span className="text-[10px] font-mono text-[#999] uppercase tracking-wider mr-2 shrink-0">Filter:</span>
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
                                    className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold font-mono uppercase tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#3b82f6]/60 ${
                                        on ? "bg-black text-white" : "text-[#666] hover:bg-[#f0f0f0]"
                                    }`}
                                >
                                    {dot && <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: dot, opacity: n ? 1 : 0.35 }} />}
                                    {f} <span className={`tabular-nums ${on ? "text-white/60" : "text-[#999]"}`}>({n})</span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Column headers — desktop */}
                    <div className="hidden md:grid grid-cols-[72px_60px_1fr_100px_60px_72px_1.2fr] gap-0 px-4 sm:px-6 py-2.5 font-mono text-[10px] text-[#999] uppercase tracking-[0.15em]">
                        <span>Time</span>
                        <span>Method</span>
                        <span>Endpoint</span>
                        <span>Severity</span>
                        <span>Status</span>
                        <span>Latency</span>
                        <span>Payload</span>
                    </div>
                    <div className="md:hidden px-4 py-2.5 font-mono text-[10px] text-[#999] uppercase tracking-[0.15em]">
                        Attack Log Archive
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto bg-white">
                    {error && (
                        <div className="mx-4 sm:mx-6 mt-3 px-3 py-2.5 border border-[#fca5a5] bg-[#fef2f2] text-[#dc2626] text-[11px] font-mono flex items-center gap-2">
                            <AlertTriangle size={12} className="shrink-0" />
                            {error}
                        </div>
                    )}

                    {!loading && filteredLogs.length === 0 && !error && (
                        <div className="flex flex-col items-center justify-center h-52 text-[#999] font-mono text-xs gap-3">
                            <Terminal size={20} className="text-[#ccc]" />
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
                                    <div className="hidden md:grid grid-cols-[72px_60px_1fr_100px_60px_72px_1.2fr] gap-0 px-4 sm:px-6 py-2 border-b border-[#e6e6e6] font-mono text-[12px] items-center hover:bg-black/[0.02] transition-colors">
                                        <span className="text-[#999] text-[11px] tabular-nums">
                                            {formatTime(log.timestamp)}
                                        </span>
                                        <span className={`text-[11px] font-semibold ${getMethodColor(log.method)}`}>
                                            {log.method}
                                        </span>
                                        <span className={`truncate pr-3 ${log.severity === "CRITICAL" || log.severity === "HIGH" ? "text-black" : "text-[#333]"}`}>
                                            {log.endpoint}
                                        </span>
                                        <span className="flex items-center">
                                            {severityBadge(log.severity)}
                                        </span>
                                        <span className="text-[#666] tabular-nums">
                                            {log.statusCode || "ERR"}
                                        </span>
                                        <span className="text-[#666] text-[11px] tabular-nums">
                                            {log.responseTime}<span className="text-[#ccc]">ms</span>
                                        </span>
                                        <span className="text-[#999] text-[11px] truncate" title={payloadStr}>
                                            {payloadStr}
                                        </span>
                                    </div>

                                    {/* Mobile card */}
                                    <div className="md:hidden px-4 py-3 border-b border-[#e6e6e6] font-mono text-[12px] hover:bg-black/[0.02] transition-colors space-y-1.5">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <span className={`text-[11px] font-semibold ${getMethodColor(log.method)}`}>{log.method}</span>
                                                <span className="text-[#666] tabular-nums text-[11px]">{log.statusCode || "ERR"}</span>
                                                {severityBadge(log.severity)}
                                            </div>
                                            <div className="flex items-center gap-2 text-[#999] text-[10px]">
                                                <span className="tabular-nums">{log.responseTime}ms</span>
                                                <span className="tabular-nums">{formatTime(log.timestamp)}</span>
                                            </div>
                                        </div>
                                        <div className={`text-[11px] truncate ${log.severity === "CRITICAL" || log.severity === "HIGH" ? "text-black" : "text-[#666]"}`}>
                                            {log.endpoint}
                                        </div>
                                        <div className="text-[#999] text-[10px] truncate" title={payloadStr}>
                                            {payloadStr}
                                        </div>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>
                </div>

                <div className="shrink-0 h-7 bg-[#fafafa] border-t border-[#e6e6e6] flex items-center justify-between px-4 sm:px-6 font-mono text-[10px] text-[#999]">
                    <span>
                        {filteredLogs.length} / {totalPayloads || "—"} results
                        {severityFilter !== "ALL" && <span className="text-[#666] ml-1">(filtered: {severityFilter})</span>}
                        {breakdown.critical > 0 && <span className="text-[#dc2626] ml-2">● {breakdown.critical} critical</span>}
                        {breakdown.high > 0 && <span className="text-[#ea580c] ml-2">● {breakdown.high} high</span>}
                    </span>
                    <span className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#ccc]" />
                        Log Terminal Immutable
                    </span>
                </div>
            </div>
        </div>
    );
};

export default Report;

// =============================================================================
// Report Page — Static historical test run review
// High-Density Enterprise UI — Pure black + charcoal panels
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
} from "lucide-react";
import { getTestRun, GetTestRunResponse } from "@/services/api";
import ColdStartBanner from "@/components/ColdStartBanner";

const Report = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const [data, setData] = useState<GetTestRunResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Fetch the test run on mount
    useEffect(() => {
        if (!id) return;

        const fetchData = async () => {
            try {
                const res = await getTestRun(id);
                setData(res);
            } catch (err: any) {
                setError(
                    err.response?.data?.error || "Failed to load report data",
                );
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
        () =>
            logs.filter((l) => l.statusCode >= 400 && l.statusCode < 500)
                .length,
        [logs],
    );

    const infoCount = useMemo(
        () =>
            logs.filter((l) => l.statusCode >= 200 && l.statusCode < 300)
                .length,
        [logs],
    );

    const avgLatency = useMemo(() => {
        if (logs.length === 0) return 0;
        const sum = logs.reduce((acc, l) => acc + l.responseTime, 0);
        return Math.round(sum / logs.length);
    }, [logs]);

    const progressPct =
        totalPayloads > 0
            ? Math.min(100, Math.round((completedCount / totalPayloads) * 100))
            : 0;

    const statusLabel =
        summary?.status === "COMPLETED"
            ? "SEQUENCE COMPLETE"
            : summary?.status === "FAILED" || summary?.status === "ABORTED"
              ? "SEQUENCE TERMINATED"
              : "UNKNOWN STATUS";

    const getRowClass = (code: number) => {
        if (code >= 500) return "bg-red-500/[0.06] border-l-2 border-l-red-500";
        if (code >= 400)
            return "bg-orange-500/[0.04] border-l-2 border-l-orange-500/50";
        if (code >= 200 && code < 300) return "bg-neutral-500/[0.02]";
        return "";
    };

    const getStatusBadge = (code: number) => {
        if (code >= 500)
            return (
                <span className="text-red-500 font-bold drop-shadow-[0_0_8px_rgba(239,68,68,0.8)]">
                    [CRITICAL]
                </span>
            );
        if (code >= 400)
            return (
                <span className="text-orange-500 font-bold drop-shadow-[0_0_6px_rgba(249,115,22,0.6)]">
                    [WARNING]
                </span>
            );
        if (code >= 200 && code < 300)
            return (
                <span className="text-neutral-500 font-semibold">[INFO]</span>
            );
        return (
            <span className="text-neutral-600 font-semibold">[UNKNOWN]</span>
        );
    };

    const getMethodColor = (method: string) => {
        switch (method) {
            case "GET":
                return "text-cyan-400";
            case "POST":
                return "text-emerald-400";
            case "PUT":
                return "text-yellow-400";
            case "DELETE":
                return "text-red-400";
            case "PATCH":
                return "text-purple-400";
            default:
                return "text-neutral-400";
        }
    };

    const formatTime = (ts: number | string) => {
        const d = new Date(ts);
        return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
    };

    return (
        <div className="h-screen flex flex-col bg-black text-white font-['Inter'] selection:bg-cyan-500/20 overflow-x-hidden">
            {/* 1. Control Header */}
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
                        <span className="text-white text-sm font-semibold tracking-tight">
                            Onyx Report
                        </span>
                    </div>
                    <div className="w-px h-4 bg-neutral-800 mx-1 hidden sm:block" />
                    <div className="hidden sm:flex items-center gap-4">
                        <button
                            onClick={() => navigate("/dashboard")}
                            className="text-neutral-500 hover:text-white text-[13px] font-medium transition-colors"
                        >
                            Dashboard
                        </button>
                        <button
                            onClick={() => navigate("/history")}
                            className="text-neutral-500 hover:text-white text-[13px] font-medium transition-colors"
                        >
                            History
                        </button>
                    </div>
                </div>

                {/* Center — Target Readout */}
                <div className="flex items-center gap-2 flex-1 max-w-2xl mx-4">
                    <Terminal size={12} className="text-neutral-600 shrink-0" />
                    <div className="flex-1 bg-[#111] border border-neutral-800 text-neutral-400 font-['JetBrains_Mono'] text-[12px] px-3 py-1.5 focus:border-neutral-600 transition-colors rounded-sm flex items-center">
                        {loading
                            ? "Decrypting logs..."
                            : summary?.specUrl || "Unknown Target"}
                    </div>
                </div>

                {/* Right — Status Badge */}
                <div className="flex items-center gap-2 text-[11px] font-['JetBrains_Mono'] uppercase tracking-wider shrink-0">
                    <span
                        className={`w-2 h-2 rounded-full ${
                            statusLabel === "SEQUENCE COMPLETE"
                                ? "bg-neutral-500"
                                : "bg-red-500"
                        }`}
                    />
                    <span className="text-neutral-500">{statusLabel}</span>
                </div>
            </header>

            <ColdStartBanner />

            {/* 2. Telemetry Row */}
            <div className="shrink-0 grid grid-cols-2 lg:grid-cols-4 gap-px bg-neutral-800 border-b border-neutral-800">
                <div className="bg-[#0A0A0A] p-4 sm:p-5 flex flex-col min-h-[96px] relative overflow-hidden">
                    <div className="flex items-center gap-2 text-neutral-600 text-[10px] font-['JetBrains_Mono'] uppercase tracking-[0.15em]">
                        <Crosshair size={11} />
                        Payloads Fired
                    </div>
                    <div className="mt-auto flex items-baseline gap-1">
                        <span className="text-3xl font-['JetBrains_Mono'] text-white tabular-nums">
                            {completedCount}
                        </span>
                        {totalPayloads > 0 && (
                            <span className="text-sm font-['JetBrains_Mono'] text-neutral-600">
                                / {totalPayloads}
                            </span>
                        )}
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

                <div className="bg-[#0A0A0A] p-4 sm:p-5 flex flex-col min-h-[96px] relative overflow-hidden">
                    <div className="flex items-center gap-2 text-neutral-600 text-[10px] font-['JetBrains_Mono'] uppercase tracking-[0.15em]">
                        <AlertTriangle size={11} className="text-red-500" />
                        Critical Failures
                    </div>
                    <div className="mt-auto flex items-baseline gap-2">
                        <span className="text-3xl font-['JetBrains_Mono'] text-red-500 font-bold tabular-nums">
                            {criticalCount}
                        </span>
                        {criticalCount > 0 && (
                            <span className="text-[10px] font-['JetBrains_Mono'] text-red-500/80 uppercase tracking-wider animate-pulse">
                                VULN DETECTED
                            </span>
                        )}
                    </div>
                </div>

                <div className="bg-[#0A0A0A] p-4 sm:p-5 flex flex-col min-h-[96px]">
                    <div className="flex items-center gap-2 text-neutral-600 text-[10px] font-['JetBrains_Mono'] uppercase tracking-[0.15em]">
                        <ShieldAlert size={11} className="text-orange-500" />
                        Payloads Blocked
                    </div>
                    <div className="mt-auto flex items-baseline gap-2">
                        <span className="text-3xl font-['JetBrains_Mono'] tabular-nums text-yellow-500">
                            {blockedCount}
                        </span>
                    </div>
                </div>

                <div className="bg-[#0A0A0A] p-4 sm:p-5 flex flex-col min-h-[96px]">
                    <div className="flex items-center gap-2 text-neutral-600 text-[10px] font-['JetBrains_Mono'] uppercase tracking-[0.15em]">
                        <ShieldCheck size={11} className="text-neutral-500" />
                        Info / Passed
                    </div>
                    <div className="mt-auto flex items-baseline">
                        <span className="text-3xl font-['JetBrains_Mono'] text-neutral-500 tabular-nums">
                            {infoCount}
                        </span>
                    </div>
                </div>

                <div className="bg-[#0A0A0A] p-4 sm:p-5 flex flex-col min-h-[96px]">
                    <div className="flex items-center gap-2 text-neutral-600 text-[10px] font-['JetBrains_Mono'] uppercase tracking-[0.15em]">
                        <Radio size={11} />
                        Archive Status
                    </div>
                    <div className="mt-auto flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        <span className="text-lg font-['JetBrains_Mono'] text-emerald-500">
                            VERIFIED
                        </span>
                    </div>
                </div>
            </div>

            {/* 3. Static Attack Stream */}
            <div className="flex-1 flex flex-col overflow-hidden">
                <div className="shrink-0 hidden md:grid grid-cols-[72px_60px_1fr_90px_60px_72px_1.2fr] gap-0 px-4 sm:px-6 py-2.5 bg-[#050505] border-b border-neutral-800 font-['JetBrains_Mono'] text-[10px] text-neutral-600 uppercase tracking-[0.15em]">
                    <span>Time</span>
                    <span>Method</span>
                    <span>Endpoint</span>
                    <span>Severity</span>
                    <span>Status</span>
                    <span>Latency</span>
                    <span>Payload</span>
                </div>

                <div className="shrink-0 md:hidden px-4 py-2.5 bg-[#050505] border-b border-neutral-800 font-['JetBrains_Mono'] text-[10px] text-neutral-600 uppercase tracking-[0.15em]">
                    Attack Log Archive
                </div>

                <div className="flex-1 overflow-y-auto bg-[#0A0A0A]">
                    {error && (
                        <div className="mx-4 sm:mx-6 mt-3 px-3 py-2.5 border border-red-500/30 bg-red-500/5 text-red-400 text-[11px] font-['JetBrains_Mono'] flex items-center gap-2 rounded-sm">
                            <AlertTriangle size={12} className="shrink-0" />
                            {error}
                        </div>
                    )}

                    {!loading && logs.length === 0 && !error && (
                        <div className="flex flex-col items-center justify-center h-52 text-neutral-700 font-['JetBrains_Mono'] text-xs gap-3">
                            <Terminal size={20} className="text-neutral-800" />
                            <span>
                                No logs recorded for this operation sequence.
                            </span>
                        </div>
                    )}

                    <AnimatePresence initial={false}>
                        {logs.map((log) => {
                            const payloadStr =
                                typeof log.payload === "string"
                                    ? log.payload
                                    : JSON.stringify(log.payload);

                            const isCritical = log.statusCode >= 400;

                            return (
                                <motion.div
                                    key={log.id}
                                    initial={{ opacity: 0, y: -16, height: 0 }}
                                    animate={{
                                        opacity: 1,
                                        y: 0,
                                        height: "auto",
                                    }}
                                    exit={{ opacity: 0 }}
                                    transition={{
                                        duration: 0.18,
                                        ease: "easeOut",
                                    }}
                                    className={`${getRowClass(log.statusCode)}`}
                                >
                                    {/* Desktop row */}
                                    <div className="hidden md:grid grid-cols-[72px_60px_1fr_90px_60px_72px_1.2fr] gap-0 px-4 sm:px-6 py-2 border-b border-neutral-800/40 font-['JetBrains_Mono'] text-[12px] items-center hover:bg-white/[0.015] transition-colors">
                                        <span className="text-neutral-600 text-[11px] tabular-nums">
                                            {formatTime(log.timestamp)}
                                        </span>
                                        <span
                                            className={`text-[11px] font-semibold ${getMethodColor(log.method)}`}
                                        >
                                            {log.method}
                                        </span>
                                        <span
                                            className={`truncate pr-3 ${isCritical ? "text-white" : "text-neutral-300"}`}
                                        >
                                            {log.endpoint}
                                        </span>
                                        <span className="flex items-center text-[11px] tracking-wide">
                                            {getStatusBadge(log.statusCode)}
                                        </span>
                                        <span className="text-neutral-500 tabular-nums">
                                            {log.statusCode || "ERR"}
                                        </span>
                                        <span className="text-neutral-500 text-[11px] tabular-nums">
                                            {log.responseTime}
                                            <span className="text-neutral-700">
                                                ms
                                            </span>
                                        </span>
                                        <span
                                            className="text-neutral-500 text-[11px] truncate"
                                            title={payloadStr}
                                        >
                                            {payloadStr}
                                        </span>
                                    </div>

                                    {/* Mobile card */}
                                    <div className="md:hidden px-4 py-3 border-b border-neutral-800/40 font-['JetBrains_Mono'] text-[12px] hover:bg-white/[0.015] transition-colors space-y-1.5">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <span
                                                    className={`text-[11px] font-semibold ${getMethodColor(log.method)}`}
                                                >
                                                    {log.method}
                                                </span>
                                                <span className="text-neutral-500 tabular-nums text-[11px]">
                                                    {log.statusCode || "ERR"}
                                                </span>
                                                <span className="text-[11px] tracking-wide">
                                                    {getStatusBadge(
                                                        log.statusCode,
                                                    )}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2 text-neutral-600 text-[10px]">
                                                <span className="tabular-nums">
                                                    {log.responseTime}ms
                                                </span>
                                                <span className="tabular-nums">
                                                    {formatTime(log.timestamp)}
                                                </span>
                                            </div>
                                        </div>
                                        <div
                                            className={`text-[11px] truncate ${isCritical ? "text-white" : "text-neutral-400"}`}
                                        >
                                            {log.endpoint}
                                        </div>
                                        <div
                                            className="text-neutral-600 text-[10px] truncate"
                                            title={payloadStr}
                                        >
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
                        {completedCount} / {totalPayloads || "—"} results
                        {criticalCount > 0 && (
                            <span className="text-red-500/80 ml-2">
                                ● {criticalCount} critical
                            </span>
                        )}
                        {blockedCount > 0 && (
                            <span className="text-orange-500/80 ml-2">
                                ● {blockedCount} blocked
                            </span>
                        )}
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

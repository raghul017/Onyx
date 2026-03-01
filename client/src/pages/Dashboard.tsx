// =============================================================================
// Dashboard — "Onyx Command Center"
// =============================================================================

import { useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
    Shield,
    ArrowLeft,
    Crosshair,
    AlertTriangle,
    Gauge,
    Radio,
} from "lucide-react";
import { useAttackStore } from "@/store/useAttackStore";
import { createTestRun } from "@/services/api";

const Dashboard = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const targetUrl = location.state?.targetUrl || "";

    const {
        logs,
        status,
        connectionStatus,
        error,
        connectWebSocket,
        disconnectWebSocket,
    } = useAttackStore();

    // -- Launch test run & connect WS on mount ------------------------------
    useEffect(() => {
        if (!targetUrl) return;

        let cancelled = false;

        (async () => {
            try {
                const res = await createTestRun(targetUrl);
                if (!cancelled) {
                    connectWebSocket(res.testRunId);
                }
            } catch (err) {
                console.error("[Dashboard] Failed to create test run:", err);
            }
        })();

        return () => {
            cancelled = true;
            disconnectWebSocket();
        };
    }, [targetUrl]);

    // -- Computed metrics ---------------------------------------------------
    const totalPayloads = logs.length;

    const criticalFailures = useMemo(
        () => logs.filter((l) => l.statusCode >= 500).length,
        [logs],
    );

    const avgLatency = useMemo(() => {
        if (logs.length === 0) return 0;
        const sum = logs.reduce((acc, l) => acc + l.latencyMs, 0);
        return Math.round(sum / logs.length);
    }, [logs]);

    // -- Helpers ------------------------------------------------------------
    const statusLabel =
        status === "attacking"
            ? "ATTACK IN PROGRESS"
            : status === "completed"
              ? "SEQUENCE COMPLETE"
              : "STANDING BY";

    const queueLabel =
        connectionStatus === "connected"
            ? "LIVE"
            : connectionStatus === "connecting"
              ? "CONNECTING..."
              : "OFFLINE";

    const getRowColor = (code: number) => {
        if (code >= 500) return "text-red-500 font-bold";
        if (code >= 400) return "text-yellow-500";
        return "text-neutral-500";
    };

    const getMethodColor = (method: string) => {
        switch (method) {
            case "GET":
                return "text-cyan-400";
            case "POST":
                return "text-green-400";
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

    // =======================================================================
    // Render
    // =======================================================================
    return (
        <div className="h-screen flex flex-col bg-black text-white font-['Inter']">
            {/* ============================================================= */}
            {/* 1. Control Header                                             */}
            {/* ============================================================= */}
            <header className="h-14 shrink-0 border-b border-neutral-800 bg-[#0A0A0A] flex items-center justify-between px-6">
                {/* Left — Logo & Back */}
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate("/")}
                        className="text-neutral-600 hover:text-white transition-colors cursor-pointer"
                    >
                        <ArrowLeft size={16} />
                    </button>
                    <div className="flex items-center gap-2">
                        <Shield size={18} className="text-white" />
                        <span className="text-white text-sm font-semibold tracking-tight">
                            Onyx
                        </span>
                    </div>
                </div>

                {/* Center — Target URL */}
                <div className="hidden sm:flex items-center gap-2 font-['JetBrains_Mono'] text-xs text-neutral-500">
                    <span className="text-neutral-600">Target:</span>
                    <span className="text-neutral-300 bg-black/60 px-2 py-0.5 border border-neutral-800 truncate max-w-[300px] lg:max-w-md">
                        {targetUrl || "—"}
                    </span>
                </div>

                {/* Right — Status Badge */}
                <div className="flex items-center gap-2 text-xs font-['JetBrains_Mono']">
                    <span
                        className={`w-2 h-2 rounded-full ${
                            status === "attacking"
                                ? "bg-cyan-400 animate-pulse shadow-[0_0_6px_rgba(34,211,238,0.6)]"
                                : status === "completed"
                                  ? "bg-neutral-500"
                                  : "bg-neutral-700"
                        }`}
                    />
                    <span
                        className={
                            status === "attacking"
                                ? "text-cyan-400"
                                : "text-neutral-500"
                        }
                    >
                        {statusLabel}
                    </span>
                </div>
            </header>

            {/* ============================================================= */}
            {/* 2. Telemetry Row                                              */}
            {/* ============================================================= */}
            <div className="shrink-0 grid grid-cols-2 lg:grid-cols-4 gap-px bg-neutral-800 border-b border-neutral-800">
                {/* Card 1: Total Payloads */}
                <div className="bg-[#0A0A0A] p-5 flex flex-col justify-between min-h-[100px]">
                    <div className="flex items-center gap-2 text-neutral-600 text-[11px] font-['JetBrains_Mono'] uppercase tracking-widest">
                        <Crosshair size={12} />
                        Payloads Fired
                    </div>
                    <div className="text-3xl font-['JetBrains_Mono'] text-white mt-2">
                        {totalPayloads}
                    </div>
                </div>

                {/* Card 2: Critical Failures */}
                <div className="bg-[#0A0A0A] p-5 flex flex-col justify-between min-h-[100px]">
                    <div className="flex items-center gap-2 text-neutral-600 text-[11px] font-['JetBrains_Mono'] uppercase tracking-widest">
                        <AlertTriangle size={12} />
                        Critical Failures
                    </div>
                    <div className="text-3xl font-['JetBrains_Mono'] text-red-500 mt-2">
                        {criticalFailures}
                        {criticalFailures > 0 && (
                            <span className="ml-2 text-xs text-red-500/60 font-normal">
                                VULN
                            </span>
                        )}
                    </div>
                </div>

                {/* Card 3: Avg Latency */}
                <div className="bg-[#0A0A0A] p-5 flex flex-col justify-between min-h-[100px]">
                    <div className="flex items-center gap-2 text-neutral-600 text-[11px] font-['JetBrains_Mono'] uppercase tracking-widest">
                        <Gauge size={12} />
                        Avg Latency
                    </div>
                    <div className="text-3xl font-['JetBrains_Mono'] text-cyan-400 mt-2">
                        {avgLatency}
                        <span className="text-base text-neutral-600 ml-1">
                            ms
                        </span>
                    </div>
                </div>

                {/* Card 4: Queue Status */}
                <div className="bg-[#0A0A0A] p-5 flex flex-col justify-between min-h-[100px]">
                    <div className="flex items-center gap-2 text-neutral-600 text-[11px] font-['JetBrains_Mono'] uppercase tracking-widest">
                        <Radio size={12} />
                        Queue Status
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                        <span
                            className={`w-2 h-2 rounded-full ${
                                connectionStatus === "connected"
                                    ? "bg-emerald-400 animate-pulse"
                                    : connectionStatus === "connecting"
                                      ? "bg-yellow-400 animate-pulse"
                                      : "bg-neutral-600"
                            }`}
                        />
                        <span className="text-xl font-['JetBrains_Mono'] text-white">
                            {queueLabel}
                        </span>
                    </div>
                </div>
            </div>

            {/* ============================================================= */}
            {/* 3. Live Attack Stream                                         */}
            {/* ============================================================= */}
            <div className="flex-1 flex flex-col overflow-hidden bg-[#0A0A0A] border-t border-neutral-800">
                {/* Table Header */}
                <div className="shrink-0 grid grid-cols-[80px_70px_1fr_80px_80px_1fr] gap-0 px-6 py-3 bg-black/60 border-b border-neutral-800 font-['JetBrains_Mono'] text-[11px] text-neutral-600 uppercase tracking-widest">
                    <span>Time</span>
                    <span>Method</span>
                    <span>Endpoint</span>
                    <span>Status</span>
                    <span>Latency</span>
                    <span>Payload</span>
                </div>

                {/* Table Body */}
                <div className="flex-1 overflow-y-auto">
                    {error && (
                        <div className="mx-6 mt-4 px-4 py-3 border border-red-500/30 bg-red-500/5 text-red-400 text-xs font-['JetBrains_Mono']">
                            <AlertTriangle size={12} className="inline mr-2" />
                            {error}
                        </div>
                    )}

                    {logs.length === 0 && !error && (
                        <div className="flex items-center justify-center h-48 text-neutral-700 font-['JetBrains_Mono'] text-sm">
                            {status === "attacking" ? (
                                <span className="flex items-center gap-3">
                                    <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                                    Waiting for attack results...
                                </span>
                            ) : (
                                "No attack data"
                            )}
                        </div>
                    )}

                    <AnimatePresence initial={false}>
                        {logs.map((log) => {
                            const ts = new Date(log.timestamp);
                            const timeStr = `${String(ts.getHours()).padStart(2, "0")}:${String(ts.getMinutes()).padStart(2, "0")}:${String(ts.getSeconds()).padStart(2, "0")}`;
                            const payloadStr =
                                typeof log.payload === "string"
                                    ? log.payload
                                    : JSON.stringify(log.payload);

                            return (
                                <motion.div
                                    key={log.id}
                                    initial={{ opacity: 0, y: -20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ duration: 0.15 }}
                                    className={`grid grid-cols-[80px_70px_1fr_80px_80px_1fr] gap-0 px-6 py-2.5 border-b border-neutral-800/50 font-['JetBrains_Mono'] text-[13px] hover:bg-white/[0.02] transition-colors ${
                                        log.statusCode >= 500
                                            ? "bg-red-500/[0.04]"
                                            : ""
                                    }`}
                                >
                                    {/* Time */}
                                    <span className="text-neutral-600 text-xs">
                                        {timeStr}
                                    </span>

                                    {/* Method */}
                                    <span
                                        className={`text-xs font-semibold ${getMethodColor(log.method)}`}
                                    >
                                        {log.method}
                                    </span>

                                    {/* Endpoint */}
                                    <span
                                        className={`truncate pr-4 ${
                                            log.statusCode >= 500
                                                ? "text-white"
                                                : "text-neutral-300"
                                        }`}
                                    >
                                        {log.endpoint}
                                    </span>

                                    {/* Status Code */}
                                    <span
                                        className={getRowColor(log.statusCode)}
                                    >
                                        {log.statusCode}
                                    </span>

                                    {/* Latency */}
                                    <span className="text-neutral-500 text-xs">
                                        {log.latencyMs}ms
                                    </span>

                                    {/* Payload */}
                                    <span
                                        className="text-neutral-500 text-xs truncate"
                                        title={payloadStr}
                                    >
                                        {payloadStr}
                                    </span>
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;

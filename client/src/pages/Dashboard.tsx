// =============================================================================
// Dashboard — "Onyx Command Center"
// High-Density Enterprise UI — Pure black + charcoal panels
// =============================================================================

import { useState, useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
    Shield,
    ArrowLeft,
    Crosshair,
    AlertTriangle,
    ShieldAlert,
    ShieldCheck,
    Radio,
    Terminal,
    Play,
    Square,
} from "lucide-react";
import { useAttackStore } from "@/store/useAttackStore";
import { createTestRun, abortTestRun } from "@/services/api";
import ColdStartBanner from "@/components/ColdStartBanner";

// =============================================================================
// Component
// =============================================================================

const Dashboard = () => {
    const location = useLocation();
    const navigate = useNavigate();

    // The URL may come from the landing page via router state
    const initialUrl = location.state?.targetUrl || "";

    // Local input state
    const [inputUrl, setInputUrl] = useState(initialUrl);
    const [launching, setLaunching] = useState(false);
    const [aborting, setAborting] = useState(false);
    const [activeTestRunId, setActiveTestRunId] = useState<string | null>(null);

    const {
        logs,
        status,
        connectionStatus,
        error,
        totalPayloads,
        criticalCount,
        blockedCount,
        infoCount,
        connectWebSocket,
        disconnectWebSocket,
        resetAttack,
    } = useAttackStore();

    // -- Cleanup on unmount -------------------------------------------------
    useEffect(() => {
        return () => disconnectWebSocket();
    }, []);

    // -- Start attack -------------------------------------------------------
    const handleStartAttack = async (url?: string) => {
        const targetUrl = (url || inputUrl).trim();
        if (!targetUrl) return;

        // Reset the board for a fresh run
        resetAttack();
        setLaunching(true);
        setAborting(false);
        setActiveTestRunId(null);

        try {
            const res = await createTestRun(targetUrl);
            setActiveTestRunId(res.testRunId);
            connectWebSocket(res.testRunId);
        } catch (err) {
            console.error("[Dashboard] Failed to create test run:", err);
        } finally {
            setLaunching(false);
        }
    };

    // -- Stop attack --------------------------------------------------------
    const handleStopAttack = async () => {
        if (!activeTestRunId) return;
        setAborting(true);

        try {
            await abortTestRun(activeTestRunId);
            disconnectWebSocket();
        } catch (err) {
            console.error("[Dashboard] Failed to abort test run:", err);
        } finally {
            setAborting(false);
        }
    };

    const completedCount = logs.length;

    const progressPct =
        totalPayloads > 0
            ? Math.min(100, Math.round((completedCount / totalPayloads) * 100))
            : 0;

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

    // =======================================================================
    // Render
    // =======================================================================
    return (
        <div className="relative h-screen bg-black text-white font-['Inter'] selection:bg-cyan-500/20 overflow-x-hidden">
            {/* Slanted Background Lines from Landing Page */}
            <div
                className="fixed inset-0 pointer-events-none z-0"
                style={{
                    backgroundImage:
                        "repeating-linear-gradient(45deg, #111 0, #111 1px, transparent 1px, transparent 16px)",
                    WebkitMaskImage:
                        "linear-gradient(to bottom, black 10%, transparent 80%)",
                    maskImage:
                        "linear-gradient(to bottom, black 10%, transparent 80%)",
                }}
            />

            {/* Master Content Grid container */}
            <div className="w-[90%] max-w-6xl mx-auto h-screen flex flex-col border-x border-[#2A2A2A] relative bg-black z-10 shadow-[0_0_40px_rgba(0,0,0,0.8)]">
                {/* ============================================================= */}
                {/* 1. Control Header                                             */}
                {/* ============================================================= */}
                <header className="shrink-0 border-b border-neutral-800 bg-[#0A0A0A]">
                    {/* Top row — Logo, Status */}
                    <div className="h-14 flex items-center justify-between px-4 sm:px-6 gap-3">
                        <div className="flex items-center gap-3 shrink-0">
                            <button
                                onClick={() => navigate("/")}
                                className="text-neutral-600 hover:text-white transition-colors cursor-pointer p-1"
                                aria-label="Back to landing"
                            >
                                <ArrowLeft size={16} />
                            </button>
                            <div className="w-px h-5 bg-neutral-800" />
                            <div className="flex items-center gap-2">
                                <Shield size={16} className="text-white" />
                                <span className="text-white text-sm font-semibold tracking-tight">
                                    Onyx
                                </span>
                            </div>
                            <div className="w-px h-4 bg-neutral-800 mx-1 hidden sm:block" />
                            <div className="hidden sm:flex items-center gap-4">
                                <button
                                    onClick={() => navigate("/dashboard")}
                                    className="text-white text-[13px] font-medium transition-colors"
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

                        {/* Desktop form — hidden on mobile */}
                        <form
                            onSubmit={(e) => {
                                e.preventDefault();
                                handleStartAttack();
                            }}
                            className="hidden md:flex items-center gap-2 flex-1 max-w-2xl mx-4"
                        >
                            <Terminal
                                size={12}
                                className="text-neutral-600 shrink-0"
                            />
                            <input
                                type="url"
                                value={inputUrl}
                                onChange={(e) => setInputUrl(e.target.value)}
                                placeholder="https://petstore.swagger.io/v2/swagger.json"
                                className="flex-1 bg-[#111] border border-neutral-800 text-neutral-300 font-['JetBrains_Mono'] text-[12px] px-3 py-1.5 outline-none focus:border-neutral-600 transition-colors placeholder:text-neutral-700 rounded-sm"
                                disabled={launching}
                            />
                            <button
                                type="submit"
                                disabled={
                                    launching ||
                                    !inputUrl.trim() ||
                                    status === "attacking"
                                }
                                className="shrink-0 bg-white text-black text-[12px] font-bold px-4 py-1.5 rounded-sm hover:bg-neutral-200 transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1.5 font-['Inter']"
                            >
                                <Play size={11} />
                                {launching ? "Launching..." : "Execute Run"}
                            </button>
                            <button
                                type="button"
                                onClick={handleStopAttack}
                                disabled={status !== "attacking" || aborting}
                                className="shrink-0 bg-red-600 text-white text-[12px] font-bold px-4 py-1.5 rounded-sm hover:bg-red-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 font-['Inter']"
                            >
                                <Square size={10} />
                                {aborting ? "Stopping..." : "Stop Attack"}
                            </button>
                        </form>

                        {/* Status Badge */}
                        <div className="flex items-center gap-2 text-[11px] font-['JetBrains_Mono'] uppercase tracking-wider shrink-0">
                            <span
                                className={`w-2 h-2 rounded-full ${
                                    status === "attacking"
                                        ? "bg-cyan-400 animate-pulse shadow-[0_0_8px_rgba(34,211,238,0.6)]"
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
                    </div>

                    {/* Mobile form — visible only on mobile */}
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            handleStartAttack();
                        }}
                        className="flex md:hidden items-center gap-2 px-4 pb-3"
                    >
                        <input
                            type="url"
                            value={inputUrl}
                            onChange={(e) => setInputUrl(e.target.value)}
                            placeholder="Swagger URL..."
                            className="flex-1 min-w-0 bg-[#111] border border-neutral-800 text-neutral-300 font-['JetBrains_Mono'] text-[12px] px-3 py-1.5 outline-none focus:border-neutral-600 transition-colors placeholder:text-neutral-700 rounded-sm"
                            disabled={launching}
                        />
                        <button
                            type="submit"
                            disabled={
                                launching ||
                                !inputUrl.trim() ||
                                status === "attacking"
                            }
                            className="shrink-0 bg-white text-black text-[12px] font-bold px-3 py-1.5 rounded-sm hover:bg-neutral-200 transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1 font-['Inter']"
                        >
                            <Play size={11} />
                            Run
                        </button>
                        <button
                            type="button"
                            onClick={handleStopAttack}
                            disabled={status !== "attacking" || aborting}
                            className="shrink-0 bg-red-600 text-white text-[12px] font-bold px-3 py-1.5 rounded-sm hover:bg-red-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 font-['Inter']"
                        >
                            <Square size={10} />
                            Stop
                        </button>
                    </form>
                </header>

                <ColdStartBanner />

                {/* ============================================================= */}
                {/* 2. Telemetry Row — 4 metric cards                             */}
                {/* ============================================================= */}
                <div className="shrink-0 grid grid-cols-2 lg:grid-cols-4 gap-px bg-neutral-800 border-b border-neutral-800">
                    {/* Card 1: Total Payloads (with progress bar) */}
                    <div className="bg-[#0A0A0A] p-4 sm:p-5 flex flex-col min-h-[96px] relative overflow-hidden">
                        <div className="flex items-center gap-2 text-neutral-600 text-[10px] font-['JetBrains_Mono'] uppercase tracking-[0.15em]">
                            <Crosshair size={11} />
                            Payloads Fired
                        </div>
                        <div className="mt-auto flex items-baseline gap-1">
                            <span className="text-3xl font-['JetBrains_Mono'] text-white tabular-nums">
                                {completedCount}
                            </span>
                            <span className="text-sm font-['JetBrains_Mono'] text-neutral-600">
                                / {totalPayloads}
                            </span>
                        </div>
                        {/* Progress bar */}
                        {totalPayloads > 0 && (
                            <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-neutral-900">
                                <motion.div
                                    className="h-full bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.4)]"
                                    initial={{ width: 0 }}
                                    animate={{ width: `${progressPct}%` }}
                                    transition={{
                                        duration: 0.3,
                                        ease: "easeOut",
                                    }}
                                />
                            </div>
                        )}
                    </div>

                    {/* Card 1: Critical Failures */}
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

                    {/* Card 2: Payloads Blocked */}
                    <div className="bg-[#0A0A0A] p-4 sm:p-5 flex flex-col min-h-[96px]">
                        <div className="flex items-center gap-2 text-neutral-600 text-[10px] font-['JetBrains_Mono'] uppercase tracking-[0.15em]">
                            <ShieldAlert
                                size={11}
                                className="text-orange-500"
                            />
                            Payloads Blocked
                        </div>
                        <div className="mt-auto flex items-baseline gap-2">
                            <span className="text-3xl font-['JetBrains_Mono'] tabular-nums text-yellow-500">
                                {blockedCount}
                            </span>
                        </div>
                    </div>

                    {/* Card 3: Info / Passed */}
                    <div className="bg-[#0A0A0A] p-4 sm:p-5 flex flex-col min-h-[96px]">
                        <div className="flex items-center gap-2 text-neutral-600 text-[10px] font-['JetBrains_Mono'] uppercase tracking-[0.15em]">
                            <ShieldCheck
                                size={11}
                                className="text-neutral-500"
                            />
                            Info / Passed
                        </div>
                        <div className="mt-auto flex items-baseline">
                            <span className="text-3xl font-['JetBrains_Mono'] text-neutral-500 tabular-nums">
                                {infoCount}
                            </span>
                        </div>
                    </div>

                    {/* Card 4: Queue Status */}
                    <div className="bg-[#0A0A0A] p-4 sm:p-5 flex flex-col min-h-[96px]">
                        <div className="flex items-center gap-2 text-neutral-600 text-[10px] font-['JetBrains_Mono'] uppercase tracking-[0.15em]">
                            <Radio size={11} />
                            Queue Status
                        </div>
                        <div className="mt-auto flex items-center gap-2">
                            <span
                                className={`w-2 h-2 rounded-full ${
                                    connectionStatus === "connected"
                                        ? "bg-emerald-400 animate-pulse shadow-[0_0_6px_rgba(52,211,153,0.5)]"
                                        : connectionStatus === "connecting"
                                          ? "bg-yellow-400 animate-pulse"
                                          : "bg-neutral-600"
                                }`}
                            />
                            <span
                                className={`text-lg font-['JetBrains_Mono'] ${
                                    connectionStatus === "connected"
                                        ? "text-emerald-400"
                                        : connectionStatus === "connecting"
                                          ? "text-yellow-400"
                                          : "text-neutral-600"
                                }`}
                            >
                                {queueLabel}
                            </span>
                        </div>
                    </div>
                </div>

                {/* ============================================================= */}
                {/* 3. Live Attack Stream — Full-width data table                  */}
                {/* ============================================================= */}
                <div className="flex-1 flex flex-col overflow-hidden">
                    {/* Column Headers — desktop only */}
                    <div className="shrink-0 hidden md:grid grid-cols-[72px_60px_1fr_90px_60px_72px_1.2fr] gap-0 px-4 sm:px-6 py-2.5 bg-[#050505] border-b border-neutral-800 font-['JetBrains_Mono'] text-[10px] text-neutral-600 uppercase tracking-[0.15em]">
                        <span>Time</span>
                        <span>Method</span>
                        <span>Endpoint</span>
                        <span>Severity</span>
                        <span>Status</span>
                        <span>Latency</span>
                        <span>Payload</span>
                    </div>

                    {/* Mobile header */}
                    <div className="shrink-0 md:hidden px-4 py-2.5 bg-[#050505] border-b border-neutral-800 font-['JetBrains_Mono'] text-[10px] text-neutral-600 uppercase tracking-[0.15em]">
                        Live Attack Stream
                    </div>

                    {/* Scrollable rows */}
                    <div className="flex-1 overflow-y-auto bg-[#0A0A0A]">
                        {/* Error banner */}
                        {error && (
                            <div className="mx-4 sm:mx-6 mt-3 px-3 py-2.5 border border-red-500/30 bg-red-500/5 text-red-400 text-[11px] font-['JetBrains_Mono'] flex items-center gap-2 rounded-sm">
                                <AlertTriangle size={12} className="shrink-0" />
                                {error}
                            </div>
                        )}

                        {/* Empty state */}
                        {logs.length === 0 && !error && (
                            <div className="flex flex-col items-center justify-center h-52 text-neutral-700 font-['JetBrains_Mono'] text-xs gap-3">
                                {status === "attacking" ? (
                                    <>
                                        <div className="relative">
                                            <div className="w-8 h-8 border border-cyan-500/30 rounded-full animate-ping absolute inset-0" />
                                            <div className="w-8 h-8 border border-cyan-500/60 rounded-full flex items-center justify-center">
                                                <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse" />
                                            </div>
                                        </div>
                                        <span className="text-neutral-500">
                                            Initializing attack sequence...
                                        </span>
                                    </>
                                ) : (
                                    <>
                                        <Terminal
                                            size={20}
                                            className="text-neutral-800"
                                        />
                                        <span>
                                            Enter a target URL above to begin
                                        </span>
                                    </>
                                )}
                            </div>
                        )}

                        {/* Live data rows */}
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
                                        initial={{
                                            opacity: 0,
                                            y: -16,
                                            height: 0,
                                        }}
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
                                        {/* Desktop row — 7-column grid */}
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
                                                {log.latencyMs}
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

                                        {/* Mobile card — stacked layout */}
                                        <div className="md:hidden px-4 py-3 border-b border-neutral-800/40 font-['JetBrains_Mono'] text-[12px] hover:bg-white/[0.015] transition-colors space-y-1.5">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <span
                                                        className={`text-[11px] font-semibold ${getMethodColor(log.method)}`}
                                                    >
                                                        {log.method}
                                                    </span>
                                                    <span className="text-neutral-500 tabular-nums text-[11px]">
                                                        {log.statusCode ||
                                                            "ERR"}
                                                    </span>
                                                    <span className="text-[11px] tracking-wide">
                                                        {getStatusBadge(
                                                            log.statusCode,
                                                        )}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2 text-neutral-600 text-[10px]">
                                                    <span className="tabular-nums">
                                                        {log.latencyMs}ms
                                                    </span>
                                                    <span className="tabular-nums">
                                                        {formatTime(
                                                            log.timestamp,
                                                        )}
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

                    {/* Bottom status bar */}
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
                            {totalPayloads > 0 && (
                                <span className="text-neutral-700 ml-2">
                                    ({progressPct}%)
                                </span>
                            )}
                        </span>
                        <span className="flex items-center gap-1.5">
                            <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                    connectionStatus === "connected"
                                        ? "bg-emerald-500"
                                        : "bg-neutral-700"
                                }`}
                            />
                            {connectionStatus === "connected"
                                ? "Stream connected"
                                : "Disconnected"}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;

// =============================================================================
// Dashboard — "Onyx Command Center"
// High-density command UI on the brand off-black surface (#080808 / #0B0C0D),
// teal live-accent, semantic severity colors. Matches the landing design system.
// =============================================================================

import { useState, useEffect, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import {
    Crosshair,
    AlertTriangle,
    ShieldAlert,
    Radio,
    Terminal,
    Play,
    Square,
} from "lucide-react";
import { useAttackStore } from "@/store/useAttackStore";
import { createTestRun, abortTestRun, getCurrentUser, getVerifiedTargets, CurrentUser } from "@/services/api";
import ColdStartBanner from "@/components/ColdStartBanner";
import DomainVerifyPanel from "@/components/DomainVerifyPanel";
import AppHeader from "@/components/AppHeader";

// =============================================================================
// Component
// =============================================================================

const Dashboard = () => {
    const location = useLocation();

    // The URL may come from the landing page via router state,
    // or from sessionStorage when the user was redirected through sign-up/sign-in
    const initialUrl = (() => {
        if (location.state?.targetUrl) return location.state.targetUrl as string;
        const pending = sessionStorage.getItem("onyx-pending-url");
        if (pending) {
            sessionStorage.removeItem("onyx-pending-url");
            return pending;
        }
        return "";
    })();

    // Local input state
    const [inputUrl, setInputUrl] = useState(initialUrl);
    const [launching, setLaunching] = useState(false);
    const [aborting, setAborting] = useState(false);
    const [activeTestRunId, setActiveTestRunId] = useState<string | null>(null);
    const [user, setUser] = useState<CurrentUser | null>(null);
    // When the backend bypass is enabled, skip the client-side domain gate too
    // so the Execute button isn't disabled. Set VITE_SKIP_DOMAIN_VERIFY=true.
    const skipDomainVerify = import.meta.env.VITE_SKIP_DOMAIN_VERIFY === "true";
    const [domainVerified, setDomainVerified] = useState(skipDomainVerify);
    const [lastVerifiedDomain, setLastVerifiedDomain] = useState<string | null>(null);

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

    // -- Fetch User + pre-check verified domains ----------------------------
    useEffect(() => {
        getCurrentUser().then(setUser).catch(() => {});
        if (initialUrl) {
            try {
                const domain = new URL(initialUrl).hostname.toLowerCase();
                getVerifiedTargets().then(({ targets }) => {
                    const match = targets.find((t) => t.domain === domain && t.verifiedAt !== null);
                    if (match) {
                        setDomainVerified(true);
                        setLastVerifiedDomain(domain);
                    }
                }).catch(() => {});
            } catch { /* invalid URL, ignore */ }
        }
    }, []);

    // -- Reset verification when the domain changes -------------------------
    useEffect(() => {
        if (skipDomainVerify) return; // bypass on — stay "verified"
        if (!inputUrl.trim()) return;
        try {
            const domain = new URL(inputUrl).hostname.toLowerCase();
            if (domain !== lastVerifiedDomain) {
                setDomainVerified(false);
            }
        } catch { /* invalid URL, ignore */ }
    }, [inputUrl]);

    // -- Cleanup on unmount -------------------------------------------------
    useEffect(() => {
        return () => disconnectWebSocket();
    }, []);

    // -- Domain verified callback -------------------------------------------
    const handleDomainVerified = (domain: string) => {
        setDomainVerified(true);
        setLastVerifiedDomain(domain);
    };

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
            // We do NOT disconnect the websocket here. We rely on the backend to broadcast
            // the TEST_RUN_STATUS = FAILED message. This allows the UI to catch up and handle
            // the aborted state smoothly.
        } catch (err) {
            console.error("[Dashboard] Failed to abort test run:", err);
        } finally {
            setAborting(false);
        }
    };

    const completedCount = logs.length;

    // Cap rendered rows to prevent DOM performance cliff on large runs.
    // All logs are still counted in metrics — only rendering is limited.
    const visibleLogs = useMemo(() => logs.slice(0, 300), [logs]);

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
                return "text-[#73bfc4]";
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
        <div className="relative min-h-screen bg-[#080808] text-white font-['Inter'] antialiased selection:bg-[#73bfc4]/25 selection:text-black overflow-x-hidden">
            {/* Subtle gradient accent, ties the dashboard to the landing theme */}
            <div className="fixed inset-x-0 top-0 h-72 pointer-events-none z-0 c5-animated-gradient opacity-[0.08] blur-3xl" />
            <div className="fixed inset-0 pointer-events-none z-0 bg-gradient-to-b from-transparent via-[#080808] to-[#080808]" />

            <div className="relative z-10 flex flex-col min-h-screen">
                <AppHeader user={user} />

                <ColdStartBanner />

                {/* ============================================================= */}
                {/* Main content                                                  */}
                {/* ============================================================= */}
                <main className="w-full px-5 sm:px-8 lg:px-12 flex-1 flex flex-col py-5 gap-4">
                    {/* --------------------------------------------------------- */}
                    {/* 2. Launch Panel                                           */}
                    {/* --------------------------------------------------------- */}
                    <section className="rounded-2xl bg-[#0B0C0D]/80 backdrop-blur-sm shadow-[0_0_0_1px_rgba(255,255,255,0.07)] p-4 sm:p-5">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2 text-[11px] font-['JetBrains_Mono'] uppercase tracking-[0.15em] text-neutral-500">
                                <Terminal size={13} />
                                New Attack Run
                            </div>
                            {/* Status badge */}
                            <div className="flex items-center gap-2 text-[11px] font-['JetBrains_Mono'] uppercase tracking-wider">
                                <span
                                    className={`w-2 h-2 rounded-full ${
                                        status === "attacking"
                                            ? "bg-[#73bfc4] animate-pulse shadow-[0_0_8px_rgba(115,191,196,0.6)]"
                                            : status === "completed"
                                              ? "bg-neutral-500"
                                              : "bg-neutral-700"
                                    }`}
                                />
                                <span
                                    className={
                                        status === "attacking"
                                            ? "text-[#73bfc4]"
                                            : "text-neutral-500"
                                    }
                                >
                                    {statusLabel}
                                </span>
                            </div>
                        </div>

                        <form
                            onSubmit={(e) => {
                                e.preventDefault();
                                handleStartAttack();
                            }}
                            className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3"
                        >
                            <input
                                type="url"
                                value={inputUrl}
                                onChange={(e) => setInputUrl(e.target.value)}
                                placeholder="https://petstore.swagger.io/v2/swagger.json"
                                className="flex-1 bg-[#070809] text-neutral-200 font-['JetBrains_Mono'] text-[13px] px-4 py-3 outline-none shadow-[inset_0_0_0_1px_rgba(255,255,255,0.07)] focus:shadow-[inset_0_0_0_1px_rgba(115,191,196,0.5)] transition-shadow placeholder:text-neutral-700 rounded-full"
                                disabled={launching}
                            />
                            {inputUrl.trim() && !domainVerified && (
                                <DomainVerifyPanel
                                    specUrl={inputUrl}
                                    onVerified={handleDomainVerified}
                                />
                            )}
                            <div className="flex items-center gap-3">
                                <button
                                    type="submit"
                                    disabled={
                                        launching ||
                                        !inputUrl.trim() ||
                                        !domainVerified ||
                                        status === "attacking"
                                    }
                                    className="flex-1 sm:flex-none justify-center bg-white text-black text-[13px] font-bold px-6 py-3 rounded-full hover:bg-neutral-200 transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1.5 font-['Inter']"
                                >
                                    <Play size={12} />
                                    {launching ? "Launching..." : "Execute Run"}
                                </button>
                                <button
                                    type="button"
                                    onClick={handleStopAttack}
                                    disabled={!activeTestRunId || aborting || status === "completed"}
                                    className="flex-1 sm:flex-none justify-center bg-red-600/90 text-white text-[13px] font-bold px-6 py-3 rounded-full hover:bg-red-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 font-['Inter']"
                                >
                                    <Square size={11} />
                                    {aborting ? "Stopping..." : "Stop"}
                                </button>
                            </div>
                        </form>
                    </section>

                    {/* --------------------------------------------------------- */}
                    {/* 3. Telemetry Cards                                        */}
                    {/* --------------------------------------------------------- */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        {/* Payloads Fired */}
                        <div className="rounded-2xl bg-[#0B0C0D] shadow-[0_0_0_1px_rgba(255,255,255,0.07)] p-4 flex flex-col min-h-[96px] relative overflow-hidden">
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
                            {totalPayloads > 0 && (
                                <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-neutral-900">
                                    <motion.div
                                        className="h-full bg-[#73bfc4] shadow-[0_0_6px_rgba(115,191,196,0.4)]"
                                        initial={{ width: 0 }}
                                        animate={{ width: `${progressPct}%` }}
                                        transition={{ duration: 0.3, ease: "easeOut" }}
                                    />
                                </div>
                            )}
                        </div>

                        {/* Critical Failures */}
                        <div className="rounded-2xl bg-[#0B0C0D] shadow-[0_0_0_1px_rgba(255,255,255,0.07)] p-4 flex flex-col min-h-[96px] relative overflow-hidden">
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

                        {/* Payloads Blocked */}
                        <div className="rounded-2xl bg-[#0B0C0D] shadow-[0_0_0_1px_rgba(255,255,255,0.07)] p-4 flex flex-col min-h-[96px]">
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

                        {/* Queue Status */}
                        <div className="rounded-2xl bg-[#0B0C0D] shadow-[0_0_0_1px_rgba(255,255,255,0.07)] p-4 flex flex-col min-h-[96px]">
                            <div className="flex items-center gap-2 text-neutral-600 text-[10px] font-['JetBrains_Mono'] uppercase tracking-[0.15em]">
                                <Radio size={11} />
                                Queue Status
                            </div>
                            <div className="mt-auto flex items-center gap-2">
                                <span
                                    className={`w-2 h-2 rounded-full ${
                                        connectionStatus === "connected"
                                            ? "bg-[#73bfc4] animate-pulse shadow-[0_0_6px_rgba(115,191,196,0.5)]"
                                            : connectionStatus === "connecting"
                                              ? "bg-yellow-400 animate-pulse"
                                              : "bg-neutral-600"
                                    }`}
                                />
                                <span
                                    className={`text-lg font-['JetBrains_Mono'] ${
                                        connectionStatus === "connected"
                                            ? "text-[#73bfc4]"
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

                    {/* --------------------------------------------------------- */}
                    {/* 4. Live Attack Stream                                     */}
                    {/* --------------------------------------------------------- */}
                    <section className="flex-1 flex flex-col rounded-2xl bg-[#0B0C0D] shadow-[0_0_0_1px_rgba(255,255,255,0.07)] overflow-hidden min-h-[400px]">
                        {/* Panel header */}
                        <div className="shrink-0 flex items-center justify-between px-4 sm:px-6 py-3 border-b border-white/[0.06]">
                            <div className="flex items-center gap-2 text-[11px] font-['JetBrains_Mono'] uppercase tracking-[0.15em] text-neutral-500">
                                <Radio size={12} />
                                Live Attack Stream
                            </div>
                            <span className="flex items-center gap-1.5 text-[10px] font-['JetBrains_Mono'] text-neutral-600">
                                <span
                                    className={`w-1.5 h-1.5 rounded-full ${
                                        connectionStatus === "connected"
                                            ? "bg-[#73bfc4]"
                                            : "bg-neutral-700"
                                    }`}
                                />
                                {connectionStatus === "connected"
                                    ? "Connected"
                                    : "Disconnected"}
                            </span>
                        </div>

                        {/* Column headers — desktop */}
                        <div className="shrink-0 hidden md:grid grid-cols-[72px_60px_1fr_90px_60px_72px_1.2fr] gap-0 px-4 sm:px-6 py-2.5 bg-[#070809] border-b border-white/[0.06] font-['JetBrains_Mono'] text-[10px] text-neutral-600 uppercase tracking-[0.15em]">
                            <span>Time</span>
                            <span>Method</span>
                            <span>Endpoint</span>
                            <span>Severity</span>
                            <span>Status</span>
                            <span>Latency</span>
                            <span>Payload</span>
                        </div>

                        {/* Scrollable rows */}
                        <div className="flex-1 overflow-y-auto">
                            {error && (
                                <div className="mx-4 sm:mx-6 mt-3 px-3 py-2.5 border border-red-500/30 bg-red-500/5 text-red-400 text-[11px] font-['JetBrains_Mono'] flex items-center gap-2 rounded-lg">
                                    <AlertTriangle size={12} className="shrink-0" />
                                    {error}
                                </div>
                            )}

                            {logs.length === 0 && !error && (
                                <div className="flex flex-col items-center justify-center h-64 text-neutral-700 font-['JetBrains_Mono'] text-xs gap-3">
                                    {status === "attacking" ? (
                                        <>
                                            <div className="relative">
                                                <div className="w-8 h-8 border border-[#73bfc4]/30 rounded-full animate-ping absolute inset-0" />
                                                <div className="w-8 h-8 border border-[#73bfc4]/60 rounded-full flex items-center justify-center">
                                                    <div className="w-2 h-2 bg-[#73bfc4] rounded-full animate-pulse" />
                                                </div>
                                            </div>
                                            <span className="text-neutral-500">
                                                Initializing attack sequence...
                                            </span>
                                        </>
                                    ) : (
                                        <>
                                            <Terminal size={22} className="text-neutral-800" />
                                            <span>Enter a target URL above to begin</span>
                                        </>
                                    )}
                                </div>
                            )}

                            {visibleLogs.map((log, index) => {
                                const payloadStr =
                                    typeof log.payload === "string"
                                        ? log.payload
                                        : JSON.stringify(log.payload);

                                const isCritical = log.statusCode >= 400;

                                return (
                                    <div
                                        key={log.id}
                                        className={`${getRowClass(log.statusCode)} ${index === 0 ? "onyx-row-enter" : ""}`}
                                    >
                                        {/* Desktop row */}
                                        <div className="hidden md:grid grid-cols-[72px_60px_1fr_90px_60px_72px_1.2fr] gap-0 px-4 sm:px-6 py-2 border-b border-white/[0.06] font-['JetBrains_Mono'] text-[12px] items-center hover:bg-white/[0.025] transition-colors">
                                            <span className="text-neutral-600 text-[11px] tabular-nums">
                                                {formatTime(log.timestamp)}
                                            </span>
                                            <span className={`text-[11px] font-semibold ${getMethodColor(log.method)}`}>
                                                {log.method}
                                            </span>
                                            <span className={`truncate pr-3 ${isCritical ? "text-white" : "text-neutral-300"}`}>
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
                                                <span className="text-neutral-700">ms</span>
                                            </span>
                                            <span className="text-neutral-500 text-[11px] truncate" title={payloadStr}>
                                                {payloadStr}
                                            </span>
                                        </div>

                                        {/* Mobile card */}
                                        <div className="md:hidden px-4 py-3 border-b border-white/[0.06] font-['JetBrains_Mono'] text-[12px] hover:bg-white/[0.025] transition-colors space-y-1.5">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <span className={`text-[11px] font-semibold ${getMethodColor(log.method)}`}>
                                                        {log.method}
                                                    </span>
                                                    <span className="text-neutral-500 tabular-nums text-[11px]">
                                                        {log.statusCode || "ERR"}
                                                    </span>
                                                    <span className="text-[11px] tracking-wide">
                                                        {getStatusBadge(log.statusCode)}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2 text-neutral-600 text-[10px]">
                                                    <span className="tabular-nums">{log.latencyMs}ms</span>
                                                    <span className="tabular-nums">{formatTime(log.timestamp)}</span>
                                                </div>
                                            </div>
                                            <div className={`text-[11px] truncate ${isCritical ? "text-white" : "text-neutral-400"}`}>
                                                {log.endpoint}
                                            </div>
                                            <div className="text-neutral-600 text-[10px] truncate" title={payloadStr}>
                                                {payloadStr}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Panel footer status */}
                        <div className="shrink-0 h-8 bg-[#070809] border-t border-white/[0.06] flex items-center justify-between px-4 sm:px-6 font-['JetBrains_Mono'] text-[10px] text-neutral-600">
                            <span>
                                {completedCount} / {totalPayloads || "—"} results
                                {criticalCount > 0 && (
                                    <span className="text-red-500/80 ml-2">● {criticalCount} critical</span>
                                )}
                                {blockedCount > 0 && (
                                    <span className="text-orange-500/80 ml-2">● {blockedCount} blocked</span>
                                )}
                                {totalPayloads > 0 && (
                                    <span className="text-neutral-700 ml-2">({progressPct}%)</span>
                                )}
                            </span>
                            <span className="text-neutral-700">
                                {infoCount} info / passed
                            </span>
                        </div>
                    </section>
                </main>
            </div>
        </div>
    );
};

export default Dashboard;

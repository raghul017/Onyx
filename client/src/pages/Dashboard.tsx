// =============================================================================
// Dashboard — "Onyx Command Center"
// High-density command UI on the brand off-black surface (#080808 / #0B0C0D),
// teal live-accent, semantic severity colors. Matches the landing design system.
// =============================================================================

import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { Terminal, Play, Square } from "lucide-react";
import { useAttackStore } from "@/store/useAttackStore";
import { createTestRun, abortTestRun, getCurrentUser, getVerifiedTargets, CurrentUser } from "@/services/api";
import ColdStartBanner from "@/components/ColdStartBanner";
import DomainVerifyPanel from "@/components/DomainVerifyPanel";
import AppHeader from "@/components/AppHeader";
import DashboardCommand from "@/components/DashboardCommand";

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

    const progressPct =
        totalPayloads > 0
            ? Math.min(100, Math.round((completedCount / totalPayloads) * 100))
            : 0;

    // Row rendering, severity badges, latency series, etc. now live inside
    // DashboardCommand (the bento body). This page owns launch + lifecycle only.
    const statusLabel =
        status === "attacking"
            ? "ATTACK IN PROGRESS"
            : status === "completed"
              ? "SEQUENCE COMPLETE"
              : "STANDING BY";

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
                    {/* 3. Command center — bento layout (telemetry + stream)     */}
                    {/* --------------------------------------------------------- */}
                    <DashboardCommand
                        logs={logs}
                        status={status}
                        connectionStatus={connectionStatus}
                        error={error}
                        totalPayloads={totalPayloads}
                        criticalCount={criticalCount}
                        blockedCount={blockedCount}
                        infoCount={infoCount}
                        progressPct={progressPct}
                        targetUrl={inputUrl}
                    />
                </main>
            </div>
        </div>
    );
};

export default Dashboard;

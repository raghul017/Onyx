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
    const isAttacking = status === "attacking";

    return (
        <div className="relative min-h-screen bg-[#0A0A0A] text-white font-['Geist'] antialiased selection:bg-[#73bfc4]/25 selection:text-black overflow-x-hidden">
            <div className="relative z-10 flex flex-col min-h-screen">
                <AppHeader user={user} />

                <ColdStartBanner />

                {/* ============================================================= */}
                {/* Main content — one continuous surface (launch row + body),    */}
                {/* not two floating cards on a void.                             */}
                {/* ============================================================= */}
                <main className="w-full px-5 sm:px-8 lg:px-12 flex-1 flex flex-col py-6">
                    {/* Page title row */}
                    <div className="flex items-end justify-between gap-4 mb-4">
                        <div>
                            <h1
                                className="text-neutral-100 text-[22px] leading-none tracking-[-0.02em]"
                                style={{ fontFamily: '"Geist", ui-sans-serif, system-ui, sans-serif', fontWeight: 600 }}
                            >
                                Command center
                            </h1>
                            <p className="mt-1.5 text-[13px] text-neutral-500">
                                Launch a scan against an API spec and watch results stream in live.
                            </p>
                        </div>
                        {/* Run status — plain text, appears only when relevant */}
                        {status !== "idle" && (
                            <div className="hidden sm:flex items-center gap-2 text-[12px]">
                                <span
                                    className={`h-1.5 w-1.5 rounded-full ${
                                        isAttacking ? "bg-[#5fb3b8] animate-pulse" : "bg-neutral-600"
                                    }`}
                                />
                                <span className={isAttacking ? "text-[#8fc9cd]" : "text-neutral-500"}>
                                    {statusLabel}
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Unified console surface */}
                    <section className="flex flex-col rounded-[10px] bg-[#0C0D0E] shadow-[0_0_0_1px_rgba(255,255,255,0.06)] overflow-hidden">
                        {/* Launch row — a real toolbar, not a floating pill card */}
                        <form
                            onSubmit={(e) => {
                                e.preventDefault();
                                handleStartAttack();
                            }}
                            className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 p-2.5 border-b border-white/[0.06] bg-[#0A0B0C]"
                        >
                            <div className="flex-1 flex items-center gap-2.5 rounded-md bg-[#070809] px-3.5 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)] focus-within:shadow-[inset_0_0_0_1px_rgba(95,179,184,0.45)] transition-shadow">
                                <Terminal size={14} className="shrink-0 text-neutral-600" />
                                <input
                                    type="url"
                                    value={inputUrl}
                                    onChange={(e) => setInputUrl(e.target.value)}
                                    placeholder="https://petstore.swagger.io/v2/swagger.json"
                                    className="flex-1 bg-transparent text-neutral-200 font-['JetBrains_Mono'] text-[13px] py-2.5 outline-none placeholder:text-neutral-700"
                                    disabled={launching}
                                />
                            </div>
                            {inputUrl.trim() && !domainVerified && (
                                <DomainVerifyPanel
                                    specUrl={inputUrl}
                                    onVerified={handleDomainVerified}
                                />
                            )}
                            <div className="flex items-center gap-2">
                                <button
                                    type="submit"
                                    disabled={
                                        launching ||
                                        !inputUrl.trim() ||
                                        !domainVerified ||
                                        isAttacking
                                    }
                                    className="flex-1 sm:flex-none justify-center bg-[#5fb3b8] text-[#06181a] text-[13px] font-semibold pl-4 pr-4 h-10 rounded-md hover:bg-[#6cc0c5] transition-colors active:scale-[0.98] disabled:opacity-30 disabled:cursor-not-allowed disabled:active:scale-100 flex items-center gap-2 font-['Geist']"
                                >
                                    <Play size={13} className="translate-x-px" />
                                    {launching ? "Launching…" : "Launch scan"}
                                </button>
                                {/* Stop only exists while a run is active — an idle
                                    destructive button is noise. */}
                                {(isAttacking || aborting) && (
                                    <button
                                        type="button"
                                        onClick={handleStopAttack}
                                        disabled={aborting}
                                        className="flex-1 sm:flex-none justify-center text-red-300 text-[13px] font-semibold px-4 h-10 rounded-md shadow-[inset_0_0_0_1px_rgba(239,68,68,0.4)] hover:bg-red-500/10 transition-colors active:scale-[0.98] disabled:opacity-40 flex items-center gap-2 font-['Geist']"
                                    >
                                        <Square size={11} />
                                        {aborting ? "Stopping…" : "Stop"}
                                    </button>
                                )}
                            </div>
                        </form>

                        {/* Body — ghost idle state OR live command center */}
                        <div className="flex-1 flex flex-col">
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
                        </div>
                    </section>
                </main>
            </div>
        </div>
    );
};

export default Dashboard;

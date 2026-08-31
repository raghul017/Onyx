// =============================================================================
// Dashboard — "Onyx Command Center"
// High-density command UI in the light-mono system (#fafafa surface, white
// hairline console, sharp corners, no shadows, Geist + JetBrains Mono, single
// blue #3b82f6 accent, semantic severity colors). Matches the whole app.
// =============================================================================

import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Terminal, Play, Square, KeyRound, Users, Plus, X } from "lucide-react";
import { useAttackStore } from "@/store/useAttackStore";
import {
    createTestRun,
    abortTestRun,
    getCurrentUser,
    getVerifiedTargets,
    listAuthRecipes,
    CurrentUser,
    type AuthRecipe,
} from "@/services/api";
import ColdStartBanner from "@/components/ColdStartBanner";
import DomainVerifyPanel from "@/components/DomainVerifyPanel";
import AppHeader from "@/components/AppHeader";
import DashboardCommand from "@/components/DashboardCommand";
import {
    MAX_IDENTITIES,
    buildIdentityPayload,
    isBolaEnabled,
    newIdentityRow,
    validateIdentities,
    type IdentityRow,
} from "@/lib/identities";

// =============================================================================
// Component
// =============================================================================

const Dashboard = () => {
    const location = useLocation();
    const navigate = useNavigate();

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
    // T7: optional static credential attached to the run.
    const [authRecipes, setAuthRecipes] = useState<AuthRecipe[]>([]);
    const [authRecipeId, setAuthRecipeId] = useState<string>("");
    // T13c: extra identities for cross-identity (BOLA) testing. Row 0 mirrors the
    // toolbar credential picker (the PRIMARY identity), so a single-identity scan
    // is exactly what it was before. Adding a 2nd row enables BOLA.
    const [identityRows, setIdentityRows] = useState<IdentityRow[]>([]);
    const [identitiesOpen, setIdentitiesOpen] = useState(false);

    // The full identity list = the PRIMARY (toolbar credential) + any extra rows.
    // Keeping the primary in the toolbar preserves the pre-T13c single-scan UX.
    const allIdentityRows: IdentityRow[] = [
        {
            key: "primary",
            label: "User A",
            authRecipeId,
            isPrimary: true,
        },
        ...identityRows,
    ];
    const bolaEnabled = isBolaEnabled(allIdentityRows);
    const identityError = validateIdentities(allIdentityRows);

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
        listAuthRecipes().then(({ recipes }) => setAuthRecipes(recipes)).catch(() => {});
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
            // T13c: one row = legacy single-recipe payload; 2+ = identities array.
            const { authRecipeId: legacyRecipe, identities } =
                buildIdentityPayload(allIdentityRows);
            const res = await createTestRun(targetUrl, legacyRecipe, identities);
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
        <div className="onyx-mono relative min-h-screen overflow-x-clip">
            <div className="relative z-10 flex flex-col min-h-screen">
                <AppHeader user={user} />

                <ColdStartBanner />

                {/* ============================================================= */}
                {/* Main content — one continuous console surface (launch row +   */}
                {/* body), not two floating cards on a void.                      */}
                {/* ============================================================= */}
                <main className="w-full px-5 sm:px-8 lg:px-12 flex-1 flex flex-col py-8 sm:py-10">
                    {/* Page title row */}
                    <div className="flex items-end justify-between gap-4 mb-5">
                        <div>
                            <h1 className="text-[clamp(1.75rem,4vw,2.5rem)] leading-tight font-normal tracking-tight text-balance">
                                Command center
                            </h1>
                            <p className="mt-2 text-sm text-[#666]">
                                Launch a scan against an API spec and watch results stream in live.
                            </p>
                        </div>
                        {/* Run status — appears only when relevant */}
                        {status !== "idle" && (
                            <div className="hidden sm:flex items-center gap-2 text-[12px] font-mono uppercase tracking-wider shrink-0">
                                <span
                                    className={`h-1.5 w-1.5 rounded-full ${
                                        isAttacking ? "bg-[#3b82f6] animate-pulse" : "bg-[#ccc]"
                                    }`}
                                />
                                <span className={isAttacking ? "text-[#3b82f6]" : "text-[#999]"}>
                                    {statusLabel}
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Unified console surface */}
                    <section className="flex flex-col border border-[#e6e6e6] bg-white overflow-hidden">
                        {/* Launch row — a real toolbar, not a floating pill card */}
                        <form
                            onSubmit={(e) => {
                                e.preventDefault();
                                handleStartAttack();
                            }}
                            className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 p-2.5 border-b border-[#e6e6e6] bg-[#fafafa]"
                        >
                            <div className="flex-1 flex items-center gap-2.5 bg-white px-3.5 border border-[#e6e6e6] focus-within:border-[#3b82f6] transition-colors">
                                <Terminal size={14} className="shrink-0 text-[#999]" />
                                <input
                                    type="url"
                                    value={inputUrl}
                                    onChange={(e) => setInputUrl(e.target.value)}
                                    placeholder="https://petstore.swagger.io/v2/swagger.json"
                                    className="flex-1 bg-transparent text-black font-mono text-[13px] py-2.5 outline-none placeholder:text-[#ccc]"
                                    disabled={launching}
                                />
                            </div>
                            {inputUrl.trim() && !domainVerified && (
                                <DomainVerifyPanel
                                    specUrl={inputUrl}
                                    onVerified={handleDomainVerified}
                                />
                            )}
                            {/* T7: optional authentication for the run */}
                            {authRecipes.length > 0 ? (
                                <div
                                    className="flex items-center gap-1.5 bg-white px-2.5 border border-[#e6e6e6] focus-within:border-[#3b82f6] transition-colors shrink-0"
                                    title="Attach a credential so every request is authenticated"
                                >
                                    <KeyRound size={13} className="shrink-0 text-[#999]" />
                                    <select
                                        value={authRecipeId}
                                        onChange={(e) => setAuthRecipeId(e.target.value)}
                                        disabled={launching || isAttacking}
                                        className="bg-transparent text-[#333] font-mono text-[12px] py-2.5 outline-none disabled:opacity-50 max-w-[150px]"
                                    >
                                        <option value="">No auth</option>
                                        {authRecipes.map((r) => (
                                            <option key={r.id} value={r.id}>
                                                {r.name} · {r.type}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => navigate("/settings")}
                                    title="Create a credential to run authenticated scans"
                                    className="flex items-center gap-1.5 bg-white px-3 border border-[#e6e6e6] text-[#666] hover:border-black hover:text-black text-[12px] font-mono transition-colors shrink-0 h-10"
                                >
                                    <KeyRound size={13} /> Add auth
                                </button>
                            )}
                            {/* T13c: identities toggle — opens the multi-identity
                                (BOLA) panel. Hidden until at least one credential
                                exists, since BOLA needs a credentialed primary. */}
                            {authRecipes.length > 0 && (
                                <button
                                    type="button"
                                    onClick={() => setIdentitiesOpen((v) => !v)}
                                    title="Add more identities to test cross-user access (BOLA)"
                                    aria-expanded={identitiesOpen}
                                    className={`flex items-center gap-1.5 bg-white px-3 border text-[12px] font-mono transition-colors shrink-0 h-10 ${
                                        identitiesOpen || identityRows.length > 0
                                            ? "border-[#3b82f6] text-[#3b82f6]"
                                            : "border-[#e6e6e6] text-[#666] hover:border-black hover:text-black"
                                    }`}
                                >
                                    <Users size={13} />
                                    Identities
                                    {identityRows.length > 0 && (
                                        <span className="tabular-nums">
                                            {allIdentityRows.length}
                                        </span>
                                    )}
                                </button>
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
                                    className="flex-1 sm:flex-none justify-center bg-black text-white text-[13px] font-medium px-4 h-10 hover:bg-[#1a1a1a] transition-[background-color,transform] active:scale-[0.98] disabled:opacity-30 disabled:cursor-not-allowed disabled:active:scale-100 flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3b82f6] focus-visible:ring-offset-2 focus-visible:ring-offset-[#fafafa]"
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
                                        className="flex-1 sm:flex-none justify-center text-[#dc2626] text-[13px] font-medium px-4 h-10 border border-[#fca5a5] hover:bg-[#fef2f2] hover:border-[#dc2626] transition-colors active:scale-[0.98] disabled:opacity-40 flex items-center gap-2"
                                    >
                                        <Square size={11} />
                                        {aborting ? "Stopping…" : "Stop"}
                                    </button>
                                )}
                            </div>
                        </form>

                        {/* T13c — Identities panel. The PRIMARY identity uses the
                            credential picked in the toolbar above; extra identities
                            let Onyx replay one user's object ids as another user
                            (BOLA). Light-mono, compact, collapsed by default. */}
                        {identitiesOpen && authRecipes.length > 0 && (
                            <div className="border-b border-[#e6e6e6] bg-white px-4 sm:px-6 py-4">
                                <div className="flex items-center justify-between mb-3">
                                    <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#999]">
                                        Identities
                                    </p>
                                    <span className="font-mono text-[10px] text-[#999] tabular-nums">
                                        {allIdentityRows.length} / {MAX_IDENTITIES}
                                    </span>
                                </div>

                                <div className="flex flex-col gap-2">
                                    {/* Primary row — label fixed, credential mirrors the toolbar */}
                                    <div className="flex items-center gap-2">
                                        <span className="font-mono text-[10px] uppercase tracking-wide border border-[#93c5fd] text-[#3b82f6] px-1.5 py-0.5 shrink-0">
                                            Primary
                                        </span>
                                        <input
                                            value="User A"
                                            readOnly
                                            aria-label="Primary identity label"
                                            className="bg-[#fafafa] text-[#666] font-mono text-[12px] px-2.5 py-2 border border-[#e6e6e6] w-[120px] outline-none"
                                        />
                                        <select
                                            value={authRecipeId}
                                            onChange={(e) => setAuthRecipeId(e.target.value)}
                                            disabled={launching || isAttacking}
                                            aria-label="Primary identity credential"
                                            className="flex-1 min-w-0 bg-white text-[#333] font-mono text-[12px] px-2.5 py-2 border border-[#e6e6e6] focus:border-[#3b82f6] outline-none transition-colors disabled:opacity-50"
                                        >
                                            <option value="">Anonymous (no auth)</option>
                                            {authRecipes.map((r) => (
                                                <option key={r.id} value={r.id}>
                                                    {r.name} · {r.type}
                                                </option>
                                            ))}
                                        </select>
                                        <span className="w-7 shrink-0" aria-hidden="true" />
                                    </div>

                                    {/* Secondary identities */}
                                    {identityRows.map((row, i) => (
                                        <div key={row.key} className="flex items-center gap-2">
                                            <span className="font-mono text-[10px] uppercase tracking-wide border border-[#e6e6e6] text-[#999] px-1.5 py-0.5 shrink-0">
                                                {String.fromCharCode(66 + i)}
                                            </span>
                                            <input
                                                value={row.label}
                                                onChange={(e) =>
                                                    setIdentityRows((rows) =>
                                                        rows.map((r) =>
                                                            r.key === row.key
                                                                ? { ...r, label: e.target.value }
                                                                : r,
                                                        ),
                                                    )
                                                }
                                                maxLength={40}
                                                placeholder="Label"
                                                aria-label={`Identity ${i + 2} label`}
                                                disabled={launching || isAttacking}
                                                className="bg-white text-[#333] font-mono text-[12px] px-2.5 py-2 border border-[#e6e6e6] focus:border-[#3b82f6] outline-none transition-colors w-[120px] disabled:opacity-50"
                                            />
                                            <select
                                                value={row.authRecipeId}
                                                onChange={(e) =>
                                                    setIdentityRows((rows) =>
                                                        rows.map((r) =>
                                                            r.key === row.key
                                                                ? { ...r, authRecipeId: e.target.value }
                                                                : r,
                                                        ),
                                                    )
                                                }
                                                disabled={launching || isAttacking}
                                                aria-label={`Identity ${i + 2} credential`}
                                                className="flex-1 min-w-0 bg-white text-[#333] font-mono text-[12px] px-2.5 py-2 border border-[#e6e6e6] focus:border-[#3b82f6] outline-none transition-colors disabled:opacity-50"
                                            >
                                                <option value="">Anonymous (no auth)</option>
                                                {authRecipes.map((r) => (
                                                    <option key={r.id} value={r.id}>
                                                        {r.name} · {r.type}
                                                    </option>
                                                ))}
                                            </select>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setIdentityRows((rows) =>
                                                        rows.filter((r) => r.key !== row.key),
                                                    )
                                                }
                                                disabled={launching || isAttacking}
                                                aria-label={`Remove identity ${row.label || i + 2}`}
                                                className="w-7 h-7 shrink-0 flex items-center justify-center border border-[#e6e6e6] text-[#999] hover:text-[#dc2626] hover:border-[#fca5a5] transition-colors disabled:opacity-40"
                                            >
                                                <X size={12} />
                                            </button>
                                        </div>
                                    ))}
                                </div>

                                {/* Add + validation + BOLA hint */}
                                <div className="flex flex-wrap items-center gap-3 mt-3">
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setIdentityRows((rows) => [
                                                ...rows,
                                                newIdentityRow(rows.length + 1),
                                            ])
                                        }
                                        disabled={
                                            allIdentityRows.length >= MAX_IDENTITIES ||
                                            launching ||
                                            isAttacking
                                        }
                                        className="flex items-center gap-1.5 border border-[#e6e6e6] text-[#666] hover:border-black hover:text-black text-[12px] font-mono px-2.5 py-1.5 transition-colors disabled:opacity-40 disabled:hover:border-[#e6e6e6] disabled:hover:text-[#666]"
                                    >
                                        <Plus size={12} /> Add identity
                                    </button>

                                    {identityError && (
                                        <span className="text-[12px] text-[#dc2626]">
                                            {identityError}
                                        </span>
                                    )}
                                </div>

                                {/* BOLA hint — only once a credentialed primary + a
                                    second identity make cross-user testing possible. */}
                                {bolaEnabled && !identityError && (
                                    <p className="mt-3 flex items-start gap-2 text-[12px] text-[#3b82f6] leading-relaxed">
                                        <Users size={13} className="shrink-0 mt-0.5" aria-hidden="true" />
                                        BOLA testing enabled — Onyx will check whether one user
                                        can access another user&rsquo;s data.
                                    </p>
                                )}
                            </div>
                        )}

                        {/* Body — clean idle state OR live command center */}
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

// =============================================================================
// DashboardCommand — bento "mission control" body for the Dashboard.
// Two states:
//   IDLE   → focused, centered launch (no empty table to stare at)
//   ACTIVE → zonal bento: run-context + live security-score gauge (hero),
//            severity donut, latency sparkline, top-vulnerable endpoints,
//            and the live attack stream as ONE panel (not the whole page).
// Pure presentation: all data is passed in. Live security score is derived
// client-side using the same CVSS-deduction formula as the report.
// =============================================================================

import { lazy, Suspense, useMemo, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
    Area,
    AreaChart,
    ResponsiveContainer,
} from "recharts";
import {
    Crosshair,
    Radio,
    Terminal,
    Play,
    Square,
    ShieldCheck,
    Target,
} from "lucide-react";
import type { AttackLog } from "@/store/useAttackStore";
import { useCountUp } from "@/hooks/useCountUp";

// The WebGL gradient is heavy; load it lazily and mount it ONLY on the idle
// screen so it never competes with the live attack stream for frames.
const ShaderBackground = lazy(() => import("@/components/ShaderBackground"));

const TEAL = "#73bfc4";
const RED = "#ef4444";
const AMBER = "#ff810a";
const SLATE = "#8da0ce";

type ConnStatus = "connected" | "connecting" | "disconnected";
type RunStatus = "idle" | "attacking" | "completed";

interface Props {
    logs: AttackLog[];
    status: RunStatus;
    connectionStatus: ConnStatus;
    error: string | null;
    totalPayloads: number;
    criticalCount: number;
    blockedCount: number;
    infoCount: number;
    progressPct: number;
    targetUrl: string;
}

const fmtTime = (ts: number | string) => {
    const d = new Date(ts);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
};

const methodColor = (m: string) =>
    ({ GET: TEAL, POST: "#34d399", PUT: "#eab308", DELETE: RED, PATCH: "#a78bfa" } as Record<string, string>)[m] ?? "#a1a1aa";

const DashboardCommand = ({
    logs,
    status,
    connectionStatus,
    error,
    totalPayloads,
    criticalCount,
    blockedCount,
    infoCount,
    progressPct,
    targetUrl,
}: Props) => {
    const completed = logs.length;
    const live = connectionStatus === "connected";
    const reduce = useReducedMotion();

    // Smoothly tweened copies of the streaming counters so KPI numbers settle
    // instead of snapping as results land. tabular-nums (below) keeps width fixed.
    const completedCU = useCountUp(completed);
    const criticalCU = useCountUp(criticalCount);
    const blockedCU = useCountUp(blockedCount);
    const infoCU = useCountUp(Math.max(0, infoCount));

    // ---- Derived: live security score (same CVSS deductions as the report) ----
    const score = useMemo(() => {
        let s = 100 - criticalCount * 25 - blockedCount * 8;
        return Math.max(0, Math.min(100, s));
    }, [criticalCount, blockedCount]);

    const scoreCU = useCountUp(score);
    const scoreLabel =
        score >= 90 ? "CLEAN" : score >= 70 ? "LOW" : score >= 50 ? "MEDIUM" : score >= 25 ? "HIGH" : "CRITICAL";
    const scoreColor =
        score >= 90 ? TEAL : score >= 70 ? SLATE : score >= 50 ? AMBER : RED;

    // ---- Derived: severity donut data ----
    const sev = [
        { name: "Critical", value: criticalCount, color: RED },
        { name: "Warning", value: blockedCount, color: AMBER },
        { name: "Info", value: Math.max(0, infoCount), color: SLATE },
    ];
    const sevTotal = sev.reduce((a, b) => a + b.value, 0);

    // ---- Derived: latency sparkline (recent logs, chronological) ----
    const latencySeries = useMemo(
        () => [...logs].reverse().slice(-40).map((l, i) => ({ i, ms: l.latencyMs })),
        [logs],
    );
    const avgLatency = useMemo(
        () => (logs.length ? Math.round(logs.reduce((a, l) => a + (l.latencyMs || 0), 0) / logs.length) : 0),
        [logs],
    );

    // ---- Derived: top vulnerable endpoints (by # of >=400 responses) ----
    const topVuln = useMemo(() => {
        const map = new Map<string, { endpoint: string; hits: number; worst: number }>();
        for (const l of logs) {
            if (l.statusCode < 400) continue;
            const key = `${l.method} ${l.endpoint}`;
            const e = map.get(key) ?? { endpoint: key, hits: 0, worst: 0 };
            e.hits += 1;
            e.worst = Math.max(e.worst, l.statusCode);
            map.set(key, e);
        }
        return [...map.values()].sort((a, b) => b.worst - a.worst || b.hits - a.hits).slice(0, 5);
    }, [logs]);

    // ---- Per-log severity (for filter tabs + row tinting) ----
    const sevOf = (code: number): "critical" | "high" | "medium" | "low" | "info" => {
        if (code >= 500) return "critical";
        if (code === 401 || code === 403) return "high";
        if (code >= 400) return "medium";
        if (code >= 300) return "low";
        return "info";
    };

    const [filter, setFilter] = useState<"all" | "critical" | "high" | "medium" | "low" | "info">("all");

    const counts = useMemo(() => {
        const c = { all: logs.length, critical: 0, high: 0, medium: 0, low: 0, info: 0 };
        for (const l of logs) c[sevOf(l.statusCode)]++;
        return c;
    }, [logs]);

    const visibleLogs = useMemo(() => {
        const f = filter === "all" ? logs : logs.filter((l) => sevOf(l.statusCode) === filter);
        return f.slice(0, 200);
    }, [logs, filter]);

    // =======================================================================
    // IDLE — focused launch (handled by parent's form; here we show context)
    // The parent renders the launch form; this component renders the bento
    // only when there's an active/completed run OR logs exist.
    // =======================================================================
    const hasRun = status !== "idle" || logs.length > 0 || totalPayloads > 0;

    if (!hasRun) {
        return (
            <AnimatePresence mode="wait">
                <motion.div
                    key="idle"
                    initial={reduce ? false : { opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={reduce ? undefined : { opacity: 0, scale: 0.99 }}
                    transition={{ duration: 0.4, ease: [0.2, 0, 0, 1] }}
                    className="relative flex-1 flex flex-col items-center justify-center text-center min-h-[560px] overflow-hidden rounded-2xl bg-[#0B0C0D] shadow-[0_0_0_1px_rgba(255,255,255,0.07)]"
                >
                    {/* Live WebGL gradient — the real hero, not a blurred blob. Masked
                        at the edges so it reads as ambient light, not a photo. */}
                    <div className="absolute inset-0 z-0 opacity-70">
                        <Suspense fallback={<div className="absolute inset-0 bg-[#0B0C0D]" />}>
                            <ShaderBackground />
                        </Suspense>
                    </div>
                    {/* Scrims: darken center-out so text stays legible over the gradient */}
                    <div className="pointer-events-none absolute inset-0 z-[1] bg-[radial-gradient(ellipse_at_center,rgba(11,12,13,0.55)_0%,rgba(11,12,13,0.85)_60%,#0B0C0D_100%)]" />
                    <div className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-t from-[#0B0C0D] via-transparent to-[#0B0C0D]/60" />

                    <div className="relative z-10 flex flex-col items-center gap-7 max-w-lg px-6">
                        {/* Standby chip — states the mode plainly */}
                        <span className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[10.5px] font-['JetBrains_Mono'] uppercase tracking-[0.2em] text-[#73bfc4] bg-[#73bfc4]/[0.08] shadow-[inset_0_0_0_1px_rgba(115,191,196,0.25)]">
                            <span className="relative flex h-1.5 w-1.5">
                                <span className="absolute inline-flex h-full w-full rounded-full bg-[#73bfc4] opacity-60 motion-safe:animate-ping" />
                                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#73bfc4]" />
                            </span>
                            Standing by
                        </span>

                        {/* Headline — one accent word, Satoshi, tight */}
                        <div className="space-y-3">
                            <h2
                                className="text-[32px] sm:text-[40px] leading-[1.05] tracking-tight text-balance text-white"
                                style={{ fontFamily: '"Satoshi Variable", sans-serif', fontWeight: 500 }}
                            >
                                Your command center is{" "}
                                <span className="c5-text-gradient">armed.</span>
                            </h2>
                            <p className="text-[14.5px] leading-relaxed text-neutral-300/90 max-w-md mx-auto">
                                Drop in an OpenAPI or Swagger spec and hit execute. The live
                                security score, severity breakdown, and attack stream light up
                                here the moment the first payload fires.
                            </p>
                        </div>

                        {/* What lights up — quiet capability chips */}
                        <div className="flex flex-wrap items-center justify-center gap-2">
                            {[
                                { icon: ShieldCheck, t: "Live CVSS score" },
                                { icon: Crosshair, t: "Severity breakdown" },
                                { icon: Radio, t: "Streaming results" },
                                { icon: Target, t: "Top endpoints" },
                            ].map(({ icon: Ic, t }) => (
                                <span
                                    key={t}
                                    className="inline-flex items-center gap-1.5 text-[12px] text-neutral-200 rounded-full px-3 py-1.5 bg-white/[0.04] backdrop-blur-sm shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]"
                                >
                                    <Ic size={12} className="text-[#73bfc4]" />
                                    {t}
                                </span>
                            ))}
                        </div>
                    </div>
                </motion.div>
            </AnimatePresence>
        );
    }

    // =======================================================================
    // =======================================================================
    // ACTIVE — flat terminal command surface (dense, borderless)
    // =======================================================================
    const FILTERS: { key: typeof filter; label: string; n: number; color?: string }[] = [
        { key: "all", label: "ALL", n: counts.all },
        { key: "critical", label: "CRITICAL", n: counts.critical, color: RED },
        { key: "high", label: "HIGH", n: counts.high, color: AMBER },
        { key: "medium", label: "MEDIUM", n: counts.medium, color: "#d8b24a" },
        { key: "low", label: "LOW", n: counts.low, color: TEAL },
        { key: "info", label: "INFO", n: counts.info, color: SLATE },
    ];

    return (
        <motion.div
            key="active"
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.2, 0, 0, 1] }}
            className="flex flex-col rounded-2xl bg-[#0B0C0D] shadow-[0_0_0_1px_rgba(255,255,255,0.07)] overflow-hidden"
        >
            {/* ---- KPI strip: flat cells divided by hairlines ---- */}
            <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-white/[0.06]">
                {[
                    { icon: Crosshair, l: "Payloads Fired", node: (
                        <span className="tabular-nums text-white">{completedCU}<span className="text-neutral-600 text-sm"> / {totalPayloads}</span></span>
                    ), active: totalPayloads > 0 },
                    { icon: ShieldCheck, l: "Critical Failures", node: (
                        <span className="tabular-nums" style={{ color: criticalCount > 0 ? RED : "#71717a" }}>{criticalCU}
                            {criticalCount > 0 && <span className="ml-2 text-[9px] tracking-wider text-red-500/80 uppercase align-middle motion-safe:animate-pulse">vuln detected</span>}
                        </span>
                    ) },
                    { icon: Target, l: "Payloads Blocked", node: (
                        <span className="tabular-nums" style={{ color: blockedCount > 0 ? AMBER : "#71717a" }}>{blockedCU}</span>
                    ) },
                    { icon: Radio, l: "Info / Passed", node: (
                        <span className="tabular-nums text-neutral-500">{infoCU}</span>
                    ) },
                ].map((c, i) => {
                    const Ic = c.icon;
                    return (
                        <div key={i} className="relative px-4 sm:px-5 py-3.5">
                            <span className="flex items-center gap-2 text-neutral-600 text-[10px] font-['JetBrains_Mono'] uppercase tracking-[0.15em]">
                                <Ic size={11} /> {c.l}
                            </span>
                            <div className="mt-1.5 font-['JetBrains_Mono'] text-2xl leading-none">{c.node}</div>
                            {c.active && i === 0 && (
                                <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-white/[0.05]"><div className="onyx-progress-fill h-full" style={{ width: progressPct + "%", backgroundColor: TEAL }} /></div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* ---- Score + severity band + latency (one compact row) ---- */}
            <div className="flex flex-col lg:flex-row lg:items-center gap-4 px-4 sm:px-5 py-3 border-t border-white/[0.06] bg-[#080808]">
                {/* score chip */}
                <div className="flex items-center gap-2.5 shrink-0">
                    <span className="font-['Satoshi_Variable'] text-2xl tabular-nums leading-none transition-colors duration-300" style={{ color: scoreColor }}>{scoreCU}<span className="text-neutral-600 text-sm">/100</span></span>
                    <span className="font-['JetBrains_Mono'] text-[10px] tracking-wider px-1.5 py-0.5 rounded" style={{ color: scoreColor, backgroundColor: scoreColor + "1A" }}>{scoreLabel} RISK</span>
                </div>
                {/* severity bar + legend */}
                <div className="flex-1 min-w-0">
                    <div className="flex h-2 w-full overflow-hidden rounded-full bg-white/[0.05]">
                        {sevTotal === 0 ? <div className="h-full w-full" /> : sev.map((s) => s.value > 0 ? (
                            <div key={s.name} className="onyx-progress-fill h-full" style={{ width: (s.value / sevTotal) * 100 + "%", backgroundColor: s.color }} title={s.name + ": " + s.value} />
                        ) : null)}
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3.5 gap-y-1">
                        {sev.map((s) => (
                            <span key={s.name} className="flex items-center gap-1.5 text-[10.5px] font-['JetBrains_Mono'] text-neutral-500">
                                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: s.color, opacity: s.value ? 1 : 0.35 }} />
                                <span className="tabular-nums text-neutral-400">{s.value}</span> {s.name.toLowerCase()}
                            </span>
                        ))}
                    </div>
                </div>
                {/* avg latency */}
                <div className="shrink-0 text-right">
                    <span className="font-['JetBrains_Mono'] text-[10px] uppercase tracking-wider text-neutral-600">avg</span>
                    <span className="ml-1.5 font-['JetBrains_Mono'] text-sm tabular-nums text-neutral-300">{avgLatency}ms</span>
                </div>
            </div>

            {/* ---- Filter tabs ---- */}
            <div className="flex items-center gap-1 px-3 sm:px-4 py-2 border-t border-white/[0.06] overflow-x-auto">
                <span className="text-[10px] font-['JetBrains_Mono'] uppercase tracking-wider text-neutral-600 mr-1 shrink-0">Filter:</span>
                {FILTERS.map((t) => {
                    const on = filter === t.key;
                    return (
                        <button key={t.key} onClick={() => setFilter(t.key)}
                            className={"shrink-0 flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-['JetBrains_Mono'] tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#73bfc4]/60 " + (on ? "bg-white/[0.08] text-white" : "text-neutral-500 hover:text-neutral-300")}>
                            {t.color && <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: t.color, opacity: t.n ? 1 : 0.35 }} />}
                            {t.label} <span className="tabular-nums text-neutral-600">({t.n})</span>
                        </button>
                    );
                })}
            </div>

            {/* ---- Main: full-bleed dense table + slim right rail ---- */}
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_268px] border-t border-white/[0.06]">
                {/* table */}
                <div className="min-w-0 flex flex-col max-h-[560px]">
                    {/* column header */}
                    <div className="hidden md:grid grid-cols-[64px_56px_1fr_84px_54px_60px] gap-3 px-4 sm:px-5 py-2 bg-[#080808] border-b border-white/[0.06] font-['JetBrains_Mono'] text-[9.5px] text-neutral-600 uppercase tracking-[0.15em] sticky top-0">
                        <span>Time</span><span>Method</span><span>Endpoint</span><span>Severity</span><span>Status</span><span>Latency</span>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                        {error && <div className="mx-4 my-3 px-3 py-2 rounded-lg bg-red-500/5 text-red-400 text-[11px] font-['JetBrains_Mono'] shadow-[inset_0_0_0_1px_rgba(239,68,68,0.25)]">{error}</div>}
                        {visibleLogs.length === 0 && !error && (
                            <div className="flex flex-col items-center justify-center h-44 text-neutral-600 font-['JetBrains_Mono'] text-xs gap-3">
                                <div className="w-7 h-7 rounded-full border border-[#73bfc4]/50 flex items-center justify-center"><div className="w-2 h-2 bg-[#73bfc4] rounded-full motion-safe:animate-pulse" /></div>
                                <span>{filter === "all" ? "Awaiting first result…" : "No " + filter + " findings"}</span>
                            </div>
                        )}
                        {visibleLogs.map((log, i) => {
                            const sv = sevOf(log.statusCode);
                            const tint = sv === "critical" ? "bg-red-500/[0.05]" : sv === "high" ? "bg-[#ff810a]/[0.04]" : "";
                            const chip = { critical: RED, high: AMBER, medium: "#d8b24a", low: TEAL, info: SLATE }[sv];
                            return (
                                <div key={log.id} className={"md:grid md:grid-cols-[64px_56px_1fr_84px_54px_60px] gap-3 items-center px-4 sm:px-5 py-1.5 font-['JetBrains_Mono'] text-[12px] hover:bg-white/[0.025] transition-colors " + tint + (i === 0 ? " onyx-row-enter onyx-row-flash" : "")}>
                                    <span className="text-neutral-600 text-[10px] tabular-nums">{fmtTime(log.timestamp)}</span>
                                    <span className="font-semibold text-[11px]" style={{ color: methodColor(log.method) }}>{log.method}</span>
                                    <span className={"truncate " + (sv === "critical" ? "text-white" : "text-neutral-300")}>{log.endpoint}</span>
                                    <span><span className="text-[9px] font-bold tracking-wider rounded px-1.5 py-0.5" style={{ color: chip, backgroundColor: chip + "1A" }}>{sv.toUpperCase()}</span></span>
                                    <span className="tabular-nums text-neutral-500 text-[11px]">{log.statusCode || "ERR"}</span>
                                    <span className="tabular-nums text-neutral-600 text-[10px]">{log.latencyMs}ms</span>
                                </div>
                            );
                        })}
                    </div>
                    {/* footer */}
                    <div className="shrink-0 h-8 bg-[#080808] border-t border-white/[0.06] flex items-center justify-between px-4 sm:px-5 font-['JetBrains_Mono'] text-[10px] text-neutral-600">
                        <span>{completed} / {totalPayloads || "—"} results
                            {criticalCount > 0 && <span className="text-red-500/80 ml-2">● {criticalCount} critical</span>}
                            {blockedCount > 0 && <span className="text-[#ff810a]/80 ml-2">● {blockedCount} blocked</span>}
                        </span>
                        <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: live ? TEAL : "#3f3f46" }} />{live ? "Live" : "Disconnected"}</span>
                    </div>
                </div>

                {/* slim right rail: latency spark + top vulnerable endpoints */}
                <div className="border-t lg:border-t-0 lg:border-l border-white/[0.06] flex flex-col max-h-[560px]">
                    <div className="px-4 py-2.5 border-b border-white/[0.06]">
                        <span className="flex items-center gap-2 text-neutral-600 text-[10px] font-['JetBrains_Mono'] uppercase tracking-[0.15em]"><Radio size={11} /> Latency</span>
                        <div className="mt-1 h-9 -mx-1">
                            {latencySeries.length > 1 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={latencySeries} margin={{ top: 2, bottom: 0, left: 0, right: 0 }}>
                                        <defs><linearGradient id="latGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={TEAL} stopOpacity={0.35} /><stop offset="100%" stopColor={TEAL} stopOpacity={0} /></linearGradient></defs>
                                        <Area type="monotone" dataKey="ms" stroke={TEAL} strokeWidth={1.5} fill="url(#latGrad)" isAnimationActive={false} dot={false} />
                                    </AreaChart>
                                </ResponsiveContainer>
                            ) : <div className="h-full w-full rounded bg-white/[0.02]" />}
                        </div>
                    </div>
                    <div className="px-4 py-2.5 border-b border-white/[0.06]">
                        <span className="flex items-center gap-2 text-neutral-600 text-[10px] font-['JetBrains_Mono'] uppercase tracking-[0.15em]"><Target size={11} /> Top Vulnerable</span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
                        {topVuln.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-32 text-neutral-700 text-[11px] gap-2"><ShieldCheck size={18} className="text-neutral-800" /><span>No failures yet</span></div>
                        ) : topVuln.map((e) => {
                            const c = e.worst >= 500 ? RED : AMBER;
                            return (
                                <div key={e.endpoint} className="rounded-lg bg-white/[0.02] px-2.5 py-2 hover:bg-white/[0.04] transition-colors">
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="font-['JetBrains_Mono'] text-[11px] text-neutral-300 truncate">{e.endpoint}</span>
                                        <span className="font-['JetBrains_Mono'] text-[8.5px] font-bold tracking-wider rounded px-1 py-0.5 shrink-0" style={{ color: c, backgroundColor: c + "1A" }}>{e.worst >= 500 ? "CRIT" : "WARN"}</span>
                                    </div>
                                    <div className="mt-0.5 text-[9.5px] font-['JetBrains_Mono'] text-neutral-600 tabular-nums">{e.hits} {e.hits === 1 ? "hit" : "hits"} · worst {e.worst}</div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </motion.div>
    );
};

export default DashboardCommand;
// Re-exported icons so the parent launch form can reuse them if needed.
export { Play, Square, Terminal };

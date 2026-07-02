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

import { useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
    Area,
    AreaChart,
    ResponsiveContainer,
} from "recharts";
// Phosphor line icons (matches the landing page's icon family). Muted, thin.
import {
    Crosshair,
    Broadcast,
    ShieldCheck,
    Target,
    ArrowRight,
} from "@phosphor-icons/react";
// Launch-form icons re-exported to the parent stay on lucide (its button context).
import { Play, Square, Terminal } from "lucide-react";
import type { AttackLog } from "@/store/useAttackStore";
import { useCountUp } from "@/hooks/useCountUp";

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
        return <IdleCommandCenter reduce={reduce} />;
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
            className="flex flex-col flex-1 overflow-hidden"
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
                    { icon: Broadcast, l: "Info / Passed", node: (
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
                        <span className="flex items-center gap-2 text-neutral-600 text-[10px] font-['JetBrains_Mono'] uppercase tracking-[0.15em]"><Broadcast size={11} /> Latency</span>
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

// ===========================================================================
// IdleCommandCenter — "Ghost Command Center" empty state.
//
// Design language (grounded in how premium dev-tools do empty states — Linear,
// Vercel Geist, Sentry): near-black canvas, 1px hairline borders (white @ ~8%),
// depth from surface tint not shadow, 6-8px radii, ONE rationed accent (brand
// teal, desaturated, on the primary button + live dot only), NO gradient text,
// NO glow blobs. The real dashboard is rendered as a dimmed, non-interactive
// skeleton so the user sees exactly what will appear, with a single left-biased
// "Launch scan" card floating over it.
// ===========================================================================

const GHOST_TILES = [
    { label: "Targets", icon: Target },
    { label: "Critical", icon: ShieldCheck },
    { label: "High", icon: Crosshair },
    { label: "Findings", icon: Broadcast },
];

const GHOST_COLS = ["Severity", "Endpoint", "Status", "Latency"];

function IdleCommandCenter({ reduce }: { reduce: boolean | null }) {
    return (
        <motion.div
            key="idle"
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.35, ease: [0.2, 0, 0, 1] }}
            className="relative overflow-hidden"
        >
            {/* ---- Ghost skeleton of the real dashboard (dimmed, inert) ---- */}
            <div
                aria-hidden="true"
                className="pointer-events-none select-none opacity-[0.32] h-full"
            >
                {/* Zero-value metric tiles */}
                <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-white/[0.06] border-b border-white/[0.06]">
                    {GHOST_TILES.map(({ label, icon: Ic }) => (
                        <div key={label} className="px-5 py-4">
                            <span className="flex items-center gap-2 text-neutral-600 text-[10px] font-['JetBrains_Mono'] uppercase tracking-[0.15em]">
                                <Ic size={12} weight="regular" /> {label}
                            </span>
                            <div className="mt-2 font-['JetBrains_Mono'] text-2xl leading-none text-neutral-700 tabular-nums">
                                0
                            </div>
                        </div>
                    ))}
                </div>

                {/* Two-column body mirroring the live layout: findings table + rail */}
                <div className="grid grid-cols-1 lg:grid-cols-[1fr_268px]">
                    {/* Findings table: real column headers + skeleton rows */}
                    <div className="lg:border-r border-white/[0.06]">
                        <div className="grid grid-cols-[90px_1fr_70px_72px] gap-4 px-5 py-2.5 border-b border-white/[0.06] font-['JetBrains_Mono'] text-[9.5px] text-neutral-600 uppercase tracking-[0.15em]">
                            {GHOST_COLS.map((c) => (
                                <span key={c}>{c}</span>
                            ))}
                        </div>
                        {Array.from({ length: 8 }).map((_, i) => (
                            <div
                                key={i}
                                className="grid grid-cols-[90px_1fr_70px_72px] gap-4 items-center px-5 py-[11px] border-b border-white/[0.03]"
                            >
                                <span className="h-3 w-14 rounded-sm bg-white/[0.05]" />
                                <span className="h-3 rounded-sm bg-white/[0.05]" style={{ width: `${62 - i * 5}%` }} />
                                <span className="h-3 w-8 rounded-sm bg-white/[0.05]" />
                                <span className="h-3 w-10 rounded-sm bg-white/[0.04]" />
                            </div>
                        ))}
                    </div>
                    {/* Right rail: latency + top endpoints (headers + skeleton) */}
                    <div className="hidden lg:block">
                        <div className="px-4 py-2.5 border-b border-white/[0.06]">
                            <span className="flex items-center gap-2 text-neutral-600 text-[10px] font-['JetBrains_Mono'] uppercase tracking-[0.15em]">
                                <Broadcast size={11} /> Latency
                            </span>
                            <div className="mt-2 h-9 rounded bg-white/[0.03]" />
                        </div>
                        <div className="px-4 py-2.5 border-b border-white/[0.06]">
                            <span className="flex items-center gap-2 text-neutral-600 text-[10px] font-['JetBrains_Mono'] uppercase tracking-[0.15em]">
                                <Target size={11} /> Top Vulnerable
                            </span>
                        </div>
                        <div className="p-2 space-y-1.5">
                            {Array.from({ length: 4 }).map((_, i) => (
                                <div key={i} className="rounded bg-white/[0.02] px-2.5 py-2.5">
                                    <span className="block h-3 rounded-sm bg-white/[0.05]" style={{ width: `${70 - i * 8}%` }} />
                                    <span className="mt-1.5 block h-2 w-12 rounded-sm bg-white/[0.03]" />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Fade the ghost out toward the bottom so the skeleton reads as
                "preview", not real content. */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#0C0D0E] to-transparent" />

            {/* ---- Launch card: left-biased, single focused action ---- */}
            <div className="absolute inset-0 flex items-center justify-center lg:justify-start px-6 sm:px-10 lg:pl-16">
                <div className="w-full max-w-[400px] rounded-lg bg-[#141516] p-7 shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_24px_60px_-20px_rgba(0,0,0,0.7)]">
                    {/* Muted line icon in a quiet container */}
                    <span className="inline-grid place-items-center h-11 w-11 rounded-md bg-white/[0.04] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.07)]">
                        <Crosshair size={22} weight="regular" className="text-neutral-400" />
                    </span>

                    <h2 className="mt-5 text-[22px] leading-tight tracking-[-0.02em] text-neutral-100 font-semibold">
                        No active scans
                    </h2>
                    <p className="mt-2 text-[13.5px] leading-relaxed text-neutral-400 max-w-[42ch]">
                        Point Onyx at an OpenAPI or Swagger spec and launch a run. Live
                        findings, severity, and per-endpoint results populate this console
                        as each payload fires.
                    </p>

                    {/* One primary action. Scrolls focus to the launch input above. */}
                    <button
                        type="button"
                        onClick={() => {
                            const el = document.querySelector<HTMLInputElement>('input[type="url"]');
                            el?.focus();
                            el?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
                        }}
                        className="group mt-6 inline-flex items-center gap-2 rounded-md bg-[#5fb3b8] px-4 h-10 text-[13px] font-semibold text-[#06181a] hover:bg-[#6cc0c5] transition-colors active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5fb3b8]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#141516]"
                    >
                        Launch a scan
                        <ArrowRight
                            size={15}
                            weight="bold"
                            className="transition-transform duration-200 group-hover:translate-x-0.5"
                        />
                    </button>

                    {/* Quiet capability line — no chips, just muted supporting copy */}
                    <div className="mt-6 flex items-center gap-3 text-[11px] text-neutral-600 font-['JetBrains_Mono'] whitespace-nowrap">
                        <span className="flex items-center gap-1.5">
                            <span className="h-1 w-1 rounded-full bg-[#5fb3b8]" />
                            CVSS
                        </span>
                        <span className="text-neutral-700">/</span>
                        <span>Severity</span>
                        <span className="text-neutral-700">/</span>
                        <span>Live stream</span>
                    </div>
                </div>
            </div>
        </motion.div>
    );
}

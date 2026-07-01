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

import { useMemo } from "react";
import {
    Area,
    AreaChart,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
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

const panel =
    "relative overflow-hidden rounded-2xl bg-[#0B0C0D] shadow-[0_0_0_1px_rgba(255,255,255,0.07)]";
const label =
    "flex items-center gap-2 text-neutral-500 text-[10px] font-['JetBrains_Mono'] uppercase tracking-[0.15em]";

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

    // ---- Derived: live security score (same CVSS deductions as the report) ----
    const score = useMemo(() => {
        let s = 100 - criticalCount * 25 - blockedCount * 8;
        return Math.max(0, Math.min(100, s));
    }, [criticalCount, blockedCount]);

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

    const visibleLogs = useMemo(() => logs.slice(0, 120), [logs]);

    // =======================================================================
    // IDLE — focused launch (handled by parent's form; here we show context)
    // The parent renders the launch form; this component renders the bento
    // only when there's an active/completed run OR logs exist.
    // =======================================================================
    const hasRun = status !== "idle" || logs.length > 0 || totalPayloads > 0;

    if (!hasRun) {
        return (
            <div className="relative flex-1 flex flex-col items-center justify-center text-center py-16 overflow-hidden">
                {/* Landing-matched animated gradient glow */}
                <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[520px] w-[520px] rounded-full c5-animated-gradient opacity-[0.14] blur-[90px]" />
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_30%,#080808_75%)]" />

                <div className="relative z-10 flex flex-col items-center gap-6 max-w-md">
                    {/* Pulsing radar target inside an animated gradient-border ring */}
                    <div className="onyx-gradient-border rounded-3xl" style={{ ["--gb-w" as string]: "1.5px" }}>
                        <span className="relative flex items-center justify-center w-20 h-20 rounded-3xl bg-[#0B0C0D]">
                            <span className="absolute inline-flex h-12 w-12 rounded-full border border-[#73bfc4]/40 motion-safe:animate-ping" />
                            <Target size={30} className="text-[#73bfc4]" />
                        </span>
                    </div>

                    {/* Gradient-text headline (same moving hero gradient as landing) */}
                    <div>
                        <h2
                            className="text-[26px] sm:text-[30px] leading-tight tracking-tight"
                            style={{ fontFamily: '"Satoshi Variable", sans-serif', fontWeight: 500 }}
                        >
                            <span className="text-white">Your command center is </span>
                            <span className="c5-text-gradient">armed.</span>
                        </h2>
                        <p className="mt-3 text-[14px] leading-relaxed text-neutral-400">
                            Paste an OpenAPI or Swagger spec above and execute a run.
                            A live security score, severity breakdown, and the attack
                            stream light up here the moment it starts.
                        </p>
                    </div>

                    {/* What lights up — preview chips so the space feels designed */}
                    <div className="flex flex-wrap items-center justify-center gap-2 mt-1">
                        {[
                            { icon: ShieldCheck, t: "Live CVSS score" },
                            { icon: Crosshair, t: "Severity breakdown" },
                            { icon: Radio, t: "Streaming results" },
                            { icon: Target, t: "Top vulnerable endpoints" },
                        ].map(({ icon: Ic, t }) => (
                            <span
                                key={t}
                                className="inline-flex items-center gap-1.5 text-[12px] text-neutral-400 rounded-full px-3 py-1.5 bg-white/[0.03] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]"
                            >
                                <Ic size={12} className="text-[#73bfc4]" />
                                {t}
                            </span>
                        ))}
                    </div>
                </div>

                {/* Ghost preview of the bento zones (very faint) so the page has structure */}
                <div className="relative z-10 mt-14 w-full max-w-4xl grid grid-cols-3 gap-3 opacity-[0.35]" aria-hidden="true">
                    {["Security Posture", "Findings", "Avg Latency"].map((t) => (
                        <div key={t} className={`${panel} h-20 p-4`}>
                            <span className={label}>{t}</span>
                            <div className="mt-3 h-2 w-2/3 rounded-full bg-white/[0.05]" />
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    // =======================================================================
    // ACTIVE — bento command center
    // =======================================================================
    return (
        <div className="flex flex-col gap-3">
            {/* Top zone: hero score + severity donut + latency */}
            <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr_1fr] gap-3">
                {/* Hero — target + live security score */}
                <div className={`${panel} p-5`}>
                    <span className={label}>
                        <ShieldCheck size={11} />
                        Security Posture
                    </span>
                    <div className="mt-4 flex items-center gap-5">
                        {/* radial score gauge */}
                        <div className="relative shrink-0" style={{ width: 104, height: 104 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={[{ v: score }, { v: 100 - score }]}
                                        dataKey="v"
                                        innerRadius={40}
                                        outerRadius={50}
                                        startAngle={90}
                                        endAngle={-270}
                                        stroke="none"
                                        isAnimationActive={false}
                                    >
                                        <Cell fill={scoreColor} />
                                        <Cell fill="rgba(255,255,255,0.06)" />
                                    </Pie>
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <span
                                    className="font-['Satoshi_Variable'] text-[28px] leading-none tabular-nums"
                                    style={{ color: scoreColor }}
                                >
                                    {score}
                                </span>
                                <span className="text-[9px] font-['JetBrains_Mono'] tracking-widest text-neutral-600 mt-0.5">
                                    /100
                                </span>
                            </div>
                        </div>
                        <div className="min-w-0">
                            <div
                                className="font-['JetBrains_Mono'] text-[11px] tracking-wider px-2 py-1 rounded-md inline-block"
                                style={{ color: scoreColor, backgroundColor: `${scoreColor}1A` }}
                            >
                                {scoreLabel}
                            </div>
                            <p className="mt-2 font-['JetBrains_Mono'] text-[12px] text-neutral-400 truncate max-w-[280px]">
                                {targetUrl || "—"}
                            </p>
                            <p className="mt-1 text-[11px] text-neutral-600">
                                {completed} of {totalPayloads || "—"} payloads · {progressPct}%
                            </p>
                        </div>
                    </div>
                    {totalPayloads > 0 && (
                        <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-white/[0.05]">
                            <div className="h-full transition-all duration-300" style={{ width: `${progressPct}%`, backgroundColor: scoreColor }} />
                        </div>
                    )}
                </div>

                {/* Severity donut */}
                <div className={`${panel} p-5`}>
                    <span className={label}>
                        <Crosshair size={11} />
                        Findings
                    </span>
                    <div className="mt-2 flex items-center gap-3">
                        <div className="relative shrink-0" style={{ width: 76, height: 76 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={sevTotal === 0 ? [{ v: 1 }] : sev.map((x) => ({ v: x.value }))}
                                        dataKey="v"
                                        innerRadius={26}
                                        outerRadius={37}
                                        stroke="none"
                                        isAnimationActive={false}
                                    >
                                        {sevTotal === 0 ? (
                                            <Cell fill="rgba(255,255,255,0.06)" />
                                        ) : (
                                            sev.map((x) => <Cell key={x.name} fill={x.color} />)
                                        )}
                                    </Pie>
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="absolute inset-0 flex items-center justify-center">
                                <span className="font-['JetBrains_Mono'] text-[15px] text-white tabular-nums">
                                    {criticalCount + blockedCount}
                                </span>
                            </div>
                        </div>
                        <div className="flex flex-col gap-1.5">
                            {sev.map((x) => (
                                <span key={x.name} className="flex items-center gap-1.5 text-[11px] font-['JetBrains_Mono'] text-neutral-400">
                                    <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: x.color, opacity: x.value ? 1 : 0.3 }} />
                                    {x.name}
                                    <span className="tabular-nums text-neutral-500">{x.value}</span>
                                </span>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Latency */}
                <div className={`${panel} p-5`}>
                    <span className={label}>
                        <Radio size={11} />
                        Avg Latency
                    </span>
                    <div className="mt-2 flex items-baseline gap-1">
                        <span className="font-['JetBrains_Mono'] text-2xl text-white tabular-nums">{avgLatency}</span>
                        <span className="font-['JetBrains_Mono'] text-xs text-neutral-600">ms</span>
                    </div>
                    <div className="mt-2 h-9 -mx-1">
                        {latencySeries.length > 1 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={latencySeries} margin={{ top: 2, bottom: 0, left: 0, right: 0 }}>
                                    <defs>
                                        <linearGradient id="latGrad" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor={TEAL} stopOpacity={0.35} />
                                            <stop offset="100%" stopColor={TEAL} stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <Area type="monotone" dataKey="ms" stroke={TEAL} strokeWidth={1.5} fill="url(#latGrad)" isAnimationActive={false} dot={false} />
                                </AreaChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full w-full rounded bg-white/[0.02]" />
                        )}
                    </div>
                </div>
            </div>

            {/* Bottom zone: live stream (2/3) + top vulnerable endpoints (1/3) */}
            <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-3">
                {/* Live stream panel */}
                <section className={`${panel} flex flex-col min-h-[360px] max-h-[460px]`}>
                    <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
                        <span className={label}>
                            <Radio size={12} />
                            Live Attack Stream
                        </span>
                        <span className="flex items-center gap-1.5 text-[10px] font-['JetBrains_Mono'] text-neutral-600">
                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: live ? TEAL : "#3f3f46" }} />
                            {live ? "Connected" : "Disconnected"}
                        </span>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                        {error && (
                            <div className="mx-4 mt-3 px-3 py-2.5 rounded-lg border border-red-500/30 bg-red-500/5 text-red-400 text-[11px] font-['JetBrains_Mono']">
                                {error}
                            </div>
                        )}
                        {visibleLogs.length === 0 && !error && (
                            <div className="flex flex-col items-center justify-center h-48 text-neutral-700 font-['JetBrains_Mono'] text-xs gap-3">
                                <div className="w-7 h-7 border border-[#73bfc4]/50 rounded-full flex items-center justify-center">
                                    <div className="w-2 h-2 bg-[#73bfc4] rounded-full motion-safe:animate-pulse" />
                                </div>
                                <span className="text-neutral-500">Awaiting first result…</span>
                            </div>
                        )}
                        {visibleLogs.map((log, i) => {
                            const crit = log.statusCode >= 500;
                            const warn = log.statusCode >= 400 && log.statusCode < 500;
                            return (
                                <div
                                    key={log.id}
                                    className={`flex items-center gap-3 px-4 py-2 border-b border-white/[0.05] font-['JetBrains_Mono'] text-[12px] hover:bg-white/[0.02] transition-colors ${i === 0 ? "onyx-row-enter" : ""} ${crit ? "border-l-2 border-l-red-500 bg-red-500/[0.04]" : warn ? "border-l-2 border-l-[#ff810a]/50 bg-[#ff810a]/[0.03]" : ""}`}
                                >
                                    <span className="text-neutral-600 text-[10px] tabular-nums shrink-0 w-[52px]">{fmtTime(log.timestamp)}</span>
                                    <span className="font-semibold shrink-0 w-[46px]" style={{ color: methodColor(log.method) }}>{log.method}</span>
                                    <span className={`truncate flex-1 ${crit ? "text-white" : "text-neutral-300"}`}>{log.endpoint}</span>
                                    <span className="tabular-nums text-neutral-500 shrink-0 w-8 text-right">{log.statusCode || "ERR"}</span>
                                    <span className="tabular-nums text-neutral-600 text-[10px] shrink-0 w-[52px] text-right">{log.latencyMs}ms</span>
                                </div>
                            );
                        })}
                    </div>
                </section>

                {/* Top vulnerable endpoints */}
                <section className={`${panel} flex flex-col min-h-[360px] max-h-[460px]`}>
                    <div className="shrink-0 px-4 py-3 border-b border-white/[0.06]">
                        <span className={label}>
                            <Target size={12} />
                            Top Vulnerable Endpoints
                        </span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-3 space-y-2">
                        {topVuln.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-40 text-neutral-700 text-[11px] gap-2">
                                <ShieldCheck size={20} className="text-neutral-800" />
                                <span>No failures yet</span>
                            </div>
                        ) : (
                            topVuln.map((e) => {
                                const crit = e.worst >= 500;
                                const c = crit ? RED : AMBER;
                                return (
                                    <div key={e.endpoint} className="rounded-xl bg-white/[0.025] px-3 py-2.5 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)]">
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="font-['JetBrains_Mono'] text-[11.5px] text-neutral-300 truncate">{e.endpoint}</span>
                                            <span className="font-['JetBrains_Mono'] text-[9px] font-bold tracking-wider rounded px-1.5 py-0.5 shrink-0" style={{ color: c, backgroundColor: `${c}1A` }}>
                                                {crit ? "CRIT" : "WARN"}
                                            </span>
                                        </div>
                                        <div className="mt-1 flex items-center gap-2 text-[10px] font-['JetBrains_Mono'] text-neutral-600">
                                            <span className="tabular-nums">{e.hits} {e.hits === 1 ? "hit" : "hits"}</span>
                                            <span className="text-neutral-700">·</span>
                                            <span className="tabular-nums">worst {e.worst}</span>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </section>
            </div>
        </div>
    );
};

export default DashboardCommand;
// Re-exported icons so the parent launch form can reuse them if needed.
export { Play, Square, Terminal };

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
import { Play, Square, Terminal, Gauge, ChevronDown } from "lucide-react";
import type { AttackLog } from "@/store/useAttackStore";
import { useCountUp } from "@/hooks/useCountUp";
import FindingDetailPanel from "@/components/FindingDetailPanel";

// Light-mono palette — single blue accent + shared severity semantics.
const ACCENT = "#3b82f6";
const RED = "#dc2626";
const AMBER = "#ea580c";
const MED = "#ca8a04";
const GREEN = "#16a34a";
const SLATE = "#64748b";

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
    ({ GET: ACCENT, POST: GREEN, PUT: MED, DELETE: RED, PATCH: "#7c3aed" } as Record<string, string>)[m] ?? "#666";

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
        score >= 90 ? GREEN : score >= 70 ? ACCENT : score >= 50 ? AMBER : RED;

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

    type SevKey = "critical" | "high" | "medium" | "low" | "info";

    // Fallback severity from status code, used only when the server hasn't
    // attached an analyzed finding yet.
    const sevOfCode = (code: number): SevKey => {
        if (code >= 500) return "critical";
        if (code === 401 || code === 403) return "high";
        if (code >= 400) return "medium";
        if (code >= 300) return "low";
        return "info";
    };

    // The authoritative per-row severity: prefer the analyzed finding (which
    // catches a confirmed CRITICAL auth-bypass or HIGH reflected-XSS on a 200
    // that a status-code-only rule would miss), else fall back to the status.
    const sevOf = (log: AttackLog): SevKey =>
        (log.finding?.severity?.toLowerCase() as SevKey | undefined) ??
        sevOfCode(log.statusCode);

    const [filter, setFilter] = useState<"all" | "critical" | "high" | "medium" | "low" | "info">("all");
    const [expandedId, setExpandedId] = useState<string | null>(null);

    const counts = useMemo(() => {
        const c = { all: logs.length, critical: 0, high: 0, medium: 0, low: 0, info: 0 };
        for (const l of logs) c[sevOf(l)]++;
        return c;
    }, [logs]);

    const visibleLogs = useMemo(() => {
        const f = filter === "all" ? logs : logs.filter((l) => sevOf(l) === filter);
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
        { key: "medium", label: "MEDIUM", n: counts.medium, color: MED },
        { key: "low", label: "LOW", n: counts.low, color: ACCENT },
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
            <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-[#e6e6e6]">
                {[
                    { icon: Crosshair, l: "Payloads Fired", node: (
                        <span className="tabular-nums text-black">{completedCU}<span className="text-[#999] text-sm"> / {totalPayloads}</span></span>
                    ), active: totalPayloads > 0 },
                    { icon: ShieldCheck, l: "Critical Failures", node: (
                        <span className="tabular-nums" style={{ color: criticalCount > 0 ? RED : "#999" }}>{criticalCU}
                            {criticalCount > 0 && <span className="ml-2 text-[9px] tracking-wider uppercase align-middle motion-safe:animate-pulse" style={{ color: RED }}>vuln detected</span>}
                        </span>
                    ) },
                    { icon: Target, l: "Payloads Blocked", node: (
                        <span className="tabular-nums" style={{ color: blockedCount > 0 ? AMBER : "#999" }}>{blockedCU}</span>
                    ) },
                    { icon: Broadcast, l: "Info / Passed", node: (
                        <span className="tabular-nums" style={{ color: infoCount > 0 ? GREEN : "#999" }}>{infoCU}</span>
                    ) },
                ].map((c, i) => {
                    const Ic = c.icon;
                    return (
                        <div key={i} className="relative px-4 sm:px-5 py-3.5">
                            <span className="flex items-center gap-2 text-[#999] text-[10px] font-mono uppercase tracking-[0.15em]">
                                <Ic size={11} /> {c.l}
                            </span>
                            <div className="mt-1.5 font-mono text-2xl leading-none">{c.node}</div>
                            {c.active && i === 0 && (
                                <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#e6e6e6]"><div className="onyx-progress-fill h-full" style={{ width: progressPct + "%", backgroundColor: ACCENT }} /></div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* ---- Score + breakdown bar (mirrors the Report page) ---- */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 px-4 sm:px-5 py-3 border-t border-[#e6e6e6] bg-[#fafafa]">
                {/* Score pill */}
                <div
                    className="flex items-baseline gap-1.5 px-4 py-2.5 bg-white border shrink-0"
                    style={{ backgroundColor: scoreColor + "0f", borderColor: scoreColor + "40" }}
                >
                    <span className="text-4xl font-bold font-mono tabular-nums transition-colors duration-300" style={{ color: scoreColor }}>{scoreCU}</span>
                    <span className="text-[#999] text-lg font-mono">/100</span>
                    <div className="ml-2 flex flex-col justify-center">
                        <Gauge size={14} style={{ color: scoreColor }} />
                    </div>
                    <div className="ml-1 flex flex-col">
                        <span className="text-[9px] font-bold font-mono uppercase tracking-widest" style={{ color: scoreColor }}>
                            {scoreLabel === "CLEAN" ? "CLEAN" : `${scoreLabel} RISK`}
                        </span>
                        <span className="text-[9px] text-[#999] font-mono uppercase tracking-wider">Security Score</span>
                    </div>
                </div>

                {/* Breakdown bar + counts (5 severity levels, from live counts) */}
                <div className="flex-1 flex flex-col gap-2 min-w-0 w-full">
                    {(() => {
                        const segs = [
                            { key: "critical", label: "critical", n: counts.critical, c: RED },
                            { key: "high", label: "high", n: counts.high, c: AMBER },
                            { key: "medium", label: "medium", n: counts.medium, c: MED },
                            { key: "low", label: "low", n: counts.low, c: ACCENT },
                            { key: "info", label: "info", n: counts.info, c: SLATE },
                        ];
                        const total = segs.reduce((a, s) => a + s.n, 0);
                        return (
                            <>
                                <div className="flex h-2 w-full overflow-hidden bg-[#f0f0f0]">
                                    {total > 0 && segs.map((s) => s.n > 0 ? (
                                        <div key={s.key} className="onyx-progress-fill h-full" style={{ width: (s.n / total) * 100 + "%", backgroundColor: s.c }} title={`${s.label}: ${s.n}`} />
                                    ) : null)}
                                </div>
                                <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1 font-mono text-[11px]">
                                    {segs.map((s) => (
                                        <span key={s.key} className="flex items-center gap-1.5">
                                            <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: s.c, opacity: s.n ? 1 : 0.3 }} />
                                            <span className="text-[#666]"><span className="tabular-nums text-[#333]">{s.n}</span> {s.label}</span>
                                        </span>
                                    ))}
                                    <span className="ml-auto text-[10px] text-[#999] tabular-nums">avg {avgLatency}ms</span>
                                </div>
                            </>
                        );
                    })()}
                </div>
            </div>

            {/* ---- Filter tabs ---- */}
            <div className="flex items-center gap-1 px-3 sm:px-4 py-2 border-t border-[#e6e6e6] overflow-x-auto">
                <span className="text-[10px] font-mono uppercase tracking-wider text-[#999] mr-1 shrink-0">Filter:</span>
                {FILTERS.map((t) => {
                    const on = filter === t.key;
                    return (
                        <button key={t.key} onClick={() => setFilter(t.key)}
                            className={"shrink-0 flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-mono tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#3b82f6]/60 " + (on ? "bg-black text-white" : "text-[#666] hover:bg-[#f0f0f0]")}>
                            {t.color && <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: t.color, opacity: t.n ? 1 : 0.35 }} />}
                            {t.label} <span className={"tabular-nums " + (on ? "text-white/60" : "text-[#999]")}>({t.n})</span>
                        </button>
                    );
                })}
            </div>

            {/* ---- Main: full-bleed dense table + slim right rail ---- */}
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_268px] border-t border-[#e6e6e6]">
                {/* table */}
                <div className="min-w-0 flex flex-col max-h-[560px] bg-white">
                    {/* column header */}
                    <div className="hidden md:grid grid-cols-[64px_56px_1fr_84px_54px_72px] gap-3 px-4 sm:px-5 py-2 bg-[#fafafa] border-b border-[#e6e6e6] font-mono text-[9.5px] text-[#999] uppercase tracking-[0.15em] sticky top-0 z-10">
                        <span>Time</span><span>Method</span><span>Endpoint</span><span>Severity</span><span>Status</span><span>Latency</span>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                        {error && <div className="mx-4 my-3 px-3 py-2 border border-[#fca5a5] bg-[#fef2f2] text-[#dc2626] text-[11px] font-mono">{error}</div>}
                        {visibleLogs.length === 0 && !error && (
                            <div className="flex flex-col items-center justify-center h-44 text-[#999] font-mono text-xs gap-3">
                                <div className="w-7 h-7 rounded-full border border-[#93c5fd] flex items-center justify-center"><div className="w-2 h-2 bg-[#3b82f6] rounded-full motion-safe:animate-pulse" /></div>
                                <span>{filter === "all" ? "Awaiting first result…" : "No " + filter + " findings"}</span>
                            </div>
                        )}
                        {visibleLogs.map((log, i) => {
                            const sv = sevOf(log);
                            const tint = sv === "critical" ? "bg-[#fef2f2]" : sv === "high" ? "bg-[#fff7ed]" : "";
                            const chip = { critical: RED, high: AMBER, medium: MED, low: ACCENT, info: SLATE }[sv];
                            const isOpen = expandedId === log.id;
                            return (
                                <div key={log.id}>
                                    <div
                                        onClick={() => setExpandedId(isOpen ? null : log.id)}
                                        className={"md:grid md:grid-cols-[64px_56px_1fr_84px_54px_72px] gap-3 items-center px-4 sm:px-5 py-1.5 border-b border-[#e6e6e6] font-mono text-[12px] hover:bg-black/[0.02] transition-colors cursor-pointer " + tint + (i === 0 ? " onyx-row-enter onyx-row-flash" : "")}
                                    >
                                        <span className="text-[#999] text-[10px] tabular-nums">{fmtTime(log.timestamp)}</span>
                                        <span className="font-semibold text-[11px]" style={{ color: methodColor(log.method) }}>{log.method}</span>
                                        <span className={"truncate " + (sv === "critical" ? "text-black" : "text-[#333]")}>{log.endpoint}</span>
                                        <span><span className="text-[9px] font-bold tracking-wider px-1.5 py-0.5 border" style={{ color: chip, backgroundColor: chip + "12", borderColor: chip + "40" }}>{sv.toUpperCase()}</span></span>
                                        <span className="tabular-nums text-[#666] text-[11px]">{log.statusCode || "ERR"}</span>
                                        <span className="flex items-center gap-1 tabular-nums text-[#999] text-[10px]">
                                            {log.latencyMs}ms
                                            <ChevronDown size={12} className={"shrink-0 text-[#ccc] transition-transform " + (isOpen ? "rotate-180 text-[#666]" : "")} />
                                        </span>
                                    </div>
                                    {isOpen && log.finding && (
                                        <FindingDetailPanel
                                            finding={log.finding}
                                            payload={typeof log.payload === "string" ? log.payload : JSON.stringify(log.payload)}
                                            responseSnippet={log.responseSnippet}
                                        />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                    {/* footer */}
                    <div className="shrink-0 h-8 bg-[#fafafa] border-t border-[#e6e6e6] flex items-center justify-between px-4 sm:px-5 font-mono text-[10px] text-[#999]">
                        <span>{completed} / {totalPayloads || "—"} results
                            {criticalCount > 0 && <span className="ml-2" style={{ color: RED }}>● {criticalCount} critical</span>}
                            {blockedCount > 0 && <span className="ml-2" style={{ color: AMBER }}>● {blockedCount} blocked</span>}
                        </span>
                        <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: live ? GREEN : "#ccc" }} />{live ? "Live" : "Disconnected"}</span>
                    </div>
                </div>

                {/* slim right rail: latency spark + top vulnerable endpoints */}
                <div className="border-t lg:border-t-0 lg:border-l border-[#e6e6e6] flex flex-col max-h-[560px] bg-[#fafafa]">
                    <div className="px-4 py-2.5 border-b border-[#e6e6e6]">
                        <span className="flex items-center gap-2 text-[#999] text-[10px] font-mono uppercase tracking-[0.15em]"><Broadcast size={11} /> Latency</span>
                        <div className="mt-1 h-9 -mx-1">
                            {latencySeries.length > 1 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={latencySeries} margin={{ top: 2, bottom: 0, left: 0, right: 0 }}>
                                        <defs><linearGradient id="latGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={ACCENT} stopOpacity={0.3} /><stop offset="100%" stopColor={ACCENT} stopOpacity={0} /></linearGradient></defs>
                                        <Area type="monotone" dataKey="ms" stroke={ACCENT} strokeWidth={1.5} fill="url(#latGrad)" isAnimationActive={false} dot={false} />
                                    </AreaChart>
                                </ResponsiveContainer>
                            ) : <div className="h-full w-full bg-[#f0f0f0]" />}
                        </div>
                    </div>
                    <div className="px-4 py-2.5 border-b border-[#e6e6e6]">
                        <span className="flex items-center gap-2 text-[#999] text-[10px] font-mono uppercase tracking-[0.15em]"><Target size={11} /> Top Vulnerable</span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
                        {topVuln.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-32 text-[#999] text-[11px] gap-2"><ShieldCheck size={18} className="text-[#ccc]" /><span>No failures yet</span></div>
                        ) : topVuln.map((e) => {
                            const c = e.worst >= 500 ? RED : AMBER;
                            return (
                                <div key={e.endpoint} className="bg-white border border-[#e6e6e6] px-2.5 py-2 hover:border-[#ccc] transition-colors">
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="font-mono text-[11px] text-[#333] truncate">{e.endpoint}</span>
                                        <span className="font-mono text-[8.5px] font-bold tracking-wider px-1 py-0.5 shrink-0 border" style={{ color: c, backgroundColor: c + "12", borderColor: c + "40" }}>{e.worst >= 500 ? "CRIT" : "WARN"}</span>
                                    </div>
                                    <div className="mt-0.5 text-[9.5px] font-mono text-[#999] tabular-nums">{e.hits} {e.hits === 1 ? "hit" : "hits"} · worst {e.worst}</div>
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
// IdleCommandCenter — clean light-mono empty state.
//
// Design language (how premium dev-tools — Linear, Vercel, Stripe — do empty
// states): a calm, centered focal point on the white console surface, one
// rationed blue accent, generous whitespace, and honest next-step guidance
// instead of a murky skeleton. Below the hero, the actual product flow is laid
// out as three numbered steps so a first-time user knows exactly what to do.
// ===========================================================================

const STEPS = [
    { n: "01", t: "Add a spec", d: "Paste an OpenAPI or Swagger URL into the bar above." },
    { n: "02", t: "Verify the domain", d: "Prove you own the target with a file or DNS record." },
    { n: "03", t: "Launch", d: "Payloads fire and findings stream in live, scored by severity." },
];

function IdleCommandCenter({ reduce }: { reduce: boolean | null }) {
    const focusInput = () => {
        const el = document.querySelector<HTMLInputElement>('input[type="url"]');
        el?.focus();
        el?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
    };

    return (
        <motion.div
            key="idle"
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.35, ease: [0.2, 0, 0, 1] }}
            className="flex flex-col"
        >
            {/* ---- Hero: single focused action ---- */}
            <div className="flex flex-col items-center text-center px-6 py-16 sm:py-20">
                <span className="inline-grid place-items-center h-12 w-12 bg-[#f0f6ff] border border-[#93c5fd]">
                    <Crosshair size={22} weight="regular" className="text-[#3b82f6]" />
                </span>

                <h2 className="mt-5 text-[20px] leading-tight tracking-tight text-black font-medium">
                    No active scans
                </h2>
                <p className="mt-2 text-[14px] leading-relaxed text-[#666] max-w-[46ch]">
                    Point Onyx at an OpenAPI or Swagger spec and launch a run. Live findings,
                    severity, and per-endpoint results populate this console as each payload fires.
                </p>

                <button
                    type="button"
                    onClick={focusInput}
                    className="group mono-btn mt-6"
                >
                    Launch a scan
                    <ArrowRight
                        size={15}
                        weight="bold"
                        className="transition-transform duration-200 group-hover:translate-x-0.5"
                    />
                </button>

                {/* Quiet capability line */}
                <div className="mt-6 flex items-center gap-3 text-[11px] text-[#999] font-mono uppercase tracking-wider whitespace-nowrap">
                    <span className="flex items-center gap-1.5">
                        <span className="h-1 w-1 rounded-full bg-[#3b82f6]" />
                        CVSS
                    </span>
                    <span className="text-[#ccc]">/</span>
                    <span>Severity</span>
                    <span className="text-[#ccc]">/</span>
                    <span>Live stream</span>
                </div>
            </div>

            {/* ---- Three-step guide: the real product flow ---- */}
            <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-[#e6e6e6] border-t border-[#e6e6e6]">
                {STEPS.map((s) => (
                    <div key={s.n} className="px-5 py-5">
                        <span className="font-mono text-[11px] text-[#3b82f6] tracking-widest">{s.n}</span>
                        <p className="mt-1.5 text-[14px] font-medium text-black">{s.t}</p>
                        <p className="mt-1 text-[13px] leading-relaxed text-[#666]">{s.d}</p>
                    </div>
                ))}
            </div>
        </motion.div>
    );
}

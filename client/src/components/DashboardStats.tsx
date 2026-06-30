// =============================================================================
// DashboardStats — "mission control" telemetry row for the Dashboard.
// Operational/SOC pattern (research-grounded):
//  - Traffic-light discipline: red/amber appear ONLY when count > 0 (no
//    "screaming zeros" at idle — the #1 cited SOC-dashboard failure).
//  - F-pattern: posture/insight reads first, then the metric grid.
//  - At-a-glance posture: a severity-distribution bar + a fire-rate sparkline.
//  - Plain-language insight line ("here's what it means", not just numbers).
// Pure presentation — all values are passed in; no store/logic changes.
// =============================================================================

import { useMemo } from "react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { Crosshair, AlertTriangle, ShieldAlert, Radio } from "lucide-react";
import type { AttackLog } from "@/store/useAttackStore";

const TEAL = "#73bfc4";
const RED = "#ef4444";
const AMBER = "#ff810a"; // brand warm orange = warning
const SLATE = "#8da0ce";

type ConnStatus = "connected" | "connecting" | "disconnected";

interface Props {
    logs: AttackLog[];
    totalPayloads: number;
    completedCount: number;
    criticalCount: number;
    blockedCount: number;
    infoCount: number;
    connectionStatus: ConnStatus;
    progressPct: number;
}

// ---- Shared card shell (shadow-as-border, brand surface) ----
const cardCls =
    "relative overflow-hidden rounded-2xl bg-[#0B0C0D] p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.07)]";
const labelCls =
    "flex items-center gap-2 text-neutral-500 text-[10px] font-['JetBrains_Mono'] uppercase tracking-[0.15em]";

const DashboardStats = ({
    logs,
    totalPayloads,
    completedCount,
    criticalCount,
    blockedCount,
    infoCount,
    connectionStatus,
    progressPct,
}: Props) => {
    // Severity split for the distribution bar (passed counts are the source of truth).
    const passed = Math.max(0, infoCount);
    const segments = [
        { key: "critical", count: criticalCount, color: RED, label: "Critical" },
        { key: "blocked", count: blockedCount, color: AMBER, label: "Warning" },
        { key: "info", count: passed, color: SLATE, label: "Info" },
    ];
    const segTotal = segments.reduce((s, x) => s + x.count, 0);

    // Fire-rate sparkline: bucket completed logs into ~20 slots by arrival order.
    const spark = useMemo(() => {
        if (logs.length === 0) return [];
        const buckets = 20;
        const size = Math.max(1, Math.ceil(logs.length / buckets));
        const out: { i: number; v: number }[] = [];
        for (let i = 0; i < logs.length; i += size) {
            out.push({ i: out.length, v: logs.slice(i, i + size).length });
        }
        return out;
    }, [logs.length]);

    // Plain-language insight ("here's what it means").
    const insight = (() => {
        if (totalPayloads === 0) return "Standing by. Enter a target spec to begin a run.";
        if (criticalCount > 0)
            return `${criticalCount} critical ${criticalCount === 1 ? "finding" : "findings"} across ${completedCount} payloads. Triage the red rows first.`;
        if (completedCount >= totalPayloads && totalPayloads > 0)
            return `Run complete. ${completedCount} payloads fired, no critical failures detected.`;
        return `${completedCount} of ${totalPayloads} payloads fired. Streaming live results.`;
    })();

    const live = connectionStatus === "connected";

    return (
        <div className="flex flex-col gap-3">
            {/* ---- Insight line (reads first, F-pattern top) ---- */}
            <div className="flex items-center gap-2.5 px-1">
                <span
                    className={`relative flex h-1.5 w-1.5 ${live ? "" : "opacity-50"}`}
                    aria-hidden="true"
                >
                    {live && (
                        <span
                            className="absolute inline-flex h-full w-full rounded-full opacity-70 motion-safe:animate-ping"
                            style={{ backgroundColor: TEAL }}
                        />
                    )}
                    <span
                        className="relative inline-flex h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: live ? TEAL : "#52525b" }}
                    />
                </span>
                <p className="text-[13px] text-neutral-300 font-['Inter']">{insight}</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr_1fr_1fr] gap-3">
                {/* ---- Posture card (top-left, biggest): severity distribution ---- */}
                <div className={cardCls}>
                    <div className="flex items-center justify-between">
                        <span className={labelCls}>
                            <Crosshair size={11} />
                            Security Posture
                        </span>
                        <span className="font-['JetBrains_Mono'] text-[11px] tabular-nums text-neutral-600">
                            {completedCount}/{totalPayloads || "—"}
                        </span>
                    </div>

                    {/* Distribution bar (bars beat pie; segmented) */}
                    <div className="mt-4 flex h-2.5 w-full overflow-hidden rounded-full bg-white/[0.05]">
                        {segTotal === 0 ? (
                            <div className="h-full w-full bg-white/[0.04]" />
                        ) : (
                            segments.map((s) =>
                                s.count > 0 ? (
                                    <div
                                        key={s.key}
                                        className="h-full transition-all duration-500"
                                        style={{
                                            width: `${(s.count / segTotal) * 100}%`,
                                            backgroundColor: s.color,
                                        }}
                                        title={`${s.label}: ${s.count}`}
                                    />
                                ) : null,
                            )
                        )}
                    </div>

                    {/* Legend with counts (label + color, not color alone — a11y) */}
                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
                        {segments.map((s) => (
                            <span
                                key={s.key}
                                className="flex items-center gap-1.5 text-[11px] font-['JetBrains_Mono'] text-neutral-400"
                            >
                                <span
                                    className="h-2 w-2 rounded-sm"
                                    style={{ backgroundColor: s.color, opacity: s.count > 0 ? 1 : 0.3 }}
                                />
                                {s.label}
                                <span className="tabular-nums text-neutral-500">{s.count}</span>
                            </span>
                        ))}
                    </div>
                </div>

                {/* ---- Payloads fired + sparkline ---- */}
                <div className={cardCls}>
                    <span className={labelCls}>
                        <Crosshair size={11} />
                        Payloads Fired
                    </span>
                    <div className="mt-2 flex items-baseline gap-1">
                        <span className="text-2xl font-['JetBrains_Mono'] text-white tabular-nums">
                            {completedCount}
                        </span>
                        <span className="text-xs font-['JetBrains_Mono'] text-neutral-600">
                            / {totalPayloads}
                        </span>
                    </div>
                    {/* sparkline */}
                    <div className="mt-2 h-8 -mx-1">
                        {spark.length > 1 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={spark} margin={{ top: 2, bottom: 0, left: 0, right: 0 }}>
                                    <defs>
                                        <linearGradient id="fireGrad" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor={TEAL} stopOpacity={0.4} />
                                            <stop offset="100%" stopColor={TEAL} stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <Area
                                        type="monotone"
                                        dataKey="v"
                                        stroke={TEAL}
                                        strokeWidth={1.5}
                                        fill="url(#fireGrad)"
                                        isAnimationActive={false}
                                        dot={false}
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full w-full rounded bg-white/[0.02]" />
                        )}
                    </div>
                    {totalPayloads > 0 && (
                        <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-white/[0.05]">
                            <div
                                className="h-full transition-all duration-300"
                                style={{ width: `${progressPct}%`, backgroundColor: TEAL }}
                            />
                        </div>
                    )}
                </div>

                {/* ---- Critical (traffic-light: neutral at 0) ---- */}
                <div
                    className={`${cardCls} ${criticalCount > 0 ? "shadow-[0_0_0_1px_rgba(239,68,68,0.4)]" : ""}`}
                >
                    <span className={labelCls}>
                        <AlertTriangle
                            size={11}
                            className={criticalCount > 0 ? "text-red-500" : "text-neutral-600"}
                        />
                        Critical
                    </span>
                    <div className="mt-2 flex items-baseline gap-2">
                        <span
                            className={`text-2xl font-['JetBrains_Mono'] font-bold tabular-nums ${
                                criticalCount > 0 ? "text-red-500" : "text-neutral-500"
                            }`}
                        >
                            {criticalCount}
                        </span>
                        {criticalCount > 0 && (
                            <span className="text-[10px] font-['JetBrains_Mono'] text-red-500/80 uppercase tracking-wider motion-safe:animate-pulse">
                                vuln detected
                            </span>
                        )}
                    </div>
                </div>

                {/* ---- Blocked / Queue split into one card stack on small, separate on lg ---- */}
                <div className="flex flex-col gap-3">
                    <div
                        className={`${cardCls} flex-1 ${blockedCount > 0 ? "shadow-[0_0_0_1px_rgba(255,129,10,0.35)]" : ""}`}
                    >
                        <span className={labelCls}>
                            <ShieldAlert
                                size={11}
                                className={blockedCount > 0 ? "text-[#ff810a]" : "text-neutral-600"}
                            />
                            Blocked
                        </span>
                        <span
                            className={`mt-2 block text-2xl font-['JetBrains_Mono'] tabular-nums ${
                                blockedCount > 0 ? "text-[#ff810a]" : "text-neutral-500"
                            }`}
                        >
                            {blockedCount}
                        </span>
                    </div>
                    <div className={`${cardCls} flex-1`}>
                        <span className={labelCls}>
                            <Radio size={11} />
                            Queue
                        </span>
                        <div className="mt-2 flex items-center gap-2">
                            <span
                                className="h-2 w-2 rounded-full"
                                style={{
                                    backgroundColor: live
                                        ? TEAL
                                        : connectionStatus === "connecting"
                                          ? AMBER
                                          : "#52525b",
                                }}
                            />
                            <span
                                className="text-sm font-['JetBrains_Mono']"
                                style={{
                                    color: live
                                        ? TEAL
                                        : connectionStatus === "connecting"
                                          ? AMBER
                                          : "#71717a",
                                }}
                            >
                                {live ? "LIVE" : connectionStatus === "connecting" ? "SYNC" : "OFFLINE"}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DashboardStats;

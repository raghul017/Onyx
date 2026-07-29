// =============================================================================
// LiveConsoleReplay — light-mono canned replay of the streaming attack console
// (T21-demo). NOT the dark ChaosStream: this is built in the light-mono system
// (white panel, #e6e6e6 hairlines, JetBrains Mono, blue #3b82f6 accent).
//
// Behavior:
//   • IntersectionObserver — only animates while visible (perf).
//   • Auto-plays: reveals fixture rows one at a time (~320ms), auto-scrolling the
//     list; on completion it shows a "scan complete" state, pauses, then loops.
//   • prefers-reduced-motion → renders the full list statically, no timers.
//   • Rows are capped by the fixture length; the list is the only scroller.
// =============================================================================
import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { REPLAY_ROWS, type ReplaySeverity } from "../data/replayFixture";

const STEP_MS = 320;
const LOOP_PAUSE_MS = 2600;

// Severity chip colors — same palette the rest of the landing uses (AboutSection).
const sevChip: Record<ReplaySeverity, string> = {
    CRITICAL: "border-[#fca5a5] text-[#dc2626]",
    HIGH: "border-[#fdba74] text-[#ea580c]",
    MEDIUM: "border-[#93c5fd] text-[#3b82f6]",
    LOW: "border-[#e6e6e6] text-[#666]",
    INFO: "border-[#e6e6e6] text-[#999]",
};

const statusColor = (code: number) =>
    code >= 500 ? "text-[#dc2626]" : code >= 400 ? "text-[#ea580c]" : "text-[#16a34a]";

const LiveConsoleReplay = () => {
    const reduce = useReducedMotion();
    const rootRef = useRef<HTMLDivElement>(null);
    const listRef = useRef<HTMLDivElement>(null);
    const [visible, setVisible] = useState(false);
    // count of rows currently revealed (reduced-motion → all at once).
    const [count, setCount] = useState(reduce ? REPLAY_ROWS.length : 0);

    // Only run the animation while the panel is on screen.
    useEffect(() => {
        const el = rootRef.current;
        if (!el) return;
        const io = new IntersectionObserver(
            ([entry]) => setVisible(entry.isIntersecting),
            { threshold: 0.25 },
        );
        io.observe(el);
        return () => io.disconnect();
    }, []);

    // Streaming loop — advance one row per tick; loop after a pause at the end.
    useEffect(() => {
        if (reduce) {
            setCount(REPLAY_ROWS.length);
            return;
        }
        if (!visible) return;

        let timer: ReturnType<typeof setTimeout>;
        const tick = () => {
            setCount((c) => {
                if (c >= REPLAY_ROWS.length) {
                    timer = setTimeout(() => setCount(0), LOOP_PAUSE_MS);
                    return c;
                }
                timer = setTimeout(tick, STEP_MS);
                return c + 1;
            });
        };
        timer = setTimeout(tick, STEP_MS);
        return () => clearTimeout(timer);
    }, [visible, reduce]);

    // Keep the newest row in view as rows stream in.
    useEffect(() => {
        if (reduce) return;
        const list = listRef.current;
        if (list) list.scrollTop = list.scrollHeight;
    }, [count, reduce]);

    const rows = REPLAY_ROWS.slice(0, count);
    const done = count >= REPLAY_ROWS.length;
    const findings = REPLAY_ROWS.slice(0, count).filter((r) => r.severity !== "INFO").length;

    return (
        <div
            ref={rootRef}
            className="mono-card w-full overflow-hidden"
            role="img"
            aria-label="Replay of the Onyx live attack console: HTTP requests streaming back with method, path, status, latency, attack type and severity, ending in a completed scan with confirmed findings."
        >
            {/* Header bar */}
            <div className="border-b border-[#e6e6e6] px-4 py-3 flex items-center justify-between font-mono text-[11px] text-[#666] uppercase tracking-wide">
                <span className="flex items-center gap-2">
                    <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
                        {!done && !reduce && (
                            <span className="absolute inline-flex h-full w-full rounded-full bg-[#3b82f6] opacity-75 motion-safe:animate-ping" />
                        )}
                        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#3b82f6]" />
                    </span>
                    onyx // live
                </span>
                <span className="tabular-nums normal-case text-[#999]">
                    {done ? "scan complete" : "streaming…"} · {findings} finding
                    {findings === 1 ? "" : "s"}
                </span>
            </div>

            {/* Streaming rows — the only scroller */}
            <div
                ref={listRef}
                className="h-[320px] overflow-y-auto overflow-x-auto divide-y divide-[#f0f0f0] font-mono text-[12px]"
            >
                {rows.map((r) => (
                    <div
                        key={r.id}
                        className="flex items-center gap-3 px-4 py-2.5 min-w-[520px] hover:bg-[#fafafa] transition-colors"
                    >
                        <span className="w-14 shrink-0 font-semibold text-[#333]">{r.method}</span>
                        <span className="flex-1 truncate text-[#334155]">{r.endpoint}</span>
                        <span className={`w-9 shrink-0 tabular-nums ${statusColor(r.statusCode)}`}>
                            {r.statusCode}
                        </span>
                        <span className="w-16 shrink-0 tabular-nums text-right text-[#999]">
                            {r.responseTime}ms
                        </span>
                        <span className="w-32 shrink-0 truncate text-[10px] uppercase tracking-wide text-[#666]">
                            {r.attackType.replace(/_/g, " ")}
                        </span>
                        <span className="w-24 shrink-0 flex items-center justify-end gap-1">
                            {r.owaspCode && (
                                <span className="border border-[#e6e6e6] px-1 text-[9px] uppercase text-[#999] leading-none py-0.5">
                                    {r.owaspCode}
                                </span>
                            )}
                            <span
                                className={`border px-1 text-[9px] uppercase leading-none py-0.5 ${sevChip[r.severity]}`}
                            >
                                {r.severity.slice(0, 4)}
                            </span>
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default LiveConsoleReplay;

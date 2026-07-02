// =============================================================================
// useCountUp — tween a number toward its target so dashboard KPIs settle
// smoothly instead of snapping between values as results stream in.
//
// - requestAnimationFrame-based, so it composites off the main layout path.
// - Always lands exactly on the target (no floating-point drift).
// - Honors prefers-reduced-motion: jumps straight to the value.
// - Cheap: no-ops when the value is unchanged.
// =============================================================================

import { useEffect, useRef, useState } from "react";

const prefersReducedMotion = () =>
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/**
 * Returns a value that animates toward `target` over `durationMs`.
 * @param target      the destination integer
 * @param durationMs  tween length (default 400ms)
 */
export function useCountUp(target: number, durationMs = 400): number {
    const [display, setDisplay] = useState(target);
    const fromRef = useRef(target);
    const startRef = useRef<number | null>(null);
    const rafRef = useRef<number | null>(null);

    useEffect(() => {
        // Instant on first mount or when reduced motion is requested.
        if (prefersReducedMotion()) {
            setDisplay(target);
            fromRef.current = target;
            return;
        }
        if (target === fromRef.current) return;

        const from = display;
        fromRef.current = target;
        startRef.current = null;

        const tick = (now: number) => {
            if (startRef.current === null) startRef.current = now;
            const elapsed = now - startRef.current;
            const t = Math.min(1, elapsed / durationMs);
            // easeOutCubic — quick start, gentle settle.
            const eased = 1 - Math.pow(1 - t, 3);
            const next = Math.round(from + (target - from) * eased);
            setDisplay(next);
            if (t < 1) {
                rafRef.current = requestAnimationFrame(tick);
            } else {
                setDisplay(target);
            }
        };

        rafRef.current = requestAnimationFrame(tick);
        return () => {
            if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [target, durationMs]);

    return display;
}

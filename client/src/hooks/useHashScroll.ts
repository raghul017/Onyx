// =============================================================================
// useHashScroll — scroll to `location.hash` when it changes (T21a).
//
// The marketing nav links to "/#anchor". When you're already on "/", clicking
// only changes the hash (no remount), so we scroll here. When you're on another
// route (e.g. /docs), React Router first navigates home, this Landing-mounted
// hook runs, sees the hash, and scrolls once the section exists.
//
// Forward anchors (#authenticated/#owasp/#cicd/#demo) don't exist until later
// tickets — getElementById returns null and we simply no-op (no error).
// =============================================================================
import { useEffect } from "react";
import { useLocation } from "react-router-dom";

export function useHashScroll() {
    const { hash } = useLocation();

    useEffect(() => {
        if (!hash) return;
        const id = decodeURIComponent(hash.slice(1));
        if (!id) return;

        // Defer to the next frame so lazy sections have mounted after a
        // cross-route navigation before we try to find the target.
        const raf = window.requestAnimationFrame(() => {
            const el = document.getElementById(id);
            if (!el) return; // section not built yet (or unknown hash) → no-op
            const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
            el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
        });

        return () => window.cancelAnimationFrame(raf);
    }, [hash]);
}

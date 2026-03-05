// =============================================================================
// useServerStatus — Zustand store tracking backend readiness (cold-start aware)
// =============================================================================

import { create } from "zustand";

export type ServerStatus = "checking" | "waking" | "ready" | "offline";

interface ServerStatusState {
    /** Current backend readiness */
    serverStatus: ServerStatus;
    /** Seconds elapsed since we started waking the server */
    coldStartElapsed: number;
    /** Fire-and-forget warm-up: pings /api/health with retry logic */
    warmUpServer: () => void;
}

const HEALTH_URL = `${(import.meta.env.VITE_API_URL || "http://localhost:3000").replace(/\/$/, "")}/api/health`;
const MAX_WAIT_SECONDS = 90; // give up after 90s
const RETRY_INTERVAL_MS = 3_000; // retry every 3s

export const useServerStatus = create<ServerStatusState>((set, get) => {
    let timer: ReturnType<typeof setInterval> | null = null;
    let elapsed = 0;
    let aborted = false;

    const cleanup = () => {
        if (timer) {
            clearInterval(timer);
            timer = null;
        }
    };

    const ping = async (): Promise<boolean> => {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 10_000);
            const res = await fetch(HEALTH_URL, { signal: controller.signal });
            clearTimeout(timeout);
            return res.ok;
        } catch {
            return false;
        }
    };

    const startElapsedCounter = () => {
        elapsed = 0;
        cleanup();
        timer = setInterval(() => {
            elapsed += 1;
            set({ coldStartElapsed: elapsed });

            if (elapsed >= MAX_WAIT_SECONDS) {
                cleanup();
                set({ serverStatus: "offline" });
                aborted = true;
            }
        }, 1_000);
    };

    const warmUpServer = async () => {
        const { serverStatus } = get();
        // Don't restart if already waking or ready
        if (serverStatus === "waking" || serverStatus === "ready") return;

        aborted = false;
        set({ serverStatus: "checking", coldStartElapsed: 0 });

        // First ping — if it responds quickly, server is warm
        const warm = await ping();
        if (warm) {
            set({ serverStatus: "ready" });
            return;
        }

        // Server didn't respond — it's cold starting
        set({ serverStatus: "waking" });
        startElapsedCounter();

        // Retry loop
        const retry = async () => {
            while (!aborted) {
                await new Promise((r) => setTimeout(r, RETRY_INTERVAL_MS));
                if (aborted) break;
                const ok = await ping();
                if (ok) {
                    cleanup();
                    set({ serverStatus: "ready", coldStartElapsed: 0 });
                    return;
                }
            }
        };

        retry();
    };

    return {
        serverStatus: "checking",
        coldStartElapsed: 0,
        warmUpServer,
    };
});

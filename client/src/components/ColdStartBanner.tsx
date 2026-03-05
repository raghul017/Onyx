// =============================================================================
// ColdStartBanner — Shows a sleek banner while Render backend is waking up
// =============================================================================

import { useServerStatus } from "@/store/useServerStatus";
import { Wifi, WifiOff, Server } from "lucide-react";

const ColdStartBanner = () => {
    const { serverStatus, coldStartElapsed } = useServerStatus();

    // Don't show anything when server is ready or on initial check
    if (serverStatus === "ready" || serverStatus === "checking") return null;

    if (serverStatus === "offline") {
        return (
            <div className="shrink-0 bg-red-500/10 border-b border-red-500/20 px-4 py-3 flex items-center justify-center gap-3 font-['JetBrains_Mono'] text-[12px]">
                <WifiOff size={14} className="text-red-400 shrink-0" />
                <span className="text-red-400">
                    Server unreachable — the backend may be down. Please try
                    again later.
                </span>
            </div>
        );
    }

    // serverStatus === "waking"
    return (
        <div className="shrink-0 bg-cyan-500/[0.06] border-b border-cyan-500/10 px-4 py-3 flex items-center justify-center gap-3 font-['JetBrains_Mono'] text-[12px] overflow-hidden">
            {/* Animated pulse */}
            <div className="relative shrink-0">
                <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse" />
                <div className="absolute inset-0 w-2 h-2 bg-cyan-400 rounded-full animate-ping opacity-40" />
            </div>

            <Server size={13} className="text-cyan-500/60 shrink-0" />

            <span className="text-cyan-300/90">
                Server is waking up
                <span className="text-cyan-500/50 mx-1">—</span>
                <span className="text-neutral-500">
                    Render free-tier cold start
                </span>
            </span>

            {/* Elapsed counter */}
            <span className="text-cyan-400/70 tabular-nums">
                {coldStartElapsed}s
            </span>

            {/* Animated dots */}
            <span className="inline-flex gap-[2px]">
                <span className="w-1 h-1 bg-cyan-500/50 rounded-full animate-bounce [animation-delay:0ms]" />
                <span className="w-1 h-1 bg-cyan-500/50 rounded-full animate-bounce [animation-delay:150ms]" />
                <span className="w-1 h-1 bg-cyan-500/50 rounded-full animate-bounce [animation-delay:300ms]" />
            </span>

            <Wifi
                size={13}
                className="text-cyan-500/30 shrink-0 hidden sm:block"
            />
        </div>
    );
};

export default ColdStartBanner;

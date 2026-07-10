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
            <div className="onyx-mono shrink-0 bg-[#fef2f2] border-b border-[#fca5a5] px-4 py-2.5 flex items-center justify-center gap-3 font-mono text-[12px] overflow-hidden">
                {/* Static status dot */}
                <div className="relative shrink-0">
                    <div className="w-2 h-2 bg-[#dc2626] rounded-full" />
                    <div className="absolute inset-0 w-2 h-2 bg-[#dc2626] rounded-full animate-ping opacity-30" />
                </div>

                <Server size={13} className="text-[#dc2626] shrink-0" />

                <span className="text-[#dc2626]">
                    Server unreachable
                    <span className="text-[#fca5a5] mx-1.5">·</span>
                    <span className="text-[#666]">
                        the backend may be down, please try again later
                    </span>
                </span>

                <WifiOff
                    size={13}
                    className="text-[#fca5a5] shrink-0 hidden sm:block"
                />
            </div>
        );
    }

    // serverStatus === "waking"
    return (
        <div className="onyx-mono shrink-0 bg-[#f0f6ff] border-b border-[#93c5fd] px-4 py-2.5 flex items-center justify-center gap-3 font-mono text-[12px] overflow-hidden">
            {/* Animated pulse */}
            <div className="relative shrink-0">
                <div className="w-2 h-2 bg-[#3b82f6] rounded-full animate-pulse" />
                <div className="absolute inset-0 w-2 h-2 bg-[#3b82f6] rounded-full animate-ping opacity-40" />
            </div>

            <Server size={13} className="text-[#3b82f6] shrink-0" />

            <span className="text-[#3b82f6]">
                Server is waking up
                <span className="text-[#93c5fd] mx-1.5">·</span>
                <span className="text-[#666]">
                    Render free-tier cold start
                </span>
            </span>

            {/* Elapsed counter */}
            <span className="text-[#3b82f6] tabular-nums">
                {coldStartElapsed}s
            </span>

            {/* Animated dots */}
            <span className="inline-flex gap-[2px]">
                <span className="w-1 h-1 bg-[#93c5fd] rounded-full animate-bounce [animation-delay:0ms]" />
                <span className="w-1 h-1 bg-[#93c5fd] rounded-full animate-bounce [animation-delay:150ms]" />
                <span className="w-1 h-1 bg-[#93c5fd] rounded-full animate-bounce [animation-delay:300ms]" />
            </span>

            <Wifi
                size={13}
                className="text-[#93c5fd] shrink-0 hidden sm:block"
            />
        </div>
    );
};

export default ColdStartBanner;

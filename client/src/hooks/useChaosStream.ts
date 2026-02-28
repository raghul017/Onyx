// =============================================================================
// useOnyxStream — WebSocket hook for live attack results
// =============================================================================

import { useEffect, useRef, useState, useCallback } from "react";
import type { AttackResult } from "@/services/api";

/** WebSocket message from the server. */
interface WsMessage {
    type: "ATTACK_RESULT" | "TEST_RUN_STATUS" | "ERROR";
    data: any;
}

interface TestRunProgress {
    status: string;
    completedAttacks: number;
    totalAttacks: number;
}

interface UseChaosStreamReturn {
    /** Live attack results as they arrive. */
    results: AttackResult[];
    /** Current test run progress. */
    progress: TestRunProgress;
    /** Whether the WebSocket is connected. */
    isConnected: boolean;
    /** Any error message from the server. */
    error: string | null;
}

/**
 * React hook that subscribes to an Onyx test run via WebSocket
 * and streams attack results in real-time.
 *
 * @param testRunId — The UUID of the test run to subscribe to. Pass null to skip.
 */
export function useChaosStream(testRunId: string | null): UseChaosStreamReturn {
    const [results, setResults] = useState<AttackResult[]>([]);
    const [progress, setProgress] = useState<TestRunProgress>({
        status: "PENDING",
        completedAttacks: 0,
        totalAttacks: 0,
    });
    const [isConnected, setIsConnected] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const wsRef = useRef<WebSocket | null>(null);
    const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

    const connect = useCallback(() => {
        if (!testRunId) return;

        // Build WebSocket URL relative to the current host (works with Vite proxy)
        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const wsUrl = `${protocol}//${window.location.host}/ws`;

        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
            setIsConnected(true);
            setError(null);
            console.log("[WS] Connected — subscribing to", testRunId);

            // Subscribe to the test run
            ws.send(JSON.stringify({ type: "SUBSCRIBE", testRunId }));
        };

        ws.onmessage = (event) => {
            try {
                const msg: WsMessage = JSON.parse(event.data);

                switch (msg.type) {
                    case "ATTACK_RESULT":
                        setResults((prev) => [
                            msg.data as AttackResult,
                            ...prev,
                        ]);
                        break;

                    case "TEST_RUN_STATUS":
                        setProgress({
                            status: msg.data.status,
                            completedAttacks: msg.data.completedAttacks,
                            totalAttacks: msg.data.totalAttacks,
                        });
                        break;

                    case "ERROR":
                        setError(msg.data.message);
                        console.error("[WS] Server error:", msg.data);
                        break;
                }
            } catch (err) {
                console.error("[WS] Failed to parse message:", err);
            }
        };

        ws.onclose = () => {
            setIsConnected(false);
            console.log("[WS] Disconnected");

            // Auto-reconnect if the test run is still in progress
            if (
                progress.status !== "COMPLETED" &&
                progress.status !== "FAILED"
            ) {
                reconnectTimeoutRef.current = setTimeout(() => {
                    console.log("[WS] Reconnecting...");
                    connect();
                }, 2000);
            }
        };

        ws.onerror = () => {
            setError("WebSocket connection error");
        };
    }, [testRunId, progress.status]);

    useEffect(() => {
        connect();

        return () => {
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
            }
            if (wsRef.current) {
                wsRef.current.close();
                wsRef.current = null;
            }
        };
    }, [testRunId]); // Only reconnect when testRunId changes

    return { results, progress, isConnected, error };
}

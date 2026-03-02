// =============================================================================
// useAttackStore — Zustand WebSocket store for live attack results
// =============================================================================

import { create } from "zustand";
import { useAuthStore } from "./useAuthStore";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AttackLog {
    id: string;
    method: string;
    endpoint: string;
    payload: any;
    statusCode: number;
    latencyMs: number;
    timestamp: number;
}

export type AttackStatus = "idle" | "attacking" | "completed";
export type ConnectionStatus = "disconnected" | "connecting" | "connected";

interface AttackState {
    logs: AttackLog[];
    status: AttackStatus;
    connectionStatus: ConnectionStatus;
    error: string | null;
    testRunId: string | null;
    totalPayloads: number;
    criticalCount: number;
    blockedCount: number;
    infoCount: number;
}

interface AttackActions {
    /** Open a WebSocket via Vite proxy (/ws) and subscribe to a test run. */
    connectWebSocket: (testRunId: string) => void;
    /** Gracefully close the WebSocket connection. */
    disconnectWebSocket: () => void;
    /** Prepend a new log entry (newest first). */
    addLog: (log: AttackLog) => void;
    /** Set the total expected payload count (ceiling). */
    setTotalPayloads: (count: number) => void;
    /** Full reset: clear logs, reset status and totalPayloads to 0. */
    resetAttack: () => void;
}

// ---------------------------------------------------------------------------
// Internal refs (kept outside React / Zustand to avoid serialization issues)
// ---------------------------------------------------------------------------

let ws: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useAttackStore = create<AttackState & AttackActions>(
    (set, get) => ({
        // -- State ----------------------------------------------------------
        logs: [],
        status: "idle",
        connectionStatus: "disconnected",
        error: null,
        testRunId: null,
        totalPayloads: 0,
        criticalCount: 0,
        blockedCount: 0,
        infoCount: 0,

        // -- Actions --------------------------------------------------------

        connectWebSocket: (testRunId: string) => {
            // Prevent duplicate connections
            if (ws && ws.readyState <= WebSocket.OPEN) {
                ws.close();
            }
            if (reconnectTimer) {
                clearTimeout(reconnectTimer);
                reconnectTimer = null;
            }

            set({
                connectionStatus: "connecting",
                error: null,
                testRunId,
                status: "idle",
            });

            const protocol =
                window.location.protocol === "https:" ? "wss:" : "ws:";

            const token = useAuthStore.getState().token;

            // Prefer explicit env URL, fallback to local backend port
            const WS_BASE_URL =
                import.meta.env.VITE_WS_URL || "ws://localhost:3000/ws";

            // Append JWT token for auth hook
            const wsUrl = `${WS_BASE_URL}${token ? `?token=${token}` : ""}`;

            const socket = new WebSocket(wsUrl);
            ws = socket;

            socket.onopen = () => {
                set({ connectionStatus: "connected" });
                console.log("[AttackStore] WebSocket connected");

                // Subscribe to the test run channel
                socket.send(JSON.stringify({ type: "SUBSCRIBE", testRunId }));
            };

            socket.onmessage = (event) => {
                try {
                    const msg = JSON.parse(event.data);

                    switch (msg.type) {
                        case "ATTACK_RESULT": {
                            const log: AttackLog = {
                                id: msg.data.id,
                                method: msg.data.method,
                                endpoint: msg.data.endpoint,
                                payload: msg.data.payload,
                                statusCode: msg.data.statusCode,
                                latencyMs:
                                    msg.data.latencyMs ??
                                    msg.data.responseTime ??
                                    0,
                                timestamp: msg.data.timestamp ?? Date.now(),
                            };
                            get().addLog(log);
                            // Move to "attacking" on first result
                            if (get().status === "idle") {
                                set({ status: "attacking" });
                            }
                            break;
                        }

                        case "TEST_RUN_STATUS": {
                            const s = msg.data.status as string;
                            const total = msg.data.totalAttacks;
                            if (total && total > 0) {
                                set({ totalPayloads: total });
                            }
                            if (s === "COMPLETED" || s === "FAILED") {
                                set({ status: "completed" });
                            } else if (
                                s === "ATTACKING" ||
                                s === "GENERATING" ||
                                s === "PARSING"
                            ) {
                                set({ status: "attacking" });
                            }
                            break;
                        }

                        case "ERROR": {
                            set({
                                error:
                                    msg.data.message ?? "Unknown server error",
                            });
                            console.error(
                                "[AttackStore] Server error:",
                                msg.data,
                            );
                            break;
                        }
                    }
                } catch (err) {
                    console.error(
                        "[AttackStore] Failed to parse message:",
                        err,
                    );
                }
            };

            socket.onclose = () => {
                set({ connectionStatus: "disconnected" });
                console.log("[AttackStore] WebSocket disconnected");

                // Auto-reconnect after 3s if not completed
                const { status, testRunId: currentId } = get();
                if (status !== "completed" && currentId) {
                    reconnectTimer = setTimeout(() => {
                        console.log("[AttackStore] Reconnecting...");
                        get().connectWebSocket(currentId);
                    }, 3000);
                }
            };

            socket.onerror = () => {
                set({
                    error: "WebSocket connection error",
                    connectionStatus: "disconnected",
                });
            };
        },

        disconnectWebSocket: () => {
            if (reconnectTimer) {
                clearTimeout(reconnectTimer);
                reconnectTimer = null;
            }
            if (ws) {
                ws.close();
                ws = null;
            }
            set({ connectionStatus: "disconnected" });
        },

        addLog: (log: AttackLog) => {
            set((state) => {
                const c = log.statusCode >= 500 ? 1 : 0;
                const b = log.statusCode >= 400 && log.statusCode < 500 ? 1 : 0;
                const i = log.statusCode >= 200 && log.statusCode < 300 ? 1 : 0;

                return {
                    logs: [log, ...state.logs],
                    criticalCount: state.criticalCount + c,
                    blockedCount: state.blockedCount + b,
                    infoCount: state.infoCount + i,
                };
            });
        },

        setTotalPayloads: (count: number) => {
            set({ totalPayloads: count });
        },

        resetAttack: () => {
            // Close any existing WS before resetting
            if (ws && ws.readyState <= WebSocket.OPEN) {
                ws.close();
            }
            if (reconnectTimer) {
                clearTimeout(reconnectTimer);
                reconnectTimer = null;
            }
            ws = null;
            set({
                logs: [],
                status: "idle",
                connectionStatus: "disconnected",
                error: null,
                testRunId: null,
                totalPayloads: 0,
                criticalCount: 0,
                blockedCount: 0,
                infoCount: 0,
            });
        },
    }),
);

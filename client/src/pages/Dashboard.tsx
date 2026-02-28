import { useEffect, useState, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
    Shield,
    ArrowLeft,
    Activity,
    Server,
    ActivitySquare,
    AlertTriangle,
    Wifi,
    WifiOff,
    Loader2,
} from "lucide-react";
import { createTestRun } from "@/services/api";
import { useChaosStream } from "@/hooks/useChaosStream";

const Dashboard = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const targetUrl = location.state?.targetUrl || "";

    const [testRunId, setTestRunId] = useState<string | null>(null);
    const [launching, setLaunching] = useState(false);
    const [launchError, setLaunchError] = useState<string | null>(null);

    // WebSocket live stream
    const {
        results,
        progress,
        isConnected,
        error: wsError,
    } = useChaosStream(testRunId);

    // Computed metrics
    const crashes = results.filter((d) => d.statusCode >= 500).length;
    const avgTime =
        results.length > 0
            ? Math.round(
                  results.reduce((s, d) => s + d.responseTime, 0) /
                      results.length,
              )
            : 0;

    const isScanning =
        progress.status === "PARSING" ||
        progress.status === "GENERATING" ||
        progress.status === "ATTACKING";

    // Launch the test run on mount
    const launch = useCallback(async () => {
        if (!targetUrl || launching || testRunId) return;
        setLaunching(true);
        setLaunchError(null);

        try {
            const res = await createTestRun(targetUrl);
            setTestRunId(res.testRunId);
        } catch (err: any) {
            setLaunchError(err.message || "Failed to start test run");
        } finally {
            setLaunching(false);
        }
    }, [targetUrl, launching, testRunId]);

    useEffect(() => {
        launch();
    }, []);

    return (
        <div className="min-h-screen bg-black text-neutral-300 flex font-sans">
            {/* Sidebar */}
            <aside className="w-16 lg:w-64 border-r border-[#2A2A2A] bg-black flex flex-col items-center lg:items-start p-4 shrink-0 transition-all font-['Inter']">
                <div className="flex items-center gap-3 w-full justify-center lg:justify-start mb-8 text-white">
                    <Shield className="text-white glow-cyan-subtle" size={24} />
                    <span className="hidden lg:block font-bold tracking-tight text-white">
                        Onyx
                    </span>
                </div>

                <nav className="flex flex-col gap-4 w-full">
                    <button
                        onClick={() => navigate("/")}
                        className="p-3 lg:px-4 lg:py-3 flex items-center gap-3 text-neutral-500 hover:text-white hover:bg-neutral-900 transition-colors w-full text-left rounded-none whitespace-nowrap overflow-hidden"
                    >
                        <ArrowLeft size={18} className="shrink-0" />
                        <span className="hidden lg:block text-sm font-mono tracking-wide">
                            Return
                        </span>
                    </button>
                    <div className="p-3 lg:px-4 lg:py-3 flex items-center gap-3 text-primary bg-primary/10 border-l-2 border-primary w-full text-left whitespace-nowrap overflow-hidden">
                        <Activity size={18} className="shrink-0" />
                        <span className="hidden lg:block text-sm font-mono tracking-wide">
                            Live Stream
                        </span>
                    </div>
                </nav>

                {/* Connection status */}
                <div className="mt-auto pt-4 w-full">
                    <div
                        className={`flex items-center gap-2 text-xs font-mono px-3 py-2 ${isConnected ? "text-emerald-400" : "text-neutral-600"}`}
                    >
                        {isConnected ? (
                            <Wifi size={12} />
                        ) : (
                            <WifiOff size={12} />
                        )}
                        <span className="hidden lg:block">
                            {isConnected ? "Connected" : "Disconnected"}
                        </span>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col max-h-screen overflow-hidden bg-black font-['Inter']">
                {/* Header */}
                <header className="h-16 border-b border-[#2A2A2A] bg-black flex items-center justify-between px-6 shrink-0">
                    <div className="flex items-center gap-3 text-sm font-['JetBrains_Mono']">
                        <span className="text-neutral-500 hidden sm:inline-block">
                            Target:
                        </span>
                        <span className="text-white bg-black px-3 py-1 border border-neutral-800 truncate max-w-[200px] sm:max-w-md">
                            {targetUrl || "No URL provided"}
                        </span>
                        {isScanning && (
                            <span className="text-primary animate-pulse ml-2 text-xs flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-primary inline-block"></span>{" "}
                                {progress.status === "PARSING"
                                    ? "Parsing Spec..."
                                    : progress.status === "GENERATING"
                                      ? "Generating Payloads..."
                                      : `Attacking (${progress.completedAttacks}/${progress.totalAttacks})`}
                            </span>
                        )}
                        {progress.status === "COMPLETED" && (
                            <span className="text-emerald-400 ml-2 text-xs flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block"></span>{" "}
                                Complete
                            </span>
                        )}
                        {progress.status === "FAILED" && (
                            <span className="text-destructive ml-2 text-xs flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-destructive inline-block"></span>{" "}
                                Failed
                            </span>
                        )}
                    </div>
                    <div className="text-xs text-neutral-500 font-mono hidden sm:block">
                        Engine: Havoc-3
                    </div>
                </header>

                {/* Error / Launch state */}
                {(launchError || wsError) && (
                    <div className="mx-6 mt-4 px-4 py-3 border border-destructive/30 bg-destructive/5 text-destructive text-sm font-mono">
                        <AlertTriangle size={14} className="inline mr-2" />
                        {launchError || wsError}
                    </div>
                )}

                {launching && (
                    <div className="flex-1 flex items-center justify-center">
                        <div className="flex items-center gap-3 text-neutral-400 font-mono text-sm">
                            <Loader2
                                size={18}
                                className="animate-spin text-primary"
                            />
                            Initializing test run...
                        </div>
                    </div>
                )}

                {/* Dashboard Area */}
                {!launching && (
                    <div className="flex-1 overflow-auto p-4 lg:p-6 space-y-6 bg-black">
                        {/* Metric Cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="bg-[#050505] border border-[#2A2A2A] p-6 flex flex-col justify-between h-32 hover:border-white/30 transition-colors">
                                <div className="text-neutral-500 font-['JetBrains_Mono'] text-xs flex items-center gap-2 uppercase tracking-wider">
                                    <Server
                                        size={14}
                                        className="text-white/70"
                                    />{" "}
                                    Total Requests
                                </div>
                                <div className="text-4xl font-['JetBrains_Mono'] text-white">
                                    {results.length}
                                </div>
                            </div>
                            <div className="bg-[#050505] border border-[#2A2A2A] p-6 flex flex-col justify-between h-32 hover:border-destructive/30 transition-colors">
                                <div className="text-neutral-500 font-['JetBrains_Mono'] text-xs flex items-center gap-2 uppercase tracking-wider">
                                    <AlertTriangle
                                        size={14}
                                        className="text-destructive/70"
                                    />{" "}
                                    Critical Failures
                                </div>
                                <div className="text-4xl font-['JetBrains_Mono'] text-destructive drop-shadow-[0_0_8px_rgba(220,38,38,0.5)]">
                                    {crashes}
                                </div>
                            </div>
                            <div className="bg-[#050505] border border-[#2A2A2A] p-6 flex flex-col justify-between h-32 hover:border-white/30 transition-colors">
                                <div className="text-neutral-500 font-['JetBrains_Mono'] text-xs flex items-center gap-2 uppercase tracking-wider">
                                    <ActivitySquare
                                        size={14}
                                        className="text-white/70"
                                    />{" "}
                                    Avg Latency
                                </div>
                                <div className="text-4xl font-['JetBrains_Mono'] text-white">
                                    {avgTime}
                                    <span className="text-lg text-neutral-600 ml-1">
                                        ms
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Event Stream Table */}
                        <div className="bg-[#050505] border border-[#2A2A2A] flex-1 min-h-[500px] flex flex-col overflow-hidden rounded-md">
                            <div className="px-6 py-4 border-b border-[#2A2A2A] flex items-center justify-between shrink-0 bg-black">
                                <h2 className="text-sm font-['JetBrains_Mono'] text-white flex items-center gap-2">
                                    <Activity
                                        size={16}
                                        className="text-white"
                                    />
                                    Event Stream
                                </h2>
                                <span className="text-xs font-['JetBrains_Mono'] text-neutral-500">
                                    {results.length} attacks logged
                                </span>
                            </div>

                            <div className="overflow-x-auto flex-1 p-0">
                                {results.length === 0 && !launching ? (
                                    <div className="flex items-center justify-center h-64 text-neutral-600 font-mono text-sm">
                                        {isScanning ? (
                                            <div className="flex items-center gap-3">
                                                <Loader2
                                                    size={16}
                                                    className="animate-spin text-primary"
                                                />
                                                Waiting for attack results...
                                            </div>
                                        ) : (
                                            "No results yet"
                                        )}
                                    </div>
                                ) : (
                                    <table className="w-full text-left font-mono text-sm border-collapse whitespace-nowrap">
                                        <thead className="sticky top-0 bg-[#050505] z-10 outline-1 outline outline-neutral-800">
                                            <tr>
                                                <th className="px-6 py-3 font-medium text-neutral-400 w-24">
                                                    STATUS
                                                </th>
                                                <th className="px-6 py-3 font-medium text-neutral-400 w-24">
                                                    METHOD
                                                </th>
                                                <th className="px-6 py-3 font-medium text-neutral-400">
                                                    ENDPOINT
                                                </th>
                                                <th className="px-6 py-3 font-medium text-neutral-400 min-w-[200px]">
                                                    PAYLOAD
                                                </th>
                                                <th className="px-6 py-3 font-medium text-neutral-400 text-right w-32">
                                                    TIME
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {results.map((row) => {
                                                const isError =
                                                    row.statusCode >= 500;
                                                const isSuccess =
                                                    row.statusCode >= 200 &&
                                                    row.statusCode < 300;

                                                return (
                                                    <tr
                                                        key={row.id}
                                                        className={`
                                                            border-b border-neutral-800/80 hover:bg-white/[0.04] transition-colors
                                                            ${isError ? "bg-destructive/5 hover:bg-destructive/10 !border-destructive/20 relative" : ""}
                                                        `}
                                                    >
                                                        {isError && (
                                                            <td className="absolute left-0 top-0 bottom-0 w-0.5 bg-destructive"></td>
                                                        )}
                                                        <td
                                                            className={`px-6 py-4 ${isError ? "text-destructive font-bold drop-shadow-[0_0_8px_rgba(220,38,38,0.4)]" : isSuccess ? "text-neutral-600" : "text-neutral-300"}`}
                                                        >
                                                            {row.statusCode}
                                                        </td>
                                                        <td
                                                            className={`px-6 py-4 ${isError ? "text-destructive/80" : "text-primary/70"}`}
                                                        >
                                                            {row.method}
                                                        </td>
                                                        <td
                                                            className={`px-6 py-4 ${isError ? "text-white" : "text-neutral-300"}`}
                                                        >
                                                            {row.endpoint}
                                                        </td>
                                                        <td
                                                            className="px-6 py-4 text-neutral-500 text-xs truncate max-w-sm xl:max-w-xl"
                                                            title={row.payload}
                                                        >
                                                            {row.payload}
                                                        </td>
                                                        <td className="px-6 py-4 text-right text-neutral-500">
                                                            {row.responseTime}ms
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};

export default Dashboard;

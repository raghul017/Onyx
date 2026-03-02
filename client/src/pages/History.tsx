// =============================================================================
// History Page — "Execution History"
// =============================================================================

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import { ArrowRight, Trash2 } from "lucide-react";
import {
    getAllTestRuns,
    deleteTestRun,
    GetAllTestRunsResponse,
} from "@/services/api";

const History = () => {
    const navigate = useNavigate();
    const [testRuns, setTestRuns] = useState<
        GetAllTestRunsResponse["testRuns"]
    >([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchHistory = async () => {
        try {
            setLoading(true);
            const data = await getAllTestRuns();
            setTestRuns(data.testRuns);
        } catch (err: any) {
            setError(err.message || "Failed to load execution history.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchHistory();
    }, []);

    const handleDelete = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (
            !window.confirm(
                "Are you sure you want to permanently delete this test run?",
            )
        ) {
            return;
        }
        try {
            await deleteTestRun(id);
            // Refresh history table
            fetchHistory();
        } catch (err: any) {
            alert(err.message || "Failed to delete test run.");
        }
    };

    const formatDate = (isoString: string) => {
        const date = new Date(isoString);
        return new Intl.DateTimeFormat("en-US", {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
        }).format(date);
    };

    return (
        <div className="relative min-h-screen bg-black text-white font-['Inter'] selection:bg-cyan-500/20">
            {/* The Slanted Fading Background Layer from Landing Page aesthetics */}
            <div
                className="fixed inset-0 pointer-events-none z-0"
                style={{
                    backgroundImage:
                        "repeating-linear-gradient(45deg, #111 0, #111 1px, transparent 1px, transparent 16px)",
                    WebkitMaskImage:
                        "linear-gradient(to bottom, black 10%, transparent 80%)",
                    maskImage:
                        "linear-gradient(to bottom, black 10%, transparent 80%)",
                }}
            />

            <Navbar />

            {/* Component Structure Master Grid container */}
            <div className="w-[90%] max-w-6xl mx-auto min-h-screen border-x border-[#2A2A2A] relative bg-black z-10 pt-32 pb-24">
                <div className="px-8 sm:px-12 w-full mx-auto flex flex-col items-start text-left">
                    {/* 1. Page Header */}
                    <h1 className="font-['Satoshi_Variable','Satoshi_Variable_Placeholder',sans-serif] font-normal text-3xl leading-tight text-white mb-2 tracking-tight">
                        Execution History
                    </h1>
                    <p className="text-neutral-500 text-sm mb-12">
                        Review past vulnerability scans and access historical
                        payload data.
                    </p>

                    {/* 2. The Audit Log Table */}
                    <div className="w-full bg-[#0A0A0A] border border-neutral-800 rounded-md overflow-hidden flex flex-col">
                        {/* Table Headers */}
                        <div className="grid grid-cols-[120px_1fr_120px_200px_100px_120px] gap-4 px-6 py-4 border-b border-neutral-800 text-xs text-neutral-500 uppercase tracking-wider">
                            <span>Date</span>
                            <span>Target API</span>
                            <span>Total Payloads</span>
                            <span>Completed Payloads</span>
                            <span>Status</span>
                            <span className="text-right">Action</span>
                        </div>

                        {/* Table Body */}
                        <div className="flex flex-col min-h-[400px]">
                            {loading ? (
                                <div className="flex-1 flex items-center justify-center text-neutral-500 font-mono text-sm">
                                    [ FETCHING_TELEMETRY ]
                                </div>
                            ) : error ? (
                                <div className="flex-1 flex items-center justify-center text-red-500 font-mono text-sm bg-red-500/5">
                                    {error}
                                </div>
                            ) : testRuns.length === 0 ? (
                                <div className="flex-1 flex items-center justify-center text-neutral-500 font-mono text-sm">
                                    No historical attack vectors found.
                                </div>
                            ) : (
                                testRuns.map((row) => (
                                    <div
                                        key={row.id}
                                        className="grid grid-cols-[120px_1fr_120px_200px_100px_120px] items-center gap-4 px-6 py-4 border-b border-neutral-800/50 last:border-b-0 hover:bg-white/5 transition-colors cursor-pointer group"
                                    >
                                        <span className="text-sm text-neutral-400 truncate pr-2">
                                            {formatDate(row.createdAt)}
                                        </span>
                                        <span className="text-sm font-['JetBrains_Mono'] text-neutral-300 truncate pr-4">
                                            {row.specUrl}
                                        </span>
                                        <span className="text-sm text-neutral-400">
                                            {row.totalAttacks}
                                        </span>
                                        <span
                                            className={`text-sm font-semibold ${
                                                row.completedAttacks > 0
                                                    ? "text-cyan-500"
                                                    : "text-neutral-600"
                                            }`}
                                        >
                                            {row.completedAttacks}
                                        </span>
                                        <span
                                            className={`text-sm ${
                                                row.status === "FAILED" ||
                                                row.status === "ABORTED"
                                                    ? "text-yellow-500"
                                                    : row.status === "COMPLETED"
                                                      ? "text-neutral-400"
                                                      : "text-cyan-400"
                                            }`}
                                        >
                                            {row.status}
                                        </span>
                                        <div className="text-right">
                                            <div className="flex items-center justify-end gap-3 w-full">
                                                <button
                                                    onClick={(e) =>
                                                        handleDelete(e, row.id)
                                                    }
                                                    className="p-1.5 text-neutral-600 hover:text-red-500 hover:bg-red-500/10 rounded transition-colors"
                                                    title="Delete Record"
                                                >
                                                    <Trash2 size={15} />
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        navigate(
                                                            `/report/${row.id}`,
                                                        );
                                                    }}
                                                    className="text-sm text-neutral-500 group-hover:text-white transition-colors flex items-center justify-end gap-1.5"
                                                >
                                                    View Report
                                                    <ArrowRight
                                                        size={14}
                                                        className="opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all"
                                                    />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default History;

// =============================================================================
// Report Page — Static historical test run review
// =============================================================================

import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Terminal, FileDown, Loader2 } from "lucide-react";
import ReportBody from "@/components/ReportBody";
import ShareReportControl from "@/components/ShareReportControl";
import {
    getTestRun,
    exportTestRunPDF,
    getCurrentUser,
    type GetTestRunResponse,
    type SeverityLevel,
    type CurrentUser,
} from "@/services/api";
import ColdStartBanner from "@/components/ColdStartBanner";
import AppHeader from "@/components/AppHeader";
import GoBackButton from "@/components/GoBackButton";

// ---------------------------------------------------------------------------
// Severity helpers
// ---------------------------------------------------------------------------

// Light-mono severity palette (shared language: red → orange → amber → blue → slate)
const SEV_COLOR: Record<string, string> = {
    CRITICAL: "#dc2626",
    HIGH: "#ea580c",
    MEDIUM: "#ca8a04",
    LOW: "#3b82f6",
    INFO: "#64748b",
};

function severityBadge(severity: SeverityLevel) {
    const c = SEV_COLOR[severity] ?? SEV_COLOR.INFO;
    return (
        <span
            className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-bold font-mono border"
            style={{ color: c, backgroundColor: `${c}12`, borderColor: `${c}40` }}
        >
            {severity}
        </span>
    );
}

// Score color as a hex (severity-aware): CRITICAL red → CLEAN green
function scoreHex(score: number): string {
    if (score <= 25) return "#dc2626";
    if (score <= 50) return "#ea580c";
    if (score <= 75) return "#ca8a04";
    return "#16a34a";
}

function scoreLabelText(label: string): string {
    switch (label) {
        case "CLEAN":    return "CLEAN";
        case "LOW":      return "LOW RISK";
        case "MEDIUM":   return "MEDIUM RISK";
        case "HIGH":     return "HIGH RISK";
        case "CRITICAL": return "CRITICAL RISK";
        default:         return label;
    }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const SEVERITY_FILTERS = ["ALL", "CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"] as const;
type FilterValue = typeof SEVERITY_FILTERS[number];

const Report = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const [data, setData] = useState<GetTestRunResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [exporting, setExporting] = useState(false);
    const [severityFilter, setSeverityFilter] = useState<FilterValue>("ALL");
    const [user, setUser] = useState<CurrentUser | null>(null);
    const [expandedId, setExpandedId] = useState<string | null>(null);

    useEffect(() => {
        getCurrentUser().then(setUser).catch(() => {});
    }, []);

    useEffect(() => {
        if (!id) return;
        const fetchData = async () => {
            try {
                const res = await getTestRun(id);
                setData(res);
            } catch (err: any) {
                setError(err.response?.data?.error || "Failed to load report data");
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [id]);

    const logs = data?.logs || [];
    const summary = data?.summary;

    const completedCount = logs.length;
    const totalPayloads = summary?.totalAttacks || 0;

    const criticalCount = useMemo(
        () => logs.filter((l) => l.statusCode >= 500).length,
        [logs],
    );
    const blockedCount = useMemo(
        () => logs.filter((l) => l.statusCode >= 400 && l.statusCode < 500).length,
        [logs],
    );
    const infoCount = useMemo(
        () => logs.filter((l) => l.statusCode >= 200 && l.statusCode < 300).length,
        [logs],
    );
    const avgLatency = useMemo(() => {
        if (logs.length === 0) return 0;
        return Math.round(logs.reduce((acc, l) => acc + l.responseTime, 0) / logs.length);
    }, [logs]);

    const filteredLogs = useMemo(() => {
        if (severityFilter === "ALL") return logs;
        return logs.filter((l) => l.severity === severityFilter);
    }, [logs, severityFilter]);

    const progressPct =
        totalPayloads > 0 ? Math.min(100, Math.round((completedCount / totalPayloads) * 100)) : 0;

    const statusLabel =
        summary?.status === "COMPLETED"
            ? "SEQUENCE COMPLETE"
            : summary?.status === "FAILED" || summary?.status === "ABORTED"
              ? "SEQUENCE TERMINATED"
              : "UNKNOWN STATUS";

    const breakdown = summary?.severityBreakdown ?? { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    const breakdownTotal = breakdown.critical + breakdown.high + breakdown.medium + breakdown.low + breakdown.info;

    const overallScore = summary?.overallScore ?? 100;
    const scoreLabel = summary?.scoreLabel ?? "CLEAN";

    const getRowClass = (sev: SeverityLevel) => {
        switch (sev) {
            case "CRITICAL": return "bg-[#fef2f2] border-l-2 border-l-[#dc2626]";
            case "HIGH":     return "bg-[#fff7ed] border-l-2 border-l-[#ea580c]";
            case "MEDIUM":   return "bg-[#fefce8] border-l-2 border-l-[#ca8a04]";
            case "LOW":      return "border-l-2 border-l-[#93c5fd]";
            default:         return "border-l-2 border-l-transparent";
        }
    };

    const getMethodColor = (method: string) => {
        switch (method) {
            case "GET":    return "text-[#3b82f6]";
            case "POST":   return "text-[#16a34a]";
            case "PUT":    return "text-[#ca8a04]";
            case "DELETE": return "text-[#dc2626]";
            case "PATCH":  return "text-[#7c3aed]";
            default:       return "text-[#666]";
        }
    };

    const formatTime = (ts: number | string) => {
        const d = new Date(ts);
        return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
    };

    const handleExportPDF = async () => {
        if (!id) return;
        setExporting(true);
        try {
            const result = await exportTestRunPDF(id);
            if (result === "plan_required") navigate("/billing");
        } catch {
            // silent
        } finally {
            setExporting(false);
        }
    };

    return (
        <div className="onyx-mono relative min-h-screen flex flex-col overflow-x-clip">
            {/* Shared app header */}
            <div className="relative z-30">
                <AppHeader user={user} />
            </div>

            <ColdStartBanner />

            {/* Report sub-bar: back to history · target · status · export */}
            <div className="relative z-10 shrink-0 border-b border-[#e6e6e6] bg-white px-5 sm:px-8 lg:px-12 py-3 flex items-center gap-3">
                <GoBackButton to="/history" label="History" size="sm" className="shrink-0" />
                <span className="hidden md:block w-px h-4 bg-[#e6e6e6] shrink-0" aria-hidden="true" />
                <div className="hidden md:flex items-center gap-2 flex-1 min-w-0">
                    <Terminal size={12} className="text-[#999] shrink-0" />
                    <span className="font-mono text-[12px] text-[#666] truncate">
                        {loading ? "Decrypting logs..." : summary?.specUrl || "Unknown Target"}
                    </span>
                </div>
                <div className="hidden sm:flex items-center gap-2 text-[11px] font-mono uppercase tracking-wider shrink-0">
                    <span className={`w-2 h-2 rounded-full ${statusLabel === "SEQUENCE COMPLETE" ? "bg-[#16a34a]" : "bg-[#dc2626]"}`} />
                    <span className="text-[#999]">{statusLabel}</span>
                </div>
                {/* T16b — share this report read-only via a public link. */}
                {summary?.status === "COMPLETED" && id && (
                    <ShareReportControl testRunId={id} />
                )}
                {summary?.status === "COMPLETED" && (
                    <button
                        onClick={handleExportPDF}
                        disabled={exporting}
                        className="flex items-center gap-1.5 px-4 py-1.5 bg-black text-white text-[12px] font-medium hover:bg-[#1a1a1a] transition-[background-color,transform] active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3b82f6]"
                    >
                        {exporting ? <Loader2 size={11} className="animate-spin" /> : <FileDown size={11} />}
                        {exporting ? "Exporting..." : "Export PDF"}
                    </button>
                )}
            </div>

            {/* Report content — shared with the PUBLIC /shared/:token page so
                both render the identical report from the identical payload. */}
            {data && <ReportBody data={data} loading={loading} error={error} />}
        </div>
    );
};

export default Report;

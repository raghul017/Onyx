// =============================================================================
// DomainVerifyPanel — Domain ownership verification before launching a scan
// =============================================================================

import { useState } from "react";
import { ShieldCheck, Copy, Check, Loader2, AlertTriangle } from "lucide-react";
import {
    initiateVerification,
    checkVerification,
} from "@/services/api";

interface DomainVerifyPanelProps {
    specUrl: string;
    onVerified: (domain: string) => void;
}

type Step = "idle" | "pending" | "verified";

export default function DomainVerifyPanel({ specUrl, onVerified }: DomainVerifyPanelProps) {
    const [step, setStep] = useState<Step>("idle");
    const [token, setToken] = useState<string | null>(null);
    const [domain, setDomain] = useState<string | null>(null);
    const [verifiedAt, setVerifiedAt] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<"file" | "dns">("file");
    const [loading, setLoading] = useState(false);
    const [checking, setChecking] = useState(false);
    const [copied, setCopied] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleInitiate = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await initiateVerification(specUrl);
            setDomain(res.domain);
            setToken(res.token);
            if (res.alreadyVerified && res.verifiedAt) {
                setVerifiedAt(res.verifiedAt);
                setStep("verified");
                onVerified(res.domain);
            } else {
                setStep("pending");
            }
        } catch (err: any) {
            setError(err?.response?.data?.message ?? "Failed to initiate verification.");
        } finally {
            setLoading(false);
        }
    };

    const handleCheck = async () => {
        if (!domain) return;
        setChecking(true);
        setError(null);
        try {
            const res = await checkVerification(domain);
            if (res.verified && res.verifiedAt) {
                setVerifiedAt(res.verifiedAt);
                setStep("verified");
                onVerified(domain);
            } else {
                setError("Verification not found yet. Make sure the file or DNS record is in place, then try again.");
            }
        } catch (err: any) {
            setError(err?.response?.data?.message ?? "Check failed. Please try again.");
        } finally {
            setChecking(false);
        }
    };

    const handleCopy = () => {
        if (!token) return;
        navigator.clipboard.writeText(token);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    if (step === "verified") {
        return (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/30 rounded-sm text-[11px] font-['JetBrains_Mono'] text-emerald-400">
                <ShieldCheck size={12} />
                <span>DOMAIN VERIFIED</span>
                {verifiedAt && (
                    <span className="text-emerald-600 ml-1">
                        {new Date(verifiedAt).toLocaleDateString()}
                    </span>
                )}
            </div>
        );
    }

    if (step === "idle") {
        return (
            <div className="flex items-center gap-2">
                <button
                    type="button"
                    onClick={handleInitiate}
                    disabled={loading || !specUrl.trim()}
                    className="shrink-0 bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-[12px] font-bold px-3 py-1.5 rounded-sm hover:bg-cyan-500/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1.5 font-['Geist']"
                >
                    {loading ? <Loader2 size={11} className="animate-spin" /> : <ShieldCheck size={11} />}
                    {loading ? "Preparing..." : "Verify Domain"}
                </button>
                {error && (
                    <span className="text-red-400 text-[11px] font-['JetBrains_Mono'] flex items-center gap-1">
                        <AlertTriangle size={10} /> {error}
                    </span>
                )}
            </div>
        );
    }

    // step === "pending"
    return (
        <div className="border border-neutral-800 bg-[#0A0A0A] rounded-sm p-4 space-y-3">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-[11px] font-['JetBrains_Mono'] uppercase tracking-wider text-neutral-400">
                    <ShieldCheck size={11} className="text-cyan-400" />
                    Verify ownership of <span className="text-cyan-400">{domain}</span>
                </div>
                {/* Tab toggle */}
                <div className="flex text-[10px] font-['JetBrains_Mono']">
                    <button
                        type="button"
                        onClick={() => setActiveTab("file")}
                        className={`px-2 py-1 border-b ${activeTab === "file" ? "border-cyan-500 text-cyan-400" : "border-neutral-700 text-neutral-500 hover:text-neutral-300"}`}
                    >
                        FILE
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab("dns")}
                        className={`px-2 py-1 border-b ${activeTab === "dns" ? "border-cyan-500 text-cyan-400" : "border-neutral-700 text-neutral-500 hover:text-neutral-300"}`}
                    >
                        DNS
                    </button>
                </div>
            </div>

            {/* Instructions */}
            <p className="text-[11px] text-neutral-500 font-['JetBrains_Mono']">
                {activeTab === "file"
                    ? `Place a file at: https://${domain}/.well-known/onyx-verify.txt`
                    : `Add a DNS TXT record: _onyx-verify.${domain}`}
            </p>

            {/* Token box */}
            <div className="flex items-center gap-2 bg-[#111] border border-neutral-800 rounded-sm px-3 py-2">
                <span className="flex-1 font-['JetBrains_Mono'] text-[11px] text-neutral-300 select-all break-all">
                    {token}
                </span>
                <button
                    type="button"
                    onClick={handleCopy}
                    className="shrink-0 text-neutral-500 hover:text-white transition-colors"
                    aria-label="Copy token"
                >
                    {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                </button>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3">
                <button
                    type="button"
                    onClick={handleCheck}
                    disabled={checking}
                    className="bg-white text-black text-[12px] font-bold px-4 py-1.5 rounded-sm hover:bg-neutral-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 font-['Geist']"
                >
                    {checking ? <Loader2 size={11} className="animate-spin" /> : <ShieldCheck size={11} />}
                    {checking ? "Checking..." : "Check Verification"}
                </button>
                <button
                    type="button"
                    onClick={() => { setStep("idle"); setError(null); }}
                    className="text-neutral-500 hover:text-white text-[12px] font-['Geist'] transition-colors"
                >
                    Cancel
                </button>
            </div>

            {error && (
                <p className="text-red-400 text-[11px] font-['JetBrains_Mono'] flex items-center gap-1.5">
                    <AlertTriangle size={10} /> {error}
                </p>
            )}
        </div>
    );
}

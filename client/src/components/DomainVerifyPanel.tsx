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
            <div className="flex items-center gap-2 px-3 py-1.5 bg-[#f0fdf4] border border-[#86efac] text-[11px] font-mono text-[#16a34a]">
                <ShieldCheck size={12} />
                <span>DOMAIN VERIFIED</span>
                {verifiedAt && (
                    <span className="text-[#16a34a]/70 ml-1">
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
                    className="shrink-0 bg-[#f0f6ff] border border-[#93c5fd] text-[#3b82f6] text-[12px] font-medium px-3 h-10 sm:h-auto sm:py-1.5 hover:bg-[#e0edff] transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                >
                    {loading ? <Loader2 size={11} className="animate-spin" /> : <ShieldCheck size={11} />}
                    {loading ? "Preparing..." : "Verify Domain"}
                </button>
                {error && (
                    <span className="text-[#dc2626] text-[11px] font-mono flex items-center gap-1">
                        <AlertTriangle size={10} /> {error}
                    </span>
                )}
            </div>
        );
    }

    // step === "pending"
    return (
        <div className="border border-[#e6e6e6] bg-white p-4 space-y-3">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-wider text-[#666]">
                    <ShieldCheck size={11} className="text-[#3b82f6]" />
                    Verify ownership of <span className="text-[#3b82f6]">{domain}</span>
                </div>
                {/* Tab toggle */}
                <div className="flex text-[10px] font-mono">
                    <button
                        type="button"
                        onClick={() => setActiveTab("file")}
                        className={`px-2 py-1 border-b-2 transition-colors ${activeTab === "file" ? "border-[#3b82f6] text-[#3b82f6]" : "border-transparent text-[#999] hover:text-black"}`}
                    >
                        FILE
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab("dns")}
                        className={`px-2 py-1 border-b-2 transition-colors ${activeTab === "dns" ? "border-[#3b82f6] text-[#3b82f6]" : "border-transparent text-[#999] hover:text-black"}`}
                    >
                        DNS
                    </button>
                </div>
            </div>

            {/* Instructions */}
            <p className="text-[11px] text-[#666] font-mono">
                {activeTab === "file"
                    ? `Place a file at: https://${domain}/.well-known/onyx-verify.txt`
                    : `Add a DNS TXT record: _onyx-verify.${domain}`}
            </p>

            {/* Token box */}
            <div className="flex items-center gap-2 bg-[#fafafa] border border-[#e6e6e6] px-3 py-2">
                <span className="flex-1 font-mono text-[11px] text-[#333] select-all break-all">
                    {token}
                </span>
                <button
                    type="button"
                    onClick={handleCopy}
                    className="shrink-0 text-[#999] hover:text-black transition-colors"
                    aria-label="Copy token"
                >
                    {copied ? <Check size={13} className="text-[#16a34a]" /> : <Copy size={13} />}
                </button>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3">
                <button
                    type="button"
                    onClick={handleCheck}
                    disabled={checking}
                    className="bg-black text-white text-[12px] font-medium px-4 py-1.5 hover:bg-[#1a1a1a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                >
                    {checking ? <Loader2 size={11} className="animate-spin" /> : <ShieldCheck size={11} />}
                    {checking ? "Checking..." : "Check Verification"}
                </button>
                <button
                    type="button"
                    onClick={() => { setStep("idle"); setError(null); }}
                    className="text-[#666] hover:text-black text-[12px] transition-colors"
                >
                    Cancel
                </button>
            </div>

            {error && (
                <p className="text-[#dc2626] text-[11px] font-mono flex items-center gap-1.5">
                    <AlertTriangle size={10} /> {error}
                </p>
            )}
        </div>
    );
}

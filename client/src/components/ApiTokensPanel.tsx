// =============================================================================
// ApiTokensPanel — manage long-lived API tokens (T10a). Mirrors AuthRecipesPanel.
//
// The plaintext token is shown EXACTLY ONCE, right after creation, in a copyable
// field with a "you won't see this again" note. The list only ever shows the
// masked form (onyx_••••last4). Light-mono styling matches Settings.
// =============================================================================

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { KeyRound, Plus, Trash2, Loader2, X, Copy, Check, AlertTriangle } from "lucide-react";
import {
    listApiTokens,
    createApiToken,
    revokeApiToken,
    type ApiToken,
    type CreatedApiToken,
} from "@/services/api";

const INPUT_CLASS =
    "w-full bg-white border border-[#e6e6e6] text-black font-mono text-[13px] px-3 py-2 outline-none focus:border-black transition-colors placeholder:text-[#999]";

function fmtDate(iso: string | null): string {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export default function ApiTokensPanel() {
    const qc = useQueryClient();
    const { data, isLoading, isError } = useQuery({
        queryKey: ["api-tokens"],
        queryFn: listApiTokens,
    });
    const tokens = data?.tokens ?? [];

    const [creating, setCreating] = useState(false);
    const [name, setName] = useState("");
    const [formError, setFormError] = useState<string | null>(null);
    // The freshly-minted plaintext token — shown once, then dismissed.
    const [newToken, setNewToken] = useState<CreatedApiToken | null>(null);
    const [copied, setCopied] = useState(false);

    const invalidate = () => qc.invalidateQueries({ queryKey: ["api-tokens"] });
    const errMsg = (e: any) =>
        e?.response?.data?.message ?? e?.response?.data?.error ?? "Something went wrong.";

    const createMut = useMutation({
        mutationFn: createApiToken,
        onSuccess: (created) => {
            invalidate();
            setNewToken(created);
            setName("");
            setCreating(false);
        },
        onError: (e) => setFormError(errMsg(e)),
    });

    const revokeMut = useMutation({
        mutationFn: revokeApiToken,
        onSuccess: invalidate,
    });

    const handleCreate = (e: React.FormEvent) => {
        e.preventDefault();
        setFormError(null);
        if (!name.trim()) {
            setFormError("Name is required.");
            return;
        }
        createMut.mutate(name.trim());
    };

    const handleCopy = () => {
        if (!newToken) return;
        navigator.clipboard.writeText(newToken.token);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleRevoke = (t: ApiToken) => {
        if (window.confirm(`Revoke token "${t.name}"? Any CLI/CI using it will stop working.`)) {
            revokeMut.mutate(t.id);
        }
    };

    return (
        <div className="border border-[#e6e6e6] bg-white p-5">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <KeyRound size={14} className="text-[#3b82f6]" />
                    <h2 className="text-sm font-semibold">API tokens</h2>
                </div>
                {!creating && !newToken && (
                    <button onClick={() => setCreating(true)} className="mono-btn !py-1.5 !px-3 !text-[12px]">
                        <Plus size={12} /> New token
                    </button>
                )}
            </div>
            <p className="text-[#666] text-[13px] mb-5">
                Long-lived tokens to authenticate the Onyx CLI / CI non-interactively. A token acts
                as you and is shown in full <span className="font-semibold">only once</span> — store it
                somewhere safe.
            </p>

            {/* Freshly-created token — shown ONCE */}
            {newToken && (
                <div className="mb-5 border border-[#93c5fd] bg-[#f0f6ff] p-4">
                    <div className="flex items-start gap-2 mb-2">
                        <AlertTriangle size={14} className="text-[#3b82f6] mt-0.5 shrink-0" />
                        <p className="text-[13px] text-[#1e3a8a]">
                            Copy <span className="font-semibold">{newToken.name}</span> now — you won't be able
                            to see it again.
                        </p>
                    </div>
                    <div className="flex items-center gap-2 bg-white border border-[#93c5fd] px-3 py-2">
                        <code className="flex-1 text-[12px] font-mono text-[#1e3a8a] break-all">{newToken.token}</code>
                        <button
                            onClick={handleCopy}
                            className="text-[#666] hover:text-black transition-colors shrink-0"
                            title="Copy token"
                        >
                            {copied ? <Check size={14} className="text-[#16a34a]" /> : <Copy size={14} />}
                        </button>
                    </div>
                    <button
                        onClick={() => setNewToken(null)}
                        className="mt-3 text-[12px] text-[#666] hover:text-black transition-colors"
                    >
                        I've saved it — dismiss
                    </button>
                </div>
            )}

            {/* Create form */}
            {creating && !newToken && (
                <form onSubmit={handleCreate} className="mb-5 border-b border-[#e6e6e6] pb-5">
                    <div className="flex items-center justify-between mb-2">
                        <label className="block text-[11px] text-[#999] uppercase tracking-wider font-mono">
                            Token name
                        </label>
                        <button type="button" onClick={() => { setCreating(false); setFormError(null); }} className="text-[#999] hover:text-black transition-colors">
                            <X size={14} />
                        </button>
                    </div>
                    <div className="flex gap-2">
                        <input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="CI pipeline"
                            className={INPUT_CLASS}
                            autoFocus
                        />
                        <button type="submit" disabled={createMut.isPending} className="mono-btn !py-2 disabled:opacity-40 shrink-0">
                            {createMut.isPending ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                            Create
                        </button>
                    </div>
                    {formError && <p className="text-[#dc2626] text-[12px] mt-2">{formError}</p>}
                </form>
            )}

            {/* List */}
            {isLoading ? (
                <div className="flex items-center gap-2 text-[#999] text-[13px] py-4">
                    <Loader2 size={14} className="animate-spin text-[#3b82f6]" /> Loading…
                </div>
            ) : isError ? (
                <p className="text-[#dc2626] text-[13px] py-3">Failed to load tokens.</p>
            ) : tokens.length === 0 ? (
                <div className="border border-dashed border-[#e6e6e6] bg-[#fafafa] px-4 py-6 text-center">
                    <p className="text-[#666] text-[13px] mb-3">No API tokens yet.</p>
                    {!creating && !newToken && (
                        <button onClick={() => setCreating(true)} className="mono-btn !py-1.5 !px-3 !text-[12px]">
                            <Plus size={12} /> Create token
                        </button>
                    )}
                </div>
            ) : (
                <div className="border border-[#e6e6e6] overflow-hidden">
                    <div className="grid grid-cols-[1fr_130px_100px_100px_64px] text-[11px] text-[#999] uppercase tracking-wider px-4 py-2 bg-[#fafafa] border-b border-[#e6e6e6] font-mono">
                        <span>Name</span>
                        <span>Token</span>
                        <span>Created</span>
                        <span>Last used</span>
                        <span />
                    </div>
                    {tokens.map((t) => (
                        <div
                            key={t.id}
                            className={`grid grid-cols-[1fr_130px_100px_100px_64px] items-center px-4 py-3 border-b border-[#e6e6e6] last:border-0 bg-white hover:bg-[#f9f9f9] ${t.revoked ? "opacity-60" : ""}`}
                        >
                            <span className="min-w-0">
                                <span className="block text-[13px] text-[#333] truncate">{t.name}</span>
                                {t.revoked && (
                                    <span className="text-[10px] font-mono uppercase tracking-wide text-[#dc2626]">Revoked</span>
                                )}
                            </span>
                            <span className="text-[12px] text-[#999] font-mono truncate">{t.maskedToken}</span>
                            <span className="text-[11px] text-[#666] font-mono">{fmtDate(t.createdAt)}</span>
                            <span className="text-[11px] text-[#666] font-mono">{fmtDate(t.lastUsedAt)}</span>
                            <span className="flex justify-end">
                                {!t.revoked && (
                                    <button
                                        onClick={() => handleRevoke(t)}
                                        className="text-[#999] hover:text-[#dc2626] transition-colors"
                                        title="Revoke"
                                    >
                                        <Trash2 size={13} />
                                    </button>
                                )}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

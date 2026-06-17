// =============================================================================
// Settings — Organization management page
// =============================================================================

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, Users, Copy, Check, Trash2, ArrowLeft, Plus, Loader2, Shield } from "lucide-react";
import {
    getCurrentUser,
    getOrgMembers,
    createOrgApi,
    createInviteApi,
    listInvitesApi,
    revokeInviteApi,
    removeMemberApi,
    updateMemberRoleApi,
    deleteOrgApi,
    type CurrentUser,
    type OrgMember,
    type OrgInvite,
    type OrgRole,
    type OrgSummary,
} from "@/services/api";
import { useOrgStore } from "@/store/useOrgStore";

type Tab = "org" | "members";

export default function Settings() {
    const navigate = useNavigate();
    const { activeOrg, setActiveOrg, clearOrg } = useOrgStore();

    const [user, setUser] = useState<CurrentUser | null>(null);
    const [tab, setTab] = useState<Tab>("org");
    const [members, setMembers] = useState<OrgMember[]>([]);
    const [invites, setInvites] = useState<OrgInvite[]>([]);
    const [loading, setLoading] = useState(true);

    // Create org form
    const [orgName, setOrgName] = useState("");
    const [creating, setCreating] = useState(false);
    const [createError, setCreateError] = useState<string | null>(null);

    // Invite form
    const [inviteEmail, setInviteEmail] = useState("");
    const [inviteRole, setInviteRole] = useState<OrgRole>("VIEWER");
    const [inviting, setInviting] = useState(false);
    const [inviteUrl, setInviteUrl] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const [inviteError, setInviteError] = useState<string | null>(null);

    const currentOrg: OrgSummary | null = activeOrg
        ? (user?.orgs.find((o) => o.id === activeOrg.id) ?? null)
        : null;
    const myRole = currentOrg?.role ?? null;
    const isOwner = myRole === "OWNER";
    const isAdmin = myRole === "OWNER" || myRole === "ADMIN";

    useEffect(() => {
        getCurrentUser().then(setUser).catch(() => {}).finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        if (!activeOrg) return;
        getOrgMembers(activeOrg.id).then((r) => setMembers(r.members)).catch(() => {});
        if (isAdmin) {
            listInvitesApi(activeOrg.id).then((r) => setInvites(r.invites)).catch(() => {});
        }
    }, [activeOrg?.id, isAdmin]);

    const handleCreateOrg = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!orgName.trim()) return;
        setCreating(true);
        setCreateError(null);
        try {
            const { org } = await createOrgApi(orgName.trim());
            const freshUser = await getCurrentUser();
            setUser(freshUser);
            const orgWithRole = freshUser.orgs.find((o) => o.id === org.id);
            if (orgWithRole) setActiveOrg(orgWithRole);
            setOrgName("");
        } catch (err: any) {
            setCreateError(err?.response?.data?.error ?? "Failed to create organization");
        } finally {
            setCreating(false);
        }
    };

    const handleInvite = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!activeOrg || !inviteEmail.trim()) return;
        setInviting(true);
        setInviteError(null);
        setInviteUrl(null);
        try {
            const { invite } = await createInviteApi(activeOrg.id, inviteEmail.trim(), inviteRole);
            setInviteUrl(invite.inviteUrl);
            setInviteEmail("");
            const fresh = await listInvitesApi(activeOrg.id);
            setInvites(fresh.invites);
        } catch (err: any) {
            setInviteError(err?.response?.data?.error ?? "Failed to create invite");
        } finally {
            setInviting(false);
        }
    };

    const handleCopyInvite = () => {
        if (!inviteUrl) return;
        navigator.clipboard.writeText(inviteUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleRevokeInvite = async (inviteId: string) => {
        if (!activeOrg) return;
        await revokeInviteApi(activeOrg.id, inviteId).catch(() => {});
        setInvites((prev) => prev.filter((i) => i.id !== inviteId));
    };

    const handleRemoveMember = async (userId: string) => {
        if (!activeOrg) return;
        await removeMemberApi(activeOrg.id, userId).catch(() => {});
        setMembers((prev) => prev.filter((m) => m.userId !== userId));
    };

    const handleRoleChange = async (userId: string, role: OrgRole) => {
        if (!activeOrg) return;
        await updateMemberRoleApi(activeOrg.id, userId, role).catch(() => {});
        setMembers((prev) => prev.map((m) => m.userId === userId ? { ...m, role } : m));
    };

    const handleDeleteOrg = async () => {
        if (!activeOrg || !window.confirm(`Delete "${activeOrg.name}"? This cannot be undone.`)) return;
        await deleteOrgApi(activeOrg.id).catch(() => {});
        clearOrg();
        const freshUser = await getCurrentUser();
        setUser(freshUser);
    };

    if (loading) {
        return (
            <div className="h-screen bg-black flex items-center justify-center">
                <Loader2 className="text-neutral-600 animate-spin" size={20} />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black text-white font-['Inter']">
            <div className="w-[90%] max-w-3xl mx-auto py-10">
                {/* Header */}
                <div className="flex items-center gap-3 mb-8">
                    <button onClick={() => navigate("/dashboard")} className="text-neutral-600 hover:text-white transition-colors">
                        <ArrowLeft size={16} />
                    </button>
                    <Shield size={16} className="text-cyan-400" />
                    <h1 className="text-lg font-semibold tracking-tight">Settings</h1>
                </div>

                {/* No org — create one */}
                {!activeOrg && (
                    <div className="border border-neutral-800 bg-[#0A0A0A] rounded-sm p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <Building2 size={14} className="text-cyan-400" />
                            <h2 className="text-sm font-semibold">Create an Organization</h2>
                        </div>
                        <p className="text-neutral-500 text-[13px] mb-5">
                            Organizations let you share test runs, invite team members, and manage a shared plan.
                        </p>
                        <form onSubmit={handleCreateOrg} className="flex gap-2">
                            <input
                                type="text"
                                value={orgName}
                                onChange={(e) => setOrgName(e.target.value)}
                                placeholder="Acme Corp"
                                className="flex-1 bg-[#111] border border-neutral-800 text-neutral-300 text-[13px] px-3 py-2 rounded-sm outline-none focus:border-neutral-600 transition-colors placeholder:text-neutral-700"
                            />
                            <button
                                type="submit"
                                disabled={creating || !orgName.trim()}
                                className="bg-white text-black text-[13px] font-bold px-4 py-2 rounded-sm hover:bg-neutral-200 transition-colors disabled:opacity-40 flex items-center gap-1.5"
                            >
                                {creating ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                                Create
                            </button>
                        </form>
                        {createError && <p className="text-red-400 text-[12px] mt-2">{createError}</p>}

                        {/* Existing orgs they can switch to */}
                        {user && user.orgs.length > 0 && (
                            <div className="mt-6 border-t border-neutral-800 pt-5">
                                <p className="text-neutral-500 text-[12px] mb-3 uppercase tracking-wider">Your organizations</p>
                                <div className="space-y-2">
                                    {user.orgs.map((org) => (
                                        <button
                                            key={org.id}
                                            onClick={() => setActiveOrg(org)}
                                            className="w-full flex items-center gap-3 px-3 py-2 bg-neutral-900 hover:bg-neutral-800 rounded-sm text-left transition-colors"
                                        >
                                            <Building2 size={12} className="text-neutral-500" />
                                            <span className="text-[13px] text-neutral-300 flex-1">{org.name}</span>
                                            <span className="text-[10px] text-neutral-600 uppercase">{org.role}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Org management */}
                {activeOrg && (
                    <>
                        {/* Org header */}
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-2">
                                <Building2 size={14} className="text-cyan-400" />
                                <h2 className="text-sm font-semibold">{activeOrg.name}</h2>
                                <span className="text-[10px] text-neutral-600 font-['JetBrains_Mono'] border border-neutral-800 px-1.5 py-0.5 rounded-sm">{activeOrg.plan}</span>
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-neutral-500 font-['JetBrains_Mono']">
                                Your role: <span className="text-cyan-400 font-bold">{myRole}</span>
                            </div>
                        </div>

                        {/* Tabs */}
                        <div className="flex border-b border-neutral-800 mb-6 text-[12px]">
                            {(["org", "members"] as Tab[]).map((t) => (
                                <button
                                    key={t}
                                    onClick={() => setTab(t)}
                                    className={`px-4 py-2 font-medium capitalize transition-colors border-b-2 -mb-px ${tab === t ? "border-cyan-500 text-white" : "border-transparent text-neutral-500 hover:text-neutral-300"}`}
                                >
                                    {t === "org" ? "Organization" : "Members"}
                                </button>
                            ))}
                        </div>

                        {/* Tab: Organization */}
                        {tab === "org" && (
                            <div className="space-y-6">
                                <div className="border border-neutral-800 bg-[#0A0A0A] rounded-sm p-5">
                                    <p className="text-[12px] text-neutral-500 mb-1 uppercase tracking-wider">Slug</p>
                                    <p className="text-neutral-300 font-['JetBrains_Mono'] text-[13px]">{activeOrg.slug}</p>
                                </div>

                                {/* Switch org */}
                                {user && user.orgs.length > 1 && (
                                    <div className="border border-neutral-800 bg-[#0A0A0A] rounded-sm p-5">
                                        <p className="text-[12px] text-neutral-500 mb-3 uppercase tracking-wider">Switch Organization</p>
                                        <div className="space-y-2">
                                            {user.orgs.filter(o => o.id !== activeOrg.id).map((org) => (
                                                <button
                                                    key={org.id}
                                                    onClick={() => setActiveOrg(org)}
                                                    className="w-full flex items-center gap-3 px-3 py-2 bg-neutral-900 hover:bg-neutral-800 rounded-sm text-left transition-colors"
                                                >
                                                    <Building2 size={12} className="text-neutral-500" />
                                                    <span className="text-[13px] text-neutral-300 flex-1">{org.name}</span>
                                                    <span className="text-[10px] text-neutral-600 uppercase">{org.role}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {isOwner && (
                                    <div className="border border-red-900/40 bg-red-950/10 rounded-sm p-5">
                                        <p className="text-[12px] text-red-400 mb-3 font-semibold">Danger Zone</p>
                                        <button
                                            onClick={handleDeleteOrg}
                                            className="flex items-center gap-2 text-[13px] text-red-400 hover:text-red-300 transition-colors"
                                        >
                                            <Trash2 size={13} /> Delete Organization
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Tab: Members */}
                        {tab === "members" && (
                            <div className="space-y-6">
                                {/* Members table */}
                                <div className="border border-neutral-800 rounded-sm overflow-hidden">
                                    <div className="grid grid-cols-[1fr_100px_80px] text-[11px] text-neutral-600 uppercase tracking-wider px-4 py-2 bg-[#0A0A0A] border-b border-neutral-800">
                                        <span>Email</span><span>Role</span><span />
                                    </div>
                                    {members.map((m) => (
                                        <div key={m.id} className="grid grid-cols-[1fr_100px_80px] items-center px-4 py-3 border-b border-neutral-900 last:border-0 hover:bg-neutral-900/40">
                                            <span className="text-[13px] text-neutral-300 truncate">{m.email}</span>
                                            <span>
                                                {isOwner && m.userId !== user?.id ? (
                                                    <select
                                                        value={m.role}
                                                        onChange={(e) => handleRoleChange(m.userId, e.target.value as OrgRole)}
                                                        className="bg-neutral-900 border border-neutral-800 text-neutral-300 text-[11px] px-1 py-0.5 rounded-sm outline-none"
                                                    >
                                                        <option value="OWNER">OWNER</option>
                                                        <option value="ADMIN">ADMIN</option>
                                                        <option value="VIEWER">VIEWER</option>
                                                    </select>
                                                ) : (
                                                    <span className="text-[11px] text-neutral-500 uppercase">{m.role}</span>
                                                )}
                                            </span>
                                            <span className="flex justify-end">
                                                {isOwner && m.userId !== user?.id && (
                                                    <button
                                                        onClick={() => handleRemoveMember(m.userId)}
                                                        className="text-neutral-600 hover:text-red-400 transition-colors"
                                                    >
                                                        <Trash2 size={13} />
                                                    </button>
                                                )}
                                            </span>
                                        </div>
                                    ))}
                                </div>

                                {/* Invite form */}
                                {isAdmin && (
                                    <div className="border border-neutral-800 bg-[#0A0A0A] rounded-sm p-5">
                                        <div className="flex items-center gap-2 mb-4">
                                            <Users size={13} className="text-cyan-400" />
                                            <h3 className="text-[13px] font-semibold">Invite Member</h3>
                                        </div>
                                        <form onSubmit={handleInvite} className="flex gap-2 mb-3">
                                            <input
                                                type="email"
                                                value={inviteEmail}
                                                onChange={(e) => setInviteEmail(e.target.value)}
                                                placeholder="colleague@company.com"
                                                className="flex-1 bg-[#111] border border-neutral-800 text-neutral-300 text-[12px] px-3 py-1.5 rounded-sm outline-none focus:border-neutral-600 placeholder:text-neutral-700"
                                            />
                                            <select
                                                value={inviteRole}
                                                onChange={(e) => setInviteRole(e.target.value as OrgRole)}
                                                className="bg-[#111] border border-neutral-800 text-neutral-300 text-[12px] px-2 py-1.5 rounded-sm outline-none"
                                            >
                                                <option value="VIEWER">VIEWER</option>
                                                <option value="ADMIN">ADMIN</option>
                                            </select>
                                            <button
                                                type="submit"
                                                disabled={inviting || !inviteEmail.trim()}
                                                className="bg-white text-black text-[12px] font-bold px-3 py-1.5 rounded-sm hover:bg-neutral-200 transition-colors disabled:opacity-40 flex items-center gap-1"
                                            >
                                                {inviting ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
                                                Invite
                                            </button>
                                        </form>
                                        {inviteError && <p className="text-red-400 text-[12px] mb-3">{inviteError}</p>}

                                        {/* Invite URL */}
                                        {inviteUrl && (
                                            <div className="flex items-center gap-2 bg-[#111] border border-cyan-500/30 rounded-sm px-3 py-2">
                                                <span className="flex-1 text-[11px] font-['JetBrains_Mono'] text-cyan-300 truncate">{inviteUrl}</span>
                                                <button onClick={handleCopyInvite} className="text-neutral-500 hover:text-white transition-colors shrink-0">
                                                    {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                                                </button>
                                            </div>
                                        )}

                                        {/* Pending invites */}
                                        {invites.filter(i => !i.acceptedAt).length > 0 && (
                                            <div className="mt-4">
                                                <p className="text-[11px] text-neutral-600 uppercase tracking-wider mb-2">Pending Invites</p>
                                                <div className="space-y-1">
                                                    {invites.filter(i => !i.acceptedAt).map((inv) => (
                                                        <div key={inv.id} className="flex items-center gap-2 px-3 py-2 bg-neutral-900 rounded-sm text-[12px]">
                                                            <span className="flex-1 text-neutral-400 truncate">{inv.email}</span>
                                                            <span className="text-neutral-600 text-[10px] uppercase">{inv.role}</span>
                                                            <button onClick={() => handleRevokeInvite(inv.id)} className="text-neutral-600 hover:text-red-400 transition-colors">
                                                                <Trash2 size={11} />
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

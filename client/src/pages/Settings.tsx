// =============================================================================
// Settings — Organization management page
// =============================================================================

import { useState, useEffect } from "react";
import { Building2, Users, Copy, Check, Trash2, Plus, Loader2 } from "lucide-react";
import AppHeader from "@/components/AppHeader";
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
            <div className="onyx-mono h-screen flex items-center justify-center">
                <Loader2 className="text-[#3b82f6] animate-spin" size={20} />
            </div>
        );
    }

    return (
        <div className="onyx-mono relative min-h-screen overflow-x-clip">
            <div className="relative z-10 flex flex-col min-h-screen">
                <AppHeader user={user} />

                <main className="w-full px-5 sm:px-8 lg:px-12 flex-1 py-10 sm:py-14">
                    <div className="max-w-3xl mx-auto">
                        {/* Page title */}
                        <h1 className="text-[clamp(1.75rem,4vw,2.5rem)] leading-tight font-normal tracking-tight mb-8">
                            Settings
                        </h1>

                {/* No org — create one */}
                {!activeOrg && (
                    <div className="border border-[#e6e6e6] bg-white p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <Building2 size={14} className="text-[#3b82f6]" />
                            <h2 className="text-sm font-semibold">Create an organization</h2>
                        </div>
                        <p className="text-[#666] text-[13px] mb-5">
                            Organizations let you share test runs, invite team members, and manage a shared plan.
                        </p>
                        <form onSubmit={handleCreateOrg} className="flex gap-2">
                            <input
                                type="text"
                                value={orgName}
                                onChange={(e) => setOrgName(e.target.value)}
                                placeholder="Acme Corp"
                                className="flex-1 bg-white border border-[#e6e6e6] text-black font-mono text-[13px] px-3 py-2 outline-none focus:border-black transition-colors placeholder:text-[#999]"
                            />
                            <button
                                type="submit"
                                disabled={creating || !orgName.trim()}
                                className="mono-btn !py-2 disabled:opacity-40"
                            >
                                {creating ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                                Create
                            </button>
                        </form>
                        {createError && <p className="text-[#dc2626] text-[12px] mt-2">{createError}</p>}

                        {/* Existing orgs they can switch to */}
                        {user && user.orgs.length > 0 && (
                            <div className="mt-6 border-t border-[#e6e6e6] pt-5">
                                <p className="text-[#999] text-[11px] mb-3 uppercase tracking-wider font-mono">Your organizations</p>
                                <div className="space-y-2">
                                    {user.orgs.map((org) => (
                                        <button
                                            key={org.id}
                                            onClick={() => setActiveOrg(org)}
                                            className="w-full flex items-center gap-3 px-3 py-2 border border-[#e6e6e6] bg-white hover:border-black text-left transition-colors"
                                        >
                                            <Building2 size={12} className="text-[#999]" />
                                            <span className="text-[13px] text-[#333] flex-1">{org.name}</span>
                                            <span className="text-[10px] text-[#999] uppercase font-mono">{org.role}</span>
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
                                <Building2 size={14} className="text-[#3b82f6]" />
                                <h2 className="text-sm font-semibold">{activeOrg.name}</h2>
                                <span className="text-[10px] text-[#666] font-mono border border-[#e6e6e6] px-1.5 py-0.5">{activeOrg.plan}</span>
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-[#666] font-mono">
                                Your role: <span className="text-[#3b82f6] font-bold">{myRole}</span>
                            </div>
                        </div>

                        {/* Tabs */}
                        <div className="flex border-b border-[#e6e6e6] mb-6 text-[12px]">
                            {(["org", "members"] as Tab[]).map((t) => (
                                <button
                                    key={t}
                                    onClick={() => setTab(t)}
                                    className={`px-4 py-2 font-medium capitalize transition-colors border-b-2 -mb-px ${tab === t ? "border-[#3b82f6] text-black" : "border-transparent text-[#666] hover:text-black"}`}
                                >
                                    {t === "org" ? "Organization" : "Members"}
                                </button>
                            ))}
                        </div>

                        {/* Tab: Organization */}
                        {tab === "org" && (
                            <div className="space-y-6">
                                <div className="border border-[#e6e6e6] bg-white p-5">
                                    <p className="text-[11px] text-[#999] mb-1 uppercase tracking-wider font-mono">Slug</p>
                                    <p className="text-black font-mono text-[13px]">{activeOrg.slug}</p>
                                </div>

                                {/* Switch org */}
                                {user && user.orgs.length > 1 && (
                                    <div className="border border-[#e6e6e6] bg-white p-5">
                                        <p className="text-[11px] text-[#999] mb-3 uppercase tracking-wider font-mono">Switch organization</p>
                                        <div className="space-y-2">
                                            {user.orgs.filter(o => o.id !== activeOrg.id).map((org) => (
                                                <button
                                                    key={org.id}
                                                    onClick={() => setActiveOrg(org)}
                                                    className="w-full flex items-center gap-3 px-3 py-2 border border-[#e6e6e6] bg-white hover:border-black text-left transition-colors"
                                                >
                                                    <Building2 size={12} className="text-[#999]" />
                                                    <span className="text-[13px] text-[#333] flex-1">{org.name}</span>
                                                    <span className="text-[10px] text-[#999] uppercase font-mono">{org.role}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {isOwner && (
                                    <div className="border border-[#fca5a5] bg-[#fef2f2] p-5">
                                        <p className="text-[12px] text-[#dc2626] mb-3 font-semibold">Danger zone</p>
                                        <button
                                            onClick={handleDeleteOrg}
                                            className="flex items-center gap-2 text-[13px] text-[#dc2626] hover:text-[#b91c1c] transition-colors"
                                        >
                                            <Trash2 size={13} /> Delete organization
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Tab: Members */}
                        {tab === "members" && (
                            <div className="space-y-6">
                                {/* Members table */}
                                <div className="border border-[#e6e6e6] overflow-hidden">
                                    <div className="grid grid-cols-[1fr_100px_80px] text-[11px] text-[#999] uppercase tracking-wider px-4 py-2 bg-white border-b border-[#e6e6e6] font-mono">
                                        <span>Email</span><span>Role</span><span />
                                    </div>
                                    {members.map((m) => (
                                        <div key={m.id} className="grid grid-cols-[1fr_100px_80px] items-center px-4 py-3 border-b border-[#e6e6e6] last:border-0 bg-white hover:bg-[#f9f9f9]">
                                            <span className="text-[13px] text-[#333] truncate">{m.email}</span>
                                            <span>
                                                {isOwner && m.userId !== user?.id ? (
                                                    <select
                                                        value={m.role}
                                                        onChange={(e) => handleRoleChange(m.userId, e.target.value as OrgRole)}
                                                        className="bg-white border border-[#e6e6e6] text-[#333] text-[11px] px-1 py-0.5 outline-none focus:border-black"
                                                    >
                                                        <option value="OWNER">OWNER</option>
                                                        <option value="ADMIN">ADMIN</option>
                                                        <option value="VIEWER">VIEWER</option>
                                                    </select>
                                                ) : (
                                                    <span className="text-[11px] text-[#666] uppercase font-mono">{m.role}</span>
                                                )}
                                            </span>
                                            <span className="flex justify-end">
                                                {isOwner && m.userId !== user?.id && (
                                                    <button
                                                        onClick={() => handleRemoveMember(m.userId)}
                                                        className="text-[#999] hover:text-[#dc2626] transition-colors"
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
                                    <div className="border border-[#e6e6e6] bg-white p-5">
                                        <div className="flex items-center gap-2 mb-4">
                                            <Users size={13} className="text-[#3b82f6]" />
                                            <h3 className="text-[13px] font-semibold">Invite member</h3>
                                        </div>
                                        <form onSubmit={handleInvite} className="flex gap-2 mb-3">
                                            <input
                                                type="email"
                                                value={inviteEmail}
                                                onChange={(e) => setInviteEmail(e.target.value)}
                                                placeholder="colleague@company.com"
                                                className="flex-1 bg-white border border-[#e6e6e6] text-black font-mono text-[12px] px-3 py-1.5 outline-none focus:border-black placeholder:text-[#999]"
                                            />
                                            <select
                                                value={inviteRole}
                                                onChange={(e) => setInviteRole(e.target.value as OrgRole)}
                                                className="bg-white border border-[#e6e6e6] text-[#333] text-[12px] px-2 py-1.5 outline-none focus:border-black"
                                            >
                                                <option value="VIEWER">VIEWER</option>
                                                <option value="ADMIN">ADMIN</option>
                                            </select>
                                            <button
                                                type="submit"
                                                disabled={inviting || !inviteEmail.trim()}
                                                className="mono-btn !py-1.5 !px-3 !text-[12px] disabled:opacity-40"
                                            >
                                                {inviting ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
                                                Invite
                                            </button>
                                        </form>
                                        {inviteError && <p className="text-[#dc2626] text-[12px] mb-3">{inviteError}</p>}

                                        {/* Invite URL */}
                                        {inviteUrl && (
                                            <div className="flex items-center gap-2 bg-[#f0f6ff] border border-[#93c5fd] px-3 py-2">
                                                <span className="flex-1 text-[11px] font-mono text-[#3b82f6] truncate">{inviteUrl}</span>
                                                <button onClick={handleCopyInvite} className="text-[#666] hover:text-black transition-colors shrink-0">
                                                    {copied ? <Check size={12} className="text-[#16a34a]" /> : <Copy size={12} />}
                                                </button>
                                            </div>
                                        )}

                                        {/* Pending invites */}
                                        {invites.filter(i => !i.acceptedAt).length > 0 && (
                                            <div className="mt-4">
                                                <p className="text-[11px] text-[#999] uppercase tracking-wider mb-2 font-mono">Pending invites</p>
                                                <div className="space-y-1">
                                                    {invites.filter(i => !i.acceptedAt).map((inv) => (
                                                        <div key={inv.id} className="flex items-center gap-2 px-3 py-2 border border-[#e6e6e6] bg-white text-[12px]">
                                                            <span className="flex-1 text-[#666] truncate">{inv.email}</span>
                                                            <span className="text-[#999] text-[10px] uppercase font-mono">{inv.role}</span>
                                                            <button onClick={() => handleRevokeInvite(inv.id)} className="text-[#999] hover:text-[#dc2626] transition-colors">
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
                </main>
            </div>
        </div>
    );
}

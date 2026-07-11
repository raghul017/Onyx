// =============================================================================
// Profile — account overview + inline name editing for the signed-in user.
// Design system: onyx-mono, #fafafa surface, hairline #e6e6e6 borders,
// sharp corners, JetBrains Mono labels, single blue (#3b82f6) accent.
// =============================================================================

import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    Building2,
    CreditCard,
    LogOut,
    Loader2,
    Pencil,
    Check,
    X,
} from "lucide-react";
import AppHeader from "@/components/AppHeader";
import {
    getCurrentUser,
    updateCurrentUser,
    type CurrentUser,
} from "@/services/api";
import { useAuthStore } from "@/store/useAuthStore";

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Hairline-divided row inside an info card. */
const Row = ({
    label,
    children,
}: {
    label: string;
    children: React.ReactNode;
}) => (
    <div className="flex items-center justify-between gap-4 px-5 py-3.5">
        <span className="font-mono text-[11px] uppercase tracking-wider text-[#999] shrink-0">
            {label}
        </span>
        <span className="text-[14px] text-black text-right min-w-0 truncate">
            {children}
        </span>
    </div>
);

const PLAN_BADGE: Record<string, string> = {
    FREE: "border-[#e6e6e6] text-[#666]",
    PRO: "border-[#93c5fd] text-[#3b82f6]",
    TEAM: "border-[#93c5fd] text-[#3b82f6]",
    ENTERPRISE: "border-[#93c5fd] text-[#3b82f6]",
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

const Profile = () => {
    const navigate = useNavigate();
    const { logout } = useAuthStore();

    const [user, setUser] = useState<CurrentUser | null>(null);
    const [loading, setLoading] = useState(true);

    // Name edit state
    const [editingName, setEditingName] = useState(false);
    const [nameValue, setNameValue] = useState("");
    const [nameSaving, setNameSaving] = useState(false);
    const [nameError, setNameError] = useState<string | null>(null);
    const [nameSavedFlash, setNameSavedFlash] = useState(false);
    const nameInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        getCurrentUser()
            .then((u) => {
                setUser(u);
                setNameValue(u.name ?? "");
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    // Focus the input when edit mode is entered
    useEffect(() => {
        if (editingName) {
            nameInputRef.current?.focus();
            nameInputRef.current?.select();
        }
    }, [editingName]);

    const handleLogout = () => {
        logout();
        navigate("/");
    };

    // ---------------------------------------------------------------------------
    // Name editing handlers
    // ---------------------------------------------------------------------------

    const openNameEdit = () => {
        setNameValue(user?.name ?? "");
        setNameError(null);
        setEditingName(true);
    };

    const cancelNameEdit = () => {
        setEditingName(false);
        setNameError(null);
    };

    const saveName = async () => {
        if (!user) return;
        const trimmed = nameValue.trim();

        // Unchanged — just close
        if (trimmed === (user.name ?? "")) {
            setEditingName(false);
            return;
        }

        if (trimmed.length === 0) {
            setNameError("Name cannot be empty.");
            return;
        }
        if (trimmed.length > 80) {
            setNameError("Name must be 80 characters or fewer.");
            return;
        }

        setNameSaving(true);
        setNameError(null);
        try {
            const updated = await updateCurrentUser({ name: trimmed });
            setUser({ ...user, name: updated.name });
            setEditingName(false);
            // Flash success
            setNameSavedFlash(true);
            setTimeout(() => setNameSavedFlash(false), 2000);
        } catch {
            setNameError("Failed to save. Please try again.");
        } finally {
            setNameSaving(false);
        }
    };

    const handleNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") saveName();
        if (e.key === "Escape") cancelNameEdit();
    };

    // ---------------------------------------------------------------------------
    // Render
    // ---------------------------------------------------------------------------

    if (loading) {
        return (
            <div className="onyx-mono h-screen flex items-center justify-center">
                <Loader2 className="text-[#3b82f6] animate-spin" size={20} />
            </div>
        );
    }

    const initial =
        user?.name?.charAt(0).toUpperCase() ??
        user?.email?.charAt(0).toUpperCase() ??
        "?";

    const planExpiry =
        user?.planExpiresAt != null
            ? new Date(user.planExpiresAt).toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
              })
            : null;

    return (
        <div className="onyx-mono relative min-h-screen overflow-x-clip">
            <div className="relative z-10 flex flex-col min-h-screen">
                <AppHeader user={user} />

                <main className="w-full px-5 sm:px-8 lg:px-12 flex-1 py-10 sm:py-14">
                    <div className="max-w-2xl mx-auto">
                        {/* Page title */}
                        <h1 className="text-[clamp(1.75rem,4vw,2.5rem)] leading-tight font-normal tracking-tight mb-8">
                            Profile
                        </h1>

                        {/* ── Identity header ── */}
                        <div className="flex items-center gap-4 mb-8">
                            {/* Avatar — initial letter */}
                            <span
                                className="flex items-center justify-center w-16 h-16 bg-black text-white text-[24px] font-medium shrink-0"
                                aria-hidden="true"
                            >
                                {initial}
                            </span>

                            <div className="min-w-0 flex-1">
                                {/* Display name row — editable */}
                                {editingName ? (
                                    <div className="flex items-center gap-2">
                                        <input
                                            ref={nameInputRef}
                                            id="profile-name-input"
                                            type="text"
                                            value={nameValue}
                                            onChange={(e) => {
                                                setNameValue(e.target.value);
                                                setNameError(null);
                                            }}
                                            onKeyDown={handleNameKeyDown}
                                            maxLength={80}
                                            placeholder="Your display name"
                                            disabled={nameSaving}
                                            className="border border-[#e6e6e6] focus:border-[#3b82f6] outline-none text-[16px] px-3 py-1.5 bg-white text-black w-full max-w-xs transition-colors disabled:opacity-60"
                                            aria-label="Display name"
                                        />
                                        <button
                                            onClick={saveName}
                                            disabled={nameSaving}
                                            title="Save name"
                                            id="profile-name-save"
                                            className="flex items-center justify-center w-8 h-8 border border-[#3b82f6] text-[#3b82f6] hover:bg-[#eff6ff] disabled:opacity-50 transition-colors shrink-0"
                                        >
                                            {nameSaving ? (
                                                <Loader2
                                                    size={14}
                                                    className="animate-spin"
                                                />
                                            ) : (
                                                <Check size={14} />
                                            )}
                                        </button>
                                        <button
                                            onClick={cancelNameEdit}
                                            disabled={nameSaving}
                                            title="Cancel"
                                            id="profile-name-cancel"
                                            className="flex items-center justify-center w-8 h-8 border border-[#e6e6e6] text-[#666] hover:bg-[#f9f9f9] disabled:opacity-50 transition-colors shrink-0"
                                        >
                                            <X size={14} />
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2 group">
                                        <p className="text-[20px] leading-tight font-normal tracking-tight truncate">
                                            {user?.name ? (
                                                user.name
                                            ) : (
                                                <span className="text-[#999] italic text-[16px]">
                                                    No display name set
                                                </span>
                                            )}
                                        </p>
                                        <button
                                            onClick={openNameEdit}
                                            id="profile-name-edit"
                                            title="Edit display name"
                                            className="opacity-0 group-hover:opacity-100 flex items-center justify-center w-7 h-7 border border-transparent hover:border-[#e6e6e6] text-[#999] hover:text-black transition-all shrink-0"
                                        >
                                            <Pencil size={13} />
                                        </button>
                                        {nameSavedFlash && (
                                            <span className="font-mono text-[11px] text-[#16a34a] flex items-center gap-1">
                                                <Check size={11} /> Saved
                                            </span>
                                        )}
                                    </div>
                                )}

                                {/* Inline name error */}
                                {nameError && (
                                    <p className="font-mono text-[11px] text-[#dc2626] mt-1">
                                        {nameError}
                                    </p>
                                )}

                                {/* Email + badges */}
                                <p className="text-[14px] text-[#666] mt-1 truncate">
                                    {user?.email ?? "Unknown"}
                                </p>
                                <div className="flex items-center gap-2 mt-1.5">
                                    <span
                                        className={`border font-mono text-[10px] leading-none uppercase tracking-wide px-1.5 py-0.5 ${PLAN_BADGE[user?.plan ?? "FREE"]}`}
                                    >
                                        {user?.plan ?? "FREE"}
                                    </span>
                                    <span className="text-[12px] text-[#999]">
                                        {user?.orgs.length ?? 0}{" "}
                                        {user?.orgs.length === 1
                                            ? "organization"
                                            : "organizations"}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* ── Account info ── */}
                        <div className="mb-6">
                            <p className="font-mono text-[11px] uppercase tracking-widest text-[#999] mb-2.5">
                                Account
                            </p>
                            <div className="border border-[#e6e6e6] bg-white divide-y divide-[#e6e6e6]">
                                <Row label="Display name">
                                    {user?.name ? (
                                        <span className="flex items-center gap-2">
                                            {user.name}
                                            <button
                                                onClick={openNameEdit}
                                                id="profile-name-edit-row"
                                                title="Edit display name"
                                                className="text-[#999] hover:text-[#3b82f6] transition-colors"
                                            >
                                                <Pencil size={12} />
                                            </button>
                                        </span>
                                    ) : (
                                        <button
                                            onClick={openNameEdit}
                                            id="profile-name-add"
                                            className="font-mono text-[11px] uppercase tracking-wide text-[#3b82f6] hover:text-black transition-colors"
                                        >
                                            + Add name
                                        </button>
                                    )}
                                </Row>
                                <Row label="Email">{user?.email}</Row>
                                <Row label="User ID">
                                    <span className="font-mono text-[13px] text-[#666] tabular-nums">
                                        {user?.id}
                                    </span>
                                </Row>
                                <Row label="Plan">{user?.plan}</Row>
                                {planExpiry && (
                                    <Row label="Plan renews">
                                        <span className="tabular-nums">
                                            {planExpiry}
                                        </span>
                                    </Row>
                                )}
                            </div>
                        </div>

                        {/* ── Organizations ── */}
                        <div className="mb-6">
                            <div className="flex items-center justify-between mb-2.5">
                                <p className="font-mono text-[11px] uppercase tracking-widest text-[#999]">
                                    Organizations
                                </p>
                                <button
                                    onClick={() => navigate("/settings")}
                                    className="font-mono text-[11px] uppercase tracking-wide text-[#3b82f6] hover:text-black transition-colors"
                                >
                                    Manage
                                </button>
                            </div>
                            <div className="border border-[#e6e6e6] bg-white">
                                {user && user.orgs.length > 0 ? (
                                    <div className="divide-y divide-[#e6e6e6]">
                                        {user.orgs.map((org) => (
                                            <button
                                                key={org.id}
                                                onClick={() =>
                                                    navigate("/settings")
                                                }
                                                className="w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-[#f9f9f9] transition-colors"
                                            >
                                                <Building2
                                                    size={14}
                                                    className="text-[#999] shrink-0"
                                                />
                                                <span className="text-[14px] text-black flex-1 truncate">
                                                    {org.name}
                                                </span>
                                                <span className="font-mono text-[10px] uppercase tracking-wide text-[#999]">
                                                    {org.role}
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="px-5 py-4 text-[13px] text-[#666]">
                                        You're on a personal account. Create an
                                        organization to share runs and invite
                                        your team.
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* ── Actions ── */}
                        <div className="flex flex-wrap items-center gap-3 pt-2">
                            <button
                                onClick={() => navigate("/billing")}
                                className="mono-btn-ghost"
                                id="profile-billing-btn"
                            >
                                <CreditCard size={14} />
                                Manage billing
                            </button>
                            <button
                                onClick={handleLogout}
                                id="profile-signout-btn"
                                className="mono-btn-ghost !text-[#dc2626] !border-[#fca5a5] hover:!bg-[#fef2f2] hover:!border-[#dc2626]"
                            >
                                <LogOut size={14} />
                                Sign out
                            </button>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
};

export default Profile;

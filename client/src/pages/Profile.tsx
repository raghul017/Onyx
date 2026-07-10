// =============================================================================
// Profile — account overview for the signed-in user. Light-mono system:
// #fafafa surface, hairline #e6e6e6 borders, sharp corners, no shadows, Geist
// headings, JetBrains Mono for labels/IDs, single blue (#3b82f6) accent.
// Read-only by design: the backend exposes no profile-edit or password endpoint,
// so this surfaces real account data plus navigation, never fake forms.
// =============================================================================

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, CreditCard, LogOut, Loader2 } from "lucide-react";
import AppHeader from "@/components/AppHeader";
import { getCurrentUser, type CurrentUser } from "@/services/api";
import { useAuthStore } from "@/store/useAuthStore";

// Row inside a hairline card: mono label left, value right, divided by hairlines.
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

const Profile = () => {
    const navigate = useNavigate();
    const { logout } = useAuthStore();
    const [user, setUser] = useState<CurrentUser | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        getCurrentUser()
            .then(setUser)
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    const handleLogout = () => {
        logout();
        navigate("/");
    };

    if (loading) {
        return (
            <div className="onyx-mono h-screen flex items-center justify-center">
                <Loader2 className="text-[#3b82f6] animate-spin" size={20} />
            </div>
        );
    }

    const initial = user?.email?.charAt(0).toUpperCase() ?? "?";
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

                        {/* Identity header */}
                        <div className="flex items-center gap-4 mb-8">
                            <span
                                className="flex items-center justify-center w-16 h-16 bg-black text-white text-[24px] font-medium shrink-0"
                                aria-hidden="true"
                            >
                                {initial}
                            </span>
                            <div className="min-w-0">
                                <p className="text-[20px] leading-tight font-normal tracking-tight truncate">
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

                        {/* Account */}
                        <div className="mb-6">
                            <p className="font-mono text-[11px] uppercase tracking-widest text-[#999] mb-2.5">
                                Account
                            </p>
                            <div className="border border-[#e6e6e6] bg-white divide-y divide-[#e6e6e6]">
                                <Row label="Email">{user?.email}</Row>
                                <Row label="User ID">
                                    <span className="font-mono text-[13px] text-[#666] tabular-nums">
                                        {user?.id}
                                    </span>
                                </Row>
                                <Row label="Plan">{user?.plan}</Row>
                                {planExpiry && (
                                    <Row label="Plan renews">
                                        <span className="tabular-nums">{planExpiry}</span>
                                    </Row>
                                )}
                            </div>
                        </div>

                        {/* Organizations */}
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
                                                onClick={() => navigate("/settings")}
                                                className="w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-[#f9f9f9] transition-colors"
                                            >
                                                <Building2 size={14} className="text-[#999] shrink-0" />
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
                                        You're on a personal account. Create an organization
                                        to share runs and invite your team.
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex flex-wrap items-center gap-3 pt-2">
                            <button
                                onClick={() => navigate("/billing")}
                                className="mono-btn-ghost"
                            >
                                <CreditCard size={14} />
                                Manage billing
                            </button>
                            <button
                                onClick={handleLogout}
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

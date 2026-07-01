// =============================================================================
// AppHeader — shared top nav for authed app pages (Dashboard, History, Billing)
// =============================================================================

import { useNavigate, useLocation } from "react-router-dom";
import { CreditCard } from "lucide-react";
import type { CurrentUser } from "@/services/api";
import OrgSwitcher from "./OrgSwitcher";
import GoBackButton from "./GoBackButton";

interface AppHeaderProps {
    user: CurrentUser | null;
}

const AppHeader = ({ user }: AppHeaderProps) => {
    const navigate = useNavigate();
    const { pathname } = useLocation();

    const linkClass = (active: boolean) =>
        active
            ? "text-white text-[14px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#73bfc4]/50 rounded"
            : "text-white/65 hover:text-white text-[14px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#73bfc4]/50 rounded";

    return (
        <header className="sticky top-0 z-30 border-b border-white/[0.08] bg-[#080808]/80 backdrop-blur-xl">
            <div className="w-full px-5 sm:px-8 lg:px-12 h-16 flex items-center justify-between gap-4">
                {/* Left — back + brand + nav */}
                <div className="flex items-center gap-5 shrink-0">
                    <GoBackButton to="/" label="Home" size="sm" className="hidden sm:block" />
                    <div
                        className="flex items-center gap-2 cursor-pointer"
                        onClick={() => navigate("/")}
                    >
                        <span className="font-['Inter'] font-normal text-white text-[24px] tracking-tight">
                            Onyx
                        </span>
                        {user && user.plan !== "FREE" && (
                            <span className="px-1.5 py-[1px] rounded bg-[#73bfc4]/10 border border-[#73bfc4]/30 text-[9px] font-bold font-['JetBrains_Mono'] tracking-wide text-[#73bfc4] translate-y-[2px]">
                                {user.plan}
                            </span>
                        )}
                    </div>
                    <nav className="hidden md:flex items-center gap-6 ml-2">
                        <button
                            onClick={() => navigate("/dashboard")}
                            className={linkClass(pathname === "/dashboard")}
                        >
                            Dashboard
                        </button>
                        <button
                            onClick={() => navigate("/history")}
                            className={linkClass(pathname === "/history")}
                        >
                            History
                        </button>
                    </nav>
                </div>

                {/* Right — org switcher, settings, billing */}
                <div className="flex items-center gap-6 shrink-0">
                    {user && (
                        <div className="hidden sm:block">
                            <OrgSwitcher orgs={user.orgs ?? []} />
                        </div>
                    )}
                    <button
                        onClick={() => navigate("/settings")}
                        className={`hidden sm:block ${linkClass(pathname === "/settings")}`}
                    >
                        Settings
                    </button>
                    <button
                        onClick={() => navigate("/billing")}
                        className={`hidden sm:flex items-center gap-1.5 ${linkClass(pathname === "/billing")}`}
                    >
                        <CreditCard size={14} />
                        Billing
                    </button>
                </div>
            </div>
        </header>
    );
};

export default AppHeader;

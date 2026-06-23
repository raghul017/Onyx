// =============================================================================
// AppHeader — shared top nav for authed app pages (Dashboard, History, Billing)
// =============================================================================

import { useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft, CreditCard } from "lucide-react";
import type { CurrentUser } from "@/services/api";
import OrgSwitcher from "./OrgSwitcher";

interface AppHeaderProps {
    user: CurrentUser | null;
}

const AppHeader = ({ user }: AppHeaderProps) => {
    const navigate = useNavigate();
    const { pathname } = useLocation();

    const linkClass = (active: boolean) =>
        active
            ? "text-white text-[14px] font-medium"
            : "text-white/70 hover:text-white text-[14px] font-medium transition-colors";

    return (
        <header className="sticky top-0 z-30 border-b border-[#1A1A1A] bg-black/70 backdrop-blur-md">
            <div className="w-full px-5 sm:px-8 lg:px-12 h-16 flex items-center justify-between gap-4">
                {/* Left — back + brand + nav */}
                <div className="flex items-center gap-5 shrink-0">
                    <button
                        onClick={() => navigate("/")}
                        className="text-neutral-500 hover:text-white transition-colors"
                        aria-label="Back to landing"
                    >
                        <ArrowLeft size={18} />
                    </button>
                    <div
                        className="flex items-center gap-2 cursor-pointer"
                        onClick={() => navigate("/")}
                    >
                        <span className="font-['Inter'] font-normal text-white text-[24px] tracking-tight">
                            Onyx
                        </span>
                        {user && user.plan !== "FREE" && (
                            <span className="px-1.5 py-[1px] rounded bg-cyan-500/10 border border-cyan-500/30 text-[9px] font-bold font-['JetBrains_Mono'] tracking-wide text-cyan-400 translate-y-[2px]">
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

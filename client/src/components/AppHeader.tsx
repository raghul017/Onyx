// =============================================================================
// AppHeader — shared top nav for authed app pages (Dashboard, History, Billing).
// Light-mono system (matches the landing/docs): #fafafa, hairline borders,
// sharp corners, Geist wordmark, JetBrains Mono nav, blue accent.
// =============================================================================

import { useNavigate, useLocation } from "react-router-dom";
import { CreditCard, ArrowLeft } from "lucide-react";
import type { CurrentUser } from "@/services/api";
import OrgSwitcher from "./OrgSwitcher";

interface AppHeaderProps {
    user: CurrentUser | null;
}

const OnyxMark = () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect width="24" height="24" fill="black" />
        <path d="M7 7H11V11H7V7Z" fill="white" />
        <path d="M13 13H17V17H13V13Z" fill="white" />
        <path d="M7 13H11V17H7V13Z" fill="white" />
    </svg>
);

const AppHeader = ({ user }: AppHeaderProps) => {
    const navigate = useNavigate();
    const { pathname } = useLocation();

    const linkClass = (active: boolean) =>
        `text-[14px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3b82f6]/40 ${
            active
                ? "text-black font-medium"
                : "text-[#666] hover:text-black font-medium"
        }`;

    return (
        <header className="onyx-mono sticky top-0 z-30 border-b border-[#e6e6e6] bg-[#fafafa]/85 backdrop-blur-md">
            <div className="w-full px-5 sm:px-8 lg:px-12 h-14 flex items-center justify-between gap-4">
                {/* Left — back + brand + nav */}
                <div className="flex items-center gap-5 shrink-0">
                    <button
                        onClick={() => navigate("/")}
                        className="group hidden sm:flex items-center gap-1.5 text-[14px] text-[#666] hover:text-black transition-colors"
                    >
                        <ArrowLeft
                            size={15}
                            className="transition-transform group-hover:-translate-x-0.5"
                        />
                        Home
                    </button>
                    <button
                        className="flex items-center gap-2"
                        onClick={() => navigate("/")}
                    >
                        <OnyxMark />
                        <span className="font-semibold text-xl tracking-tight">Onyx</span>
                        {user && user.plan !== "FREE" && (
                            <span className="border border-[#93c5fd] text-[#3b82f6] font-mono text-[10px] leading-none uppercase px-1.5 py-0.5 ml-1">
                                {user.plan}
                            </span>
                        )}
                    </button>
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
                    {user && (
                        <button
                            onClick={() => navigate("/profile")}
                            aria-label="Profile"
                            title={`${user.email} · Profile`}
                            className={`flex items-center justify-center w-8 h-8 bg-black text-white text-[12px] font-medium cursor-pointer ring-offset-2 ring-offset-[#fafafa] transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3b82f6] ${
                                pathname === "/profile"
                                    ? "ring-2 ring-[#3b82f6]"
                                    : "hover:ring-2 hover:ring-[#e6e6e6]"
                            }`}
                        >
                            {user.email.charAt(0).toUpperCase()}
                        </button>
                    )}
                </div>
            </div>
        </header>
    );
};

export default AppHeader;

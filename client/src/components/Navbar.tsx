import { LogOut, Menu, X, ArrowRight } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/useAuthStore";
import { useState, useEffect } from "react";
import { getCurrentUser, CurrentUser } from "@/services/api";

const scrollToSection = (
    e: React.MouseEvent<HTMLAnchorElement>,
    id: string,
) => {
    e.preventDefault();
    const el = document.getElementById(id);
    if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
};

// Onyx mark — square-in-square glyph echoing composio's logo, in ink.
const OnyxMark = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect width="24" height="24" fill="black" />
        <path d="M7 7H11V11H7V7Z" fill="white" />
        <path d="M13 13H17V17H13V13Z" fill="white" />
        <path d="M7 13H11V17H7V13Z" fill="white" />
    </svg>
);

const Navbar = () => {
    const navigate = useNavigate();
    const { isAuthenticated, user, logout } = useAuthStore();
    const [mobileOpen, setMobileOpen] = useState(false);
    const [fullUser, setFullUser] = useState<CurrentUser | null>(null);

    useEffect(() => {
        if (!isAuthenticated) return;

        const fetchUser = () => {
            getCurrentUser()
                .then(setFullUser)
                .catch(() => {});
        };

        fetchUser();

        // Re-fetch whenever the tab becomes visible again (e.g. user edits name
        // on the Profile page, then navigates back to the landing page).
        const handleVisibility = () => {
            if (document.visibilityState === "visible") fetchUser();
        };
        document.addEventListener("visibilitychange", handleVisibility);
        return () => {
            document.removeEventListener("visibilitychange", handleVisibility);
        };
    }, [isAuthenticated]);

    const handleLogout = () => {
        logout();
        navigate("/");
    };

    const handleCTA = () => {
        if (isAuthenticated) {
            navigate("/dashboard");
        } else {
            navigate("/signup");
        }
    };

    const navLinks = [
        { label: "How it Works", href: "how-it-works" },
        { label: "Features", href: "features" },
        { label: "Pricing", href: "pricing" },
    ];

    return (
        <nav className="sticky top-0 z-50 bg-[#fafafa]/85 backdrop-blur-md border-b border-[#e6e6e6] px-6 py-3.5 flex items-center justify-between">
            {/* Logo */}
            <button
                className="flex items-center gap-2 shrink-0"
                onClick={() => navigate("/")}
            >
                <OnyxMark />
                <span className="font-semibold text-xl tracking-tight">Onyx</span>
                {fullUser && fullUser.plan !== "FREE" && (
                    <span className="border border-[#93c5fd] text-[#3b82f6] font-mono text-[10px] leading-none uppercase px-1.5 py-0.5 ml-1">
                        {fullUser.plan}
                    </span>
                )}
            </button>

            {/* Center / right nav (desktop) */}
            <div className="hidden md:flex items-center gap-8 text-sm uppercase">
                {navLinks.map((link) => (
                    <a
                        key={link.href}
                        href={`#${link.href}`}
                        onClick={(e) => scrollToSection(e, link.href)}
                        className="hover:opacity-60 transition-opacity"
                    >
                        {link.label}
                    </a>
                ))}
                <Link to="/docs" className="hover:opacity-60 transition-opacity">
                    Docs
                </Link>
                <a
                    href="https://github.com/raghul017/Onyx"
                    target="_blank"
                    rel="noreferrer"
                    className="hover:opacity-60 transition-opacity"
                >
                    GitHub
                </a>

                {isAuthenticated && user ? (
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => navigate("/dashboard")}
                            className="hover:opacity-60 transition-opacity"
                        >
                            Dashboard
                        </button>
                        <button
                            onClick={() => navigate("/billing")}
                            className="hover:opacity-60 transition-opacity"
                        >
                            Billing
                        </button>
                        <button
                            onClick={() => navigate("/profile")}
                            title={`${user.email} · Profile`}
                            aria-label="Profile"
                            className="flex items-center gap-2 border border-[#e6e6e6] bg-white pl-1.5 pr-3 py-1 text-[11px] normal-case text-[#666] hover:text-black hover:border-black transition-colors"
                            style={{ transitionProperty: "color, border-color" }}
                        >
                            <span
                                className="flex items-center justify-center w-5 h-5 bg-black text-white text-[10px] font-semibold"
                                aria-hidden="true"
                            >
                                {(fullUser?.name ?? user.email)
                                    .charAt(0)
                                    .toUpperCase()}
                            </span>
                            <span className="max-w-[120px] truncate">
                                {fullUser?.name ?? user.email.split("@")[0]}
                            </span>
                        </button>
                        <button
                            onClick={handleLogout}
                            className="flex items-center justify-center w-9 h-9 border border-[#e6e6e6] text-[#666] hover:text-black hover:border-black transition-colors"
                            title="Sign out"
                            aria-label="Sign out"
                        >
                            <LogOut size={15} />
                        </button>
                    </div>
                ) : (
                    <div className="flex items-center gap-6">
                        <Link
                            to="/signin"
                            className="hover:opacity-60 transition-opacity"
                        >
                            Sign In
                        </Link>
                        <button
                            onClick={handleCTA}
                            className="mono-btn py-2 px-4"
                        >
                            Start free scan
                            <ArrowRight size={14} />
                        </button>
                    </div>
                )}
            </div>

            {/* Mobile toggle */}
            <button
                className="md:hidden text-black min-w-[40px] min-h-[40px] flex items-center justify-center"
                onClick={() => setMobileOpen(!mobileOpen)}
                aria-label={mobileOpen ? "Close menu" : "Open menu"}
            >
                {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>

            {/* Mobile menu */}
            {mobileOpen && (
                <div className="md:hidden absolute top-full inset-x-0 bg-[#fafafa] border-b border-[#e6e6e6] px-6 py-6 flex flex-col gap-4 text-sm uppercase">
                    {navLinks.map((link) => (
                        <a
                            key={link.href}
                            href={`#${link.href}`}
                            onClick={(e) => {
                                scrollToSection(e, link.href);
                                setMobileOpen(false);
                            }}
                            className="hover:opacity-60"
                        >
                            {link.label}
                        </a>
                    ))}
                    <Link
                        to="/docs"
                        onClick={() => setMobileOpen(false)}
                        className="hover:opacity-60"
                    >
                        Docs
                    </Link>
                    <a
                        href="https://github.com/raghul017/Onyx"
                        target="_blank"
                        rel="noreferrer"
                        className="hover:opacity-60"
                    >
                        GitHub
                    </a>
                    <div className="border-t border-[#e6e6e6] pt-4 mt-2 flex flex-col gap-3">
                        {isAuthenticated ? (
                            <>
                                <button
                                    onClick={() => {
                                        navigate("/dashboard");
                                        setMobileOpen(false);
                                    }}
                                    className="text-left hover:opacity-60"
                                >
                                    Dashboard
                                </button>
                                <button
                                    onClick={() => {
                                        navigate("/billing");
                                        setMobileOpen(false);
                                    }}
                                    className="text-left hover:opacity-60"
                                >
                                    Billing
                                </button>
                                <button
                                    onClick={() => {
                                        navigate("/profile");
                                        setMobileOpen(false);
                                    }}
                                    className="text-left hover:opacity-60"
                                >
                                    Profile
                                </button>
                                <button
                                    onClick={() => {
                                        handleLogout();
                                        setMobileOpen(false);
                                    }}
                                    className="text-left text-red-600 hover:opacity-60"
                                >
                                    Sign Out
                                </button>
                            </>
                        ) : (
                            <>
                                <Link
                                    to="/signin"
                                    onClick={() => setMobileOpen(false)}
                                    className="hover:opacity-60"
                                >
                                    Sign In
                                </Link>
                                <button
                                    onClick={() => {
                                        handleCTA();
                                        setMobileOpen(false);
                                    }}
                                    className="mono-btn justify-center"
                                >
                                    Start free scan
                                </button>
                            </>
                        )}
                    </div>
                </div>
            )}
        </nav>
    );
};

export default Navbar;

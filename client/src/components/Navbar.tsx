import { LogOut, Menu, X, ArrowRight, ChevronDown } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/useAuthStore";
import { useState, useEffect, useRef } from "react";
import { getCurrentUser, CurrentUser } from "@/services/api";
import {
    NAV_GROUPS,
    NAV_PRICING,
    type NavGroup,
    type NavItem,
} from "./nav-config";

// Onyx mark — square-in-square glyph echoing composio's logo, in ink.
const OnyxMark = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect width="24" height="24" fill="black" />
        <path d="M7 7H11V11H7V7Z" fill="white" />
        <path d="M13 13H17V17H13V13Z" fill="white" />
        <path d="M7 13H11V17H7V13Z" fill="white" />
    </svg>
);

// ---------------------------------------------------------------------------
// A single nav item inside a dropdown / mobile group. Renders the correct
// element for external / route / homepage-anchor links (all resolve — no 404).
// ---------------------------------------------------------------------------
const NavItemLink = ({
    item,
    onNavigate,
    className,
}: {
    item: NavItem;
    onNavigate?: () => void;
    className: string;
}) => {
    const label = (
        <>
            <span className="block text-[13px] text-black group-hover/item:text-[#3b82f6] transition-colors">
                {item.label}
            </span>
            <span className="block text-[12px] text-[#999] leading-snug mt-0.5 normal-case">
                {item.desc}
            </span>
        </>
    );

    if (item.ext) {
        return (
            <a
                href={item.href}
                target="_blank"
                rel="noreferrer"
                onClick={onNavigate}
                className={className}
            >
                {label}
            </a>
        );
    }
    return (
        <Link to={item.href} onClick={onNavigate} className={className}>
            {label}
        </Link>
    );
};

// ---------------------------------------------------------------------------
// Desktop dropdown — opens on hover AND click/focus. Esc closes and returns
// focus to the trigger. aria-haspopup / aria-expanded for screen readers.
// ---------------------------------------------------------------------------
const NavDropdown = ({ group }: { group: NavGroup }) => {
    const [open, setOpen] = useState(false);
    const wrapRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const cancelClose = () => {
        if (closeTimer.current) clearTimeout(closeTimer.current);
    };
    // Small delay on mouse-leave so a diagonal move into the panel doesn't close it.
    const scheduleClose = () => {
        cancelClose();
        closeTimer.current = setTimeout(() => setOpen(false), 120);
    };

    useEffect(() => cancelClose, []);

    // Close on outside click.
    useEffect(() => {
        if (!open) return;
        const onDocClick = (e: MouseEvent) => {
            if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener("mousedown", onDocClick);
        return () => document.removeEventListener("mousedown", onDocClick);
    }, [open]);

    const onKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Escape" && open) {
            e.stopPropagation();
            setOpen(false);
            triggerRef.current?.focus();
        }
    };

    return (
        <div
            ref={wrapRef}
            className="relative"
            onMouseEnter={() => {
                cancelClose();
                setOpen(true);
            }}
            onMouseLeave={scheduleClose}
            onKeyDown={onKeyDown}
            // Close when focus leaves the whole group (keyboard tab-out).
            onBlur={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) setOpen(false);
            }}
        >
            <button
                ref={triggerRef}
                type="button"
                aria-haspopup="true"
                aria-expanded={open}
                onClick={() => setOpen((v) => !v)}
                className="flex items-center gap-1 hover:opacity-60 transition-opacity focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3b82f6]"
            >
                {group.label}
                <ChevronDown
                    size={13}
                    className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}
                    aria-hidden="true"
                />
            </button>

            {open && (
                <div
                    role="menu"
                    aria-label={group.label}
                    className="absolute left-0 top-full pt-3 z-50"
                >
                    <div className="w-[320px] bg-white border border-[#e6e6e6]">
                        <ul className="flex flex-col divide-y divide-[#e6e6e6]">
                            {group.items.map((item) => (
                                <li key={`${item.label}-${item.href}`} className="group/item">
                                    <NavItemLink
                                        item={item}
                                        onNavigate={() => setOpen(false)}
                                        className="block px-4 py-3 hover:bg-[#fafafa] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#3b82f6]"
                                    />
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            )}
        </div>
    );
};

// ---------------------------------------------------------------------------
// Mobile collapsible group — mirrors a desktop dropdown.
// ---------------------------------------------------------------------------
const MobileGroup = ({
    group,
    onNavigate,
}: {
    group: NavGroup;
    onNavigate: () => void;
}) => {
    const [open, setOpen] = useState(false);
    return (
        <div className="border-b border-[#e6e6e6] pb-3">
            <button
                type="button"
                aria-expanded={open}
                onClick={() => setOpen((v) => !v)}
                className="w-full flex items-center justify-between py-1 hover:opacity-60"
            >
                {group.label}
                <ChevronDown
                    size={15}
                    className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}
                    aria-hidden="true"
                />
            </button>
            {open && (
                <ul className="mt-2 flex flex-col gap-1 pl-1">
                    {group.items.map((item) => (
                        <li key={`${item.label}-${item.href}`} className="group/item">
                            <NavItemLink
                                item={item}
                                onNavigate={onNavigate}
                                className="block py-2 normal-case"
                            />
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

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

    const closeMobile = () => setMobileOpen(false);

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

            {/* Center / right nav (desktop) — the mega-menu (Product / Solutions /
                Resources + Pricing) renders in BOTH auth states; only the
                right-side action cluster branches on isAuthenticated. */}
            <div className="hidden md:flex items-center gap-8 text-sm uppercase">
                {/* Left/center nav — always shown on the marketing navbar */}
                {NAV_GROUPS.map((group) => (
                    <NavDropdown key={group.label} group={group} />
                ))}
                <Link
                    to={NAV_PRICING.href}
                    className="hover:opacity-60 transition-opacity"
                >
                    {NAV_PRICING.label}
                </Link>

                {/* Right-side action cluster — branches on auth state */}
                {isAuthenticated && user ? (
                    // -------- LOGGED-IN CONTROLS --------
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
                                {(fullUser?.name ?? user.email).charAt(0).toUpperCase()}
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
                    // -------- LOGGED-OUT CONTROLS --------
                    <div className="flex items-center gap-6">
                        <Link
                            to="/signin"
                            className="hover:opacity-60 transition-opacity"
                        >
                            Sign In
                        </Link>
                        <button onClick={handleCTA} className="mono-btn py-2 px-4">
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
                aria-expanded={mobileOpen}
            >
                {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>

            {/* Mobile menu */}
            {mobileOpen && (
                <div className="md:hidden absolute top-full inset-x-0 bg-[#fafafa] border-b border-[#e6e6e6] px-6 py-6 flex flex-col gap-4 text-sm uppercase max-h-[calc(100vh-4rem)] overflow-y-auto">
                    {/* Dropdown groups + Pricing — shown in BOTH auth states */}
                    {NAV_GROUPS.map((group) => (
                        <MobileGroup
                            key={group.label}
                            group={group}
                            onNavigate={closeMobile}
                        />
                    ))}
                    <Link
                        to={NAV_PRICING.href}
                        onClick={closeMobile}
                        className="hover:opacity-60"
                    >
                        {NAV_PRICING.label}
                    </Link>

                    {/* Auth actions — branch on auth state */}
                    {isAuthenticated ? (
                        <div className="border-t border-[#e6e6e6] pt-4 mt-2 flex flex-col gap-3">
                            <button
                                onClick={() => {
                                    navigate("/dashboard");
                                    closeMobile();
                                }}
                                className="text-left hover:opacity-60"
                            >
                                Dashboard
                            </button>
                            <button
                                onClick={() => {
                                    navigate("/billing");
                                    closeMobile();
                                }}
                                className="text-left hover:opacity-60"
                            >
                                Billing
                            </button>
                            <button
                                onClick={() => {
                                    navigate("/profile");
                                    closeMobile();
                                }}
                                className="text-left hover:opacity-60"
                            >
                                Profile
                            </button>
                            <button
                                onClick={() => {
                                    handleLogout();
                                    closeMobile();
                                }}
                                className="text-left text-red-600 hover:opacity-60"
                            >
                                Sign Out
                            </button>
                        </div>
                    ) : (
                        <div className="border-t border-[#e6e6e6] pt-4 mt-2 flex flex-col gap-3">
                            <Link
                                to="/signin"
                                onClick={closeMobile}
                                className="hover:opacity-60"
                            >
                                Sign In
                            </Link>
                            <button
                                onClick={() => {
                                    handleCTA();
                                    closeMobile();
                                }}
                                className="mono-btn justify-center"
                            >
                                Start free scan
                            </button>
                        </div>
                    )}
                </div>
            )}
        </nav>
    );
};

export default Navbar;

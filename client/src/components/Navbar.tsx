import { LogOut, Menu, X, Clock, ArrowRight } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuthStore } from "../store/useAuthStore";
import { useState, useEffect } from "react";
import { getCurrentUser, CurrentUser } from "@/services/api";

// Live India time (IST), HH:MM, updates every second
function useIndiaTime() {
    const [time, setTime] = useState("");
    useEffect(() => {
        const update = () =>
            setTime(
                new Date().toLocaleTimeString("en-GB", {
                    timeZone: "Asia/Kolkata",
                    hour: "2-digit",
                    minute: "2-digit",
                }),
            );
        update();
        const id = setInterval(update, 1000);
        return () => clearInterval(id);
    }, []);
    return time;
}

const GithubIcon = () => (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-[18px] h-[18px]">
        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
    </svg>
);

const XIcon = () => (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-[18px] h-[18px]">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
);

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

const Navbar = () => {
    const navigate = useNavigate();
    const { isAuthenticated, user, logout } = useAuthStore();
    const [mobileOpen, setMobileOpen] = useState(false);
    const [fullUser, setFullUser] = useState<CurrentUser | null>(null);
    const [scrolled, setScrolled] = useState(false);
    const indiaTime = useIndiaTime();

    // Scroll-aware chrome: transparent over the hero, frosted-glass once scrolled.
    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 24);
        onScroll();
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => window.removeEventListener("scroll", onScroll);
    }, []);

    // Float into a pill once scrolled — but stay a full bar while the mobile menu is open.
    const pill = scrolled && !mobileOpen;

    useEffect(() => {
        if (isAuthenticated) {
            getCurrentUser()
                .then(setFullUser)
                .catch(() => {});
        }
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
    ];

    return (
        <nav className="w-full fixed top-0 inset-x-0 z-50 flex justify-center">
            {/* Animated container: full-bleed flush bar at top → floating glass pill on scroll */}
            <motion.div
                animate={{
                    maxWidth: pill ? 980 : 1440,
                    marginTop: pill ? 12 : 0,
                    borderRadius: pill ? 9999 : 0,
                    height: pill ? 56 : 64,
                }}
                transition={{ type: "spring", stiffness: 320, damping: 34, mass: 0.7 }}
                className={`w-[calc(100%-1.5rem)] sm:w-[calc(100%-3rem)] flex items-center justify-between relative ${
                    pill ? "px-4 sm:px-5" : "px-5 sm:px-8 lg:px-12"
                } ${
                    scrolled || mobileOpen
                        ? "bg-black/65 backdrop-blur-xl border border-white/10 shadow-[0_8px_30px_rgba(0,0,0,0.4)]"
                        : "bg-transparent border border-transparent"
                } transition-[background-color,border-color,box-shadow,padding] duration-300`}
            >
                {/* Logo */}
                <div
                    className="flex items-center gap-2 cursor-pointer"
                    onClick={() => navigate("/")}
                >
                    <span className="font-['Inter'] font-normal text-white text-[24px] tracking-tight">
                        Onyx
                    </span>
                    {fullUser && fullUser.plan !== "FREE" && (
                        <div className="px-1.5 py-[1px] rounded bg-cyan-500/10 border border-cyan-500/30 text-[9px] font-bold font-['JetBrains_Mono'] tracking-wide text-cyan-400 translate-y-[2px]">
                            {fullUser.plan}
                        </div>
                    )}
                </div>

                {/* Center Nav Links (Desktop) */}
                <div className={`hidden md:flex items-center transition-[gap] duration-300 ${pill ? "gap-6" : "gap-8"}`}>
                    {navLinks.map((link) => (
                        <a
                            key={link.href}
                            href={`#${link.href}`}
                            onClick={(e) => scrollToSection(e, link.href)}
                            className="font-['Inter'] font-normal text-[14px] leading-[21px] text-white hover:text-white/70 transition-colors"
                        >
                            {link.label}
                        </a>
                    ))}
                    <Link
                        to="/docs"
                        className="font-['Inter'] font-normal text-[14px] leading-[21px] text-white hover:text-white/70 transition-colors"
                    >
                        Docs
                    </Link>
                    <a
                        href="https://github.com/raghul017/Onyx"
                        target="_blank"
                        rel="noreferrer"
                        className="font-['Inter'] font-normal text-[14px] leading-[21px] text-white hover:text-white/70 transition-colors"
                    >
                        GitHub
                    </a>
                </div>

                {/* Right Actions (Desktop) */}
                <div className={`hidden md:flex items-center transition-[gap] duration-300 ${pill ? "gap-3" : "gap-6"}`}>
                    {isAuthenticated && user ? (
                        <div className={`flex items-center transition-[gap] duration-300 ${pill ? "gap-3" : "gap-4"}`}>
                            <button
                                onClick={() => navigate("/dashboard")}
                                className="font-['Inter'] font-normal text-[14px] leading-[21px] text-white/70 hover:text-white transition-colors"
                            >
                                Dashboard
                            </button>
                            <button
                                onClick={() => navigate("/history")}
                                className="font-['Inter'] font-normal text-[14px] leading-[21px] text-white/70 hover:text-white transition-colors"
                            >
                                History
                            </button>
                            <button
                                onClick={() => navigate("/billing")}
                                className="font-['Inter'] font-normal text-[14px] leading-[21px] text-white/70 hover:text-white transition-colors"
                            >
                                Billing
                            </button>
                            <div className="flex items-center gap-2.5 rounded-full pl-1.5 pr-3.5 py-1.5 bg-white/[0.03] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]">
                                <span
                                    className="flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-semibold text-black shrink-0"
                                    style={{ background: "linear-gradient(135deg,#9fe6ea,#73bfc4 55%,#8da0ce)" }}
                                    aria-hidden="true"
                                >
                                    {user.email.charAt(0).toUpperCase()}
                                </span>
                                <span className="font-['Inter'] text-[13px] text-white/85 max-w-[120px] truncate">
                                    {user.email.split("@")[0]}
                                </span>
                            </div>
                            <button
                                onClick={handleLogout}
                                className="flex items-center justify-center w-8 h-8 rounded-full text-white/45 hover:text-white hover:bg-white/[0.06] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#73bfc4]/50"
                                title="Sign out"
                                aria-label="Sign out"
                            >
                                <LogOut size={15} />
                            </button>
                        </div>
                    ) : (
                        <>
                            {/* Live India clock — hidden in compact pill mode */}
                            <div className={`${pill ? "hidden" : "hidden lg:flex"} items-center gap-1.5 text-[13px] text-white/80`}>
                                <Clock size={14} />
                                <span className="tabular-nums">
                                    {indiaTime} in India
                                </span>
                            </div>
                            <Link
                                to="/signin"
                                className="font-['Inter'] font-normal text-[14px] leading-[21px] text-white hover:text-white/70 transition-colors"
                            >
                                Sign In
                            </Link>
                            {/* CTA with text-roll hover animation */}
                            <button
                                onClick={handleCTA}
                                className="group flex items-center gap-2 bg-white text-black rounded-full pl-5 pr-2 py-1.5 font-['Inter'] text-[13px] font-medium transition-[background-color,transform] duration-200 hover:bg-neutral-200 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22d3ee]/60"
                            >
                                <span className="relative overflow-hidden h-[20px] flex flex-col leading-[20px]">
                                    <span className="flex flex-col transition-transform duration-500 ease-[cubic-bezier(0.25,0.1,0.25,1)] group-hover:-translate-y-1/2">
                                        <span>Start free scan</span>
                                        <span>Start free scan</span>
                                    </span>
                                </span>
                                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-black">
                                    <ArrowRight
                                        size={13}
                                        className="text-white transition-transform duration-500 ease-[cubic-bezier(0.25,0.1,0.25,1)] group-hover:-rotate-45"
                                    />
                                </span>
                            </button>
                        </>
                    )}

                    {/* Social icons + separator — collapse in compact pill mode */}
                    <div className={`${pill ? "hidden" : "flex"} items-center gap-4 border-l border-white/20 pl-6`}>
                        <a
                            href="https://x.com/RaghulAR7"
                            target="_blank"
                            rel="noreferrer"
                            className="text-white hover:text-white/60 transition-colors"
                        >
                            <XIcon />
                        </a>
                        <a
                            href="https://github.com/raghul017/Onyx"
                            target="_blank"
                            rel="noreferrer"
                            className="text-white hover:text-white/60 transition-colors"
                        >
                            <GithubIcon />
                        </a>
                    </div>
                </div>

                {/* Mobile Menu Toggle */}
                <button
                    className="md:hidden text-white"
                    onClick={() => setMobileOpen(!mobileOpen)}
                >
                    {mobileOpen ? <X size={20} /> : <Menu size={20} />}
                </button>
            </motion.div>

            {/* Mobile Menu */}
            {mobileOpen && (
                <div className="md:hidden absolute top-full inset-x-0 bg-black/95 backdrop-blur-xl border-t border-[#222] px-8 py-6 flex flex-col gap-4">
                    {navLinks.map((link) => (
                        <a
                            key={link.href}
                            href={`#${link.href}`}
                            onClick={(e) => {
                                scrollToSection(e, link.href);
                                setMobileOpen(false);
                            }}
                            className="font-['Inter'] text-[14px] text-white/70 hover:text-white transition-colors"
                        >
                            {link.label}
                        </a>
                    ))}
                    <Link
                        to="/docs"
                        onClick={() => setMobileOpen(false)}
                        className="font-['Inter'] text-[14px] text-white/70 hover:text-white transition-colors"
                    >
                        Docs
                    </Link>
                    <a
                        href="https://github.com/raghul017/Onyx"
                        target="_blank"
                        rel="noreferrer"
                        className="font-['Inter'] text-[14px] text-white/70 hover:text-white transition-colors"
                    >
                        GitHub
                    </a>
                    <div className="border-t border-[#222] pt-4 mt-2 flex flex-col gap-3">
                        {isAuthenticated ? (
                            <>
                                <button
                                    onClick={() => {
                                        navigate("/dashboard");
                                        setMobileOpen(false);
                                    }}
                                    className="text-left font-['Inter'] text-[14px] text-white/70 hover:text-white"
                                >
                                    Dashboard
                                </button>
                                <button
                                    onClick={() => {
                                        navigate("/history");
                                        setMobileOpen(false);
                                    }}
                                    className="text-left font-['Inter'] text-[14px] text-white/70 hover:text-white"
                                >
                                    History
                                </button>
                                <button
                                    onClick={() => {
                                        navigate("/billing");
                                        setMobileOpen(false);
                                    }}
                                    className="text-left font-['Inter'] text-[14px] text-white/70 hover:text-white"
                                >
                                    Billing
                                </button>
                                <button
                                    onClick={() => {
                                        handleLogout();
                                        setMobileOpen(false);
                                    }}
                                    className="text-left font-['Inter'] text-[14px] text-red-400 hover:text-red-300"
                                >
                                    Sign Out
                                </button>
                            </>
                        ) : (
                            <>
                                <Link
                                    to="/signin"
                                    onClick={() => setMobileOpen(false)}
                                    className="font-['Inter'] text-[14px] text-white/70 hover:text-white"
                                >
                                    Sign In
                                </Link>
                                <button
                                    onClick={() => {
                                        handleCTA();
                                        setMobileOpen(false);
                                    }}
                                    className="bg-white text-black rounded-md px-4 py-2 font-['Inter'] text-[14px] hover:bg-neutral-200 transition-colors text-center"
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

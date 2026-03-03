import { ChevronDown, User, LogOut } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/useAuthStore";

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

const Navbar = () => {
    const navigate = useNavigate();
    const { isAuthenticated, user, logout } = useAuthStore();

    const handleLogout = () => {
        logout();
        navigate("/");
    };

    return (
        <nav className="w-full bg-black fixed top-0 z-50 border-b border-[#333333]">
            <div className="w-[90%] max-w-6xl mx-auto px-8 h-16 flex items-center justify-between border-x border-[#333333] relative bg-black">
                {/* Intersection Nodes */}
                <div className="absolute -bottom-[2px] -left-[2px] w-[3px] h-[3px] bg-[#444444]" />
                <div className="absolute -bottom-[2px] -right-[2px] w-[3px] h-[3px] bg-[#444444]" />

                {/* Logo (Left) */}
                <div
                    className="flex items-center cursor-pointer"
                    onClick={() => navigate("/")}
                >
                    <span className="font-['Inter'] font-normal text-white text-[24px] tracking-tight">
                        Onyx
                    </span>
                </div>

                {/* Navigation Links (Center) */}
                <div className="hidden md:flex items-center gap-8">
                    <button className="font-['Inter'] font-normal text-[14px] leading-[21px] text-white/70 hover:text-white transition-colors flex items-center gap-1">
                        Product
                        <ChevronDown size={14} className="opacity-50" />
                    </button>
                    <a
                        href="#"
                        className="font-['Inter'] font-normal text-[14px] leading-[21px] text-white/70 hover:text-white transition-colors"
                    >
                        Integrations
                    </a>
                    <a
                        href="#"
                        className="font-['Inter'] font-normal text-[14px] leading-[21px] text-white/70 hover:text-white transition-colors"
                    >
                        Docs
                    </a>
                    <Link
                        to="/history"
                        className="font-['Inter'] font-normal text-[14px] leading-[21px] text-white/70 hover:text-white transition-colors"
                    >
                        History
                    </Link>
                    <button className="font-['Inter'] font-normal text-[14px] leading-[21px] text-white/70 hover:text-white transition-colors flex items-center gap-1">
                        Company
                        <ChevronDown size={14} className="opacity-50" />
                    </button>
                </div>

                {/* Actions (Right) */}
                <div className="flex items-center gap-6">
                    {isAuthenticated && user ? (
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => navigate("/dashboard")}
                                className="hidden md:block font-['Inter'] font-normal text-[14px] leading-[21px] text-white/70 hover:text-white transition-colors"
                            >
                                Command Center
                            </button>
                            <div className="flex items-center gap-2 bg-[#111] border border-[#222] px-3 py-1.5 rounded-full">
                                <User size={14} className="text-[#22d3ee]" />
                                <span className="text-xs font-mono text-neutral-300">
                                    {user.email.split("@")[0]}
                                </span>
                            </div>
                            <button
                                onClick={handleLogout}
                                className="text-neutral-500 hover:text-red-400 transition-colors"
                                title="Sign Out"
                            >
                                <LogOut size={16} />
                            </button>
                        </div>
                    ) : (
                        <>
                            <Link
                                to="/signin"
                                className="hidden md:block font-['Inter'] font-normal text-[14px] leading-[21px] text-white/70 hover:text-white transition-colors"
                            >
                                Sign In
                            </Link>

                            <button
                                onClick={() => navigate("/dashboard")}
                                className="bg-white text-black rounded-md px-4 py-1.5 font-['Inter'] font-normal text-[14px] leading-[21px] hover:bg-neutral-200 transition-colors"
                            >
                                Talk to us
                            </button>
                        </>
                    )}

                    <div className="flex items-center gap-4 border-l border-white/5 pl-6">
                        <a
                            href="https://x.com/raghul017"
                            target="_blank"
                            rel="noreferrer"
                            className="text-neutral-500 hover:text-white transition-colors"
                        >
                            <XIcon />
                        </a>
                        <a
                            href="https://github.com/raghul017/Onyx"
                            target="_blank"
                            rel="noreferrer"
                            className="text-neutral-500 hover:text-white transition-colors"
                        >
                            <GithubIcon />
                        </a>
                    </div>
                </div>
            </div>
        </nav>
    );
};

export default Navbar;

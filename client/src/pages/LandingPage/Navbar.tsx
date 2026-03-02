import { motion } from "framer-motion";
import { Github, Shield, User, LogOut } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "../../store/useAuthStore";

const Navbar = () => {
    const navigate = useNavigate();
    const { isAuthenticated, user, logout } = useAuthStore();

    const handleLogout = () => {
        logout();
        navigate("/");
    };

    return (
        <motion.nav
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 lg:px-12 py-4 bg-black/50 backdrop-blur-md border-b border-white/5"
        >
            <div
                className="flex items-center gap-3 cursor-pointer"
                onClick={() => navigate("/")}
            >
                <Shield className="text-white" size={24} />
                <span className="text-white font-semibold tracking-tight text-lg">
                    Onyx
                </span>
            </div>

            <div className="hidden md:flex items-center gap-8">
                <a
                    href="#features"
                    className="text-sm font-medium text-neutral-400 hover:text-white transition-colors"
                >
                    Features
                </a>
                <a
                    href="#architecture"
                    className="text-sm font-medium text-neutral-400 hover:text-white transition-colors"
                >
                    Architecture
                </a>
                <a
                    href="#docs"
                    className="text-sm font-medium text-neutral-400 hover:text-white transition-colors"
                >
                    Docs
                </a>
            </div>

            <div className="flex items-center gap-6">
                <a
                    href="https://github.com"
                    target="_blank"
                    rel="noreferrer"
                    className="text-neutral-400 hover:text-white transition-colors hidden sm:block"
                >
                    <Github size={20} />
                </a>

                {isAuthenticated && user ? (
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => navigate("/dashboard")}
                            className="text-sm font-medium text-neutral-300 hover:text-white transition-colors"
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
                    <button
                        onClick={() => navigate("/dashboard")}
                        className="bg-white text-black px-4 py-2 rounded-none font-semibold text-sm hover:bg-neutral-200 transition-colors"
                    >
                        Launch App
                    </button>
                )}
            </div>
        </motion.nav>
    );
};

export default Navbar;

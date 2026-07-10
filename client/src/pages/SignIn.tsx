import { useState, lazy, Suspense } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "motion/react";
import { Eye, EyeOff, Check, ArrowRight } from "lucide-react";
import { useAuthStore } from "../store/useAuthStore";
import { api, startOAuth } from "../services/api";
import { useServerStatus } from "../store/useServerStatus";
import ColdStartBanner from "../components/ColdStartBanner";
import { GoogleIcon, GithubIcon } from "../components/BrandIcons";

// Live WebGL mesh (three.js) — same gradient as the landing hero, lazy-loaded.
const ShaderHeroBG = lazy(() => import("../components/ShaderHeroBG"));

// Onyx mark — square-in-square glyph, matching the navbar.
const OnyxMark = ({ size = 24 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect width="24" height="24" fill="black" />
        <path d="M7 7H11V11H7V7Z" fill="white" />
        <path d="M13 13H17V17H13V13Z" fill="white" />
        <path d="M7 13H11V17H7V13Z" fill="white" />
    </svg>
);

const heroContainer = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: { staggerChildren: 0.12, delayChildren: 0.15 },
    },
};

const heroChild = {
    hidden: { opacity: 0, y: 12 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.2, 0, 0, 1] } },
};

const SignIn = () => {
    const navigate = useNavigate();
    const { setAuth } = useAuthStore();
    const { serverStatus } = useServerStatus();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [touched, setTouched] = useState({ email: false, password: false });

    const serverReady = serverStatus === "ready";

    const emailError =
        touched.email && !email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)
            ? "Enter a valid email address."
            : null;
    const passwordError =
        touched.password && password.length === 0
            ? "Password is required."
            : null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setTouched({ email: true, password: true });
        if (emailError || passwordError || !email || !password) return;
        setLoading(true);
        setError(null);
        try {
            const res = await api.post("/auth/signin", { email, password });
            const { token, user } = res.data;
            setAuth(token, user);
            navigate("/dashboard");
        } catch (err: any) {
            if (err.response?.data?.error) {
                setError(err.response.data.error);
            } else if (!err.response) {
                setError("Server is starting up. Please wait a moment and try again.");
            } else {
                setError("Failed to sign in. Please try again.");
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="onyx-mono flex min-h-screen w-full overflow-x-clip">
            <div className="fixed top-0 left-0 right-0 z-50">
                <ColdStartBanner />
            </div>

            {/* ---- Left panel: live mesh gradient + copy (desktop only) ---- */}
            <div className="hidden lg:flex w-[46%] relative flex-col justify-end p-14 border-r border-[#e6e6e6] overflow-hidden">
                {/* Animated CSS mesh (instant) + WebGL shader over it */}
                <div className="mono-hero-fallback absolute inset-0" aria-hidden="true" />
                <Suspense fallback={null}>
                    <ShaderHeroBG />
                </Suspense>
                <div className="mono-hero-grid absolute inset-0 pointer-events-none" aria-hidden="true" />
                {/* bottom scrim keeps copy legible */}
                <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-[#fafafa] via-[#fafafa]/40 to-transparent pointer-events-none" aria-hidden="true" />

                <motion.div
                    variants={heroContainer}
                    initial="hidden"
                    animate="visible"
                    className="relative z-10 w-full max-w-sm"
                >
                    <motion.div variants={heroChild} className="flex items-center gap-2 mb-10">
                        <OnyxMark />
                        <span className="font-semibold text-xl tracking-tight">Onyx</span>
                    </motion.div>

                    <motion.h1
                        variants={heroChild}
                        className="text-[40px] leading-[1.05] font-normal tracking-tight mb-4 text-balance"
                    >
                        Welcome back,
                        <br />
                        operator.
                    </motion.h1>
                    <motion.p
                        variants={heroChild}
                        className="text-[#000]/70 text-[15px] leading-7 mb-8 max-w-xs"
                    >
                        Sign in to launch scans, stream live results, and review your
                        findings.
                    </motion.p>

                    <motion.div variants={heroChild} className="space-y-2">
                        <StepItem text="AI-generated attack payloads" />
                        <StepItem text="Real-time WebSocket telemetry" />
                        <StepItem text="CVSS severity scoring" />
                    </motion.div>
                </motion.div>
            </div>

            {/* ---- Right panel: form ---- */}
            <div className="flex-1 flex flex-col items-center justify-center px-6 sm:px-12 lg:px-16 xl:px-24 py-12 bg-[#fafafa]">
                <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, ease: [0.2, 0, 0, 1] }}
                    className="w-full max-w-md space-y-8"
                >
                    {/* Mobile logo */}
                    <div className="flex items-center gap-2 lg:hidden">
                        <OnyxMark />
                        <span className="font-semibold text-xl tracking-tight">Onyx</span>
                    </div>

                    <div>
                        <h2 className="text-[32px] leading-tight font-normal tracking-tight">
                            Sign in to Onyx
                        </h2>
                        <p className="text-[#666] text-[15px] mt-2">
                            Enter your credentials to access your dashboard.
                        </p>
                    </div>

                    {error && (
                        <div className="font-mono text-[13px] text-[#dc2626] bg-[#fef2f2] border border-[#fca5a5] p-3">
                            {error}
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                        <SocialButton
                            icon={<GoogleIcon size={18} />}
                            label="Google"
                            onClick={() => startOAuth("google")}
                        />
                        <SocialButton
                            icon={<GithubIcon size={18} />}
                            label="GitHub"
                            onClick={() => startOAuth("github")}
                        />
                    </div>

                    <div className="relative flex items-center">
                        <div className="flex-1 border-t border-[#e6e6e6]" />
                        <span className="px-4 font-mono text-[11px] font-medium text-[#999] uppercase tracking-widest">
                            Or
                        </span>
                        <div className="flex-1 border-t border-[#e6e6e6]" />
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div className="space-y-2">
                            <InputGroup
                                label="Email"
                                placeholder="operator@onyx.dev"
                                type="email"
                                value={email}
                                onChange={setEmail}
                                onBlur={() => setTouched((t) => ({ ...t, email: true }))}
                            />
                            {emailError && (
                                <p className="text-[#dc2626] text-xs">{emailError}</p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <label className="font-mono text-[12px] uppercase tracking-wide text-[#666]">
                                Password
                            </label>
                            <div className="relative">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    onBlur={() =>
                                        setTouched((t) => ({ ...t, password: true }))
                                    }
                                    placeholder="••••••••"
                                    className="w-full bg-white border border-[#e6e6e6] h-11 px-4 pr-12 text-black font-mono text-[14px] placeholder:text-[#999] outline-none focus:border-black transition-colors"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword((s) => !s)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#999] hover:text-black transition-colors"
                                    aria-label={showPassword ? "Hide password" : "Show password"}
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                            {passwordError && (
                                <p className="text-[#dc2626] text-xs">{passwordError}</p>
                            )}
                        </div>

                        <button
                            type="submit"
                            disabled={
                                loading ||
                                !email ||
                                !password ||
                                !serverReady ||
                                !!emailError ||
                                !!passwordError
                            }
                            className="mono-btn w-full justify-center !py-3.5 mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {!serverReady
                                ? "Waiting for server..."
                                : loading
                                  ? "Signing in..."
                                  : "Sign In"}
                            {serverReady && !loading && <ArrowRight size={14} />}
                        </button>
                    </form>

                    <p className="text-center text-sm text-[#666]">
                        Don't have an account?{" "}
                        <Link
                            to="/signup"
                            className="text-black font-medium underline underline-offset-2 hover:text-[#3b82f6] transition-colors"
                        >
                            Create one
                        </Link>
                    </p>
                </motion.div>
            </div>
        </main>
    );
};

export default SignIn;

// ---------------------------------------------------------------------------
// Reusable components (light-mono)
// ---------------------------------------------------------------------------

function StepItem({ text }: { text: string }) {
    return (
        <div className="flex items-center gap-3 border border-[#e6e6e6] bg-white/70 backdrop-blur-sm px-4 py-3">
            <span className="flex items-center justify-center w-5 h-5 bg-[#3b82f6] text-white shrink-0">
                <Check size={12} />
            </span>
            <span className="text-[14px] font-medium text-black">{text}</span>
        </div>
    );
}

function SocialButton({
    icon,
    label,
    onClick,
}: {
    icon: React.ReactNode;
    label: string;
    onClick?: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="flex items-center justify-center gap-2.5 h-11 bg-white border border-[#e6e6e6] hover:border-black active:scale-[0.98] transition-[border-color,transform] duration-150 text-sm font-medium text-black cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3b82f6]/50"
        >
            {icon}
            {label}
        </button>
    );
}

function InputGroup({
    label,
    placeholder,
    type,
    value,
    onChange,
    onBlur,
}: {
    label: string;
    placeholder: string;
    type: string;
    value?: string;
    onChange?: (v: string) => void;
    onBlur?: () => void;
}) {
    return (
        <div className="space-y-2">
            <label className="font-mono text-[12px] uppercase tracking-wide text-[#666]">
                {label}
            </label>
            <input
                type={type}
                placeholder={placeholder}
                value={value}
                onChange={(e) => onChange?.(e.target.value)}
                onBlur={onBlur}
                className="w-full bg-white border border-[#e6e6e6] h-11 px-4 text-black font-mono text-[14px] placeholder:text-[#999] outline-none focus:border-black transition-colors"
            />
        </div>
    );
}

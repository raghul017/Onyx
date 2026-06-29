import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "motion/react";
import { Eye, EyeOff, Check } from "lucide-react";
import { useAuthStore } from "../store/useAuthStore";
import { api, startOAuth } from "../services/api";
import { useServerStatus } from "../store/useServerStatus";
import ColdStartBanner from "../components/ColdStartBanner";
import ShaderBackground from "../components/ShaderBackground";
import { GoogleIcon, GithubIcon } from "../components/BrandIcons";

// ---------------------------------------------------------------------------
// Animation variants
// ---------------------------------------------------------------------------
const heroContainer = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: { staggerChildren: 0.15, delayChildren: 0.2 },
    },
};

const heroChild = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
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
            navigate("/");
        } catch (err: any) {
            if (err.response?.data?.error) {
                setError(err.response.data.error);
            } else if (!err.response) {
                setError(
                    "Server is starting up. Please wait a moment and try again.",
                );
            } else {
                setError("Failed to sign in. Please try again.");
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="flex min-h-screen w-full bg-[#080808] text-white antialiased selection:bg-cyan-400 selection:text-black p-2 lg:h-screen lg:overflow-hidden lg:p-4">
            {/* Cold-start banner */}
            <div className="fixed top-0 left-0 right-0 z-50">
                <ColdStartBanner />
            </div>

            {/* ============================================================ */}
            {/* Left Column — Hero & Animated Gradient                        */}
            {/* ============================================================ */}
            <div className="hidden lg:flex w-[52%] relative flex-col items-center justify-end pb-32 px-12 rounded-3xl overflow-hidden shadow-2xl h-full">
                {/* Animated shader gradient background */}
                <div className="absolute inset-0">
                    <ShaderBackground />
                </div>
                {/* Subtle scrim so hero text stays legible */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/40 pointer-events-none" />

                {/* Hero content over the gradient */}
                <motion.div
                    variants={heroContainer}
                    initial="hidden"
                    animate="visible"
                    className="z-10 w-full max-w-xs space-y-8"
                >
                    {/* Brand / Logo — matches the navbar wordmark */}
                    <motion.div variants={heroChild}>
                        <span className="font-['Inter'] text-white text-[24px] tracking-tight">
                            Onyx
                        </span>
                    </motion.div>

                    {/* Heading block */}
                    <motion.div variants={heroChild} className="space-y-3">
                        <h1 className="text-4xl font-medium tracking-tight">
                            Welcome back,
                            <br />
                            operator.
                        </h1>
                        <p className="text-white/70 text-sm leading-relaxed">
                            Sign in to launch scans, stream live results, and
                            review your findings.
                        </p>
                    </motion.div>

                    {/* Reassurance points */}
                    <motion.div variants={heroChild} className="space-y-3">
                        <StepItem text="AI-generated attack payloads" active />
                        <StepItem text="Real-time WebSocket telemetry" active />
                        <StepItem text="CVSS severity scoring" active />
                    </motion.div>
                </motion.div>
            </div>

            {/* ============================================================ */}
            {/* Right Column — Sign In Form                                    */}
            {/* ============================================================ */}
            <div className="flex-1 flex flex-col items-center justify-center py-12 lg:py-6 px-4 sm:px-12 lg:px-16 xl:px-24 overflow-y-auto lg:overflow-hidden">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className="w-full max-w-xl space-y-8 lg:space-y-6 sm:space-y-10"
                >
                    {/* Header */}
                    <div className="space-y-2">
                        <h2
                            className="text-white text-3xl tracking-tight text-balance"
                            style={{ fontFamily: '"Satoshi Variable", sans-serif', fontWeight: 500 }}
                        >
                            Sign in to Onyx
                        </h2>
                        <p className="text-white/55 text-sm">
                            Enter your credentials to access your dashboard.
                        </p>
                    </div>

                    {error && (
                        <div className="font-mono text-red-400 text-sm bg-red-500/10 border border-red-500/20 p-3 rounded-xl">
                            {error}
                        </div>
                    )}

                    {/* Social buttons — server-side OAuth redirect */}
                    <div className="grid grid-cols-2 gap-4">
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

                    {/* Divider */}
                    <div className="relative flex items-center">
                        <div className="flex-1 border-t border-white/10" />
                        <span className="bg-[#080808] px-4 text-xs font-medium text-white/45 uppercase tracking-widest">
                            Or
                        </span>
                        <div className="flex-1 border-t border-white/10" />
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div className="space-y-2">
                            <InputGroup
                                label="Email"
                                placeholder="operator@onyx.dev"
                                type="email"
                                value={email}
                                onChange={setEmail}
                                onBlur={() =>
                                    setTouched((t) => ({ ...t, email: true }))
                                }
                            />
                            {emailError && (
                                <p className="text-red-400 text-xs">{emailError}</p>
                            )}
                        </div>

                        {/* Password with eye toggle */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-white">
                                Password
                            </label>
                            <div className="relative">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    onBlur={() =>
                                        setTouched((t) => ({
                                            ...t,
                                            password: true,
                                        }))
                                    }
                                    placeholder="••••••••"
                                    className="w-full bg-[#0E0F10] rounded-xl h-11 px-4 pr-12 text-white placeholder:text-white/25 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)] focus:shadow-[inset_0_0_0_1px_rgba(115,191,196,0.5)] outline-none transition-shadow"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword((s) => !s)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-white/50 hover:text-white transition-colors"
                                    aria-label={
                                        showPassword
                                            ? "Hide password"
                                            : "Show password"
                                    }
                                >
                                    {showPassword ? (
                                        <EyeOff size={18} />
                                    ) : (
                                        <Eye size={18} />
                                    )}
                                </button>
                            </div>
                            {passwordError && (
                                <p className="text-red-400 text-xs">
                                    {passwordError}
                                </p>
                            )}
                        </div>

                        {/* Submit */}
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
                            className="w-full h-14 bg-white text-black font-semibold rounded-xl hover:bg-neutral-100 active:scale-[0.98] mt-4 transition-[background-color,transform] duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[#080808] focus-visible:ring-[#73bfc4]"
                        >
                            {!serverReady
                                ? "Waiting for server..."
                                : loading
                                  ? "Signing in..."
                                  : "Sign In"}
                        </button>
                    </form>

                    {/* Footer link */}
                    <p className="text-center text-sm text-white/55">
                        Don't have an account?{" "}
                        <Link
                            to="/signup"
                            className="text-white font-medium hover:text-[#73bfc4] transition-colors"
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
// Reusable Components
// ---------------------------------------------------------------------------

function StepItem({
    number,
    text,
    active = false,
}: {
    number?: number;
    text: string;
    active?: boolean;
}) {
    return (
        <div
            className={`flex items-center gap-3 rounded-xl px-4 py-3 transition-colors ${
                active
                    ? "bg-white text-black"
                    : "bg-white/[0.06] backdrop-blur-sm text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]"
            }`}
        >
            <div
                className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-semibold shrink-0 ${
                    active ? "bg-[#0B0C0D] text-[#73bfc4]" : "bg-white/10 text-white/45"
                }`}
            >
                {active ? <Check size={13} /> : number}
            </div>
            <span className="text-sm font-medium">{text}</span>
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
            className="flex items-center justify-center gap-2.5 h-11 bg-[#0B0C0D] rounded-xl shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)] hover:shadow-[inset_0_0_0_1px_rgba(115,191,196,0.4)] active:scale-[0.98] transition-[box-shadow,transform] duration-200 text-sm font-medium text-white/90 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#73bfc4]/60"
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
            <label className="text-sm font-medium text-white">{label}</label>
            <input
                type={type}
                placeholder={placeholder}
                value={value}
                onChange={(e) => onChange?.(e.target.value)}
                onBlur={onBlur}
                className="w-full bg-[#0E0F10] rounded-xl h-11 px-4 text-white placeholder:text-white/25 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)] focus:shadow-[inset_0_0_0_1px_rgba(115,191,196,0.5)] outline-none transition-shadow"
            />
        </div>
    );
}

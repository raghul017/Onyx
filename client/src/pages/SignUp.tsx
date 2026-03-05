import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Shield } from "lucide-react";
import { useAuthStore } from "../store/useAuthStore";
import { api } from "../services/api";
import { useServerStatus } from "../store/useServerStatus";
import ColdStartBanner from "../components/ColdStartBanner";

const SignUp = () => {
    const navigate = useNavigate();
    const { setAuth } = useAuthStore();
    const { serverStatus } = useServerStatus();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const serverReady = serverStatus === "ready";

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            const res = await api.post("/auth/signup", { email, password });
            const { token, user } = res.data;
            // The prompt requested: useAuthStore.getState().setToken(token) and save to store.
            // Our setAuth handles local storage persistence natively via zustand persist middleware.
            setAuth(token, user);
            navigate("/dashboard");
        } catch (err: any) {
            if (err.response?.data?.error) {
                setError(err.response.data.error);
            } else if (!err.response) {
                // Network error — server unreachable (likely cold start)
                setError(
                    "Server is starting up — please wait a moment and try again.",
                );
            } else {
                setError("Failed to create account. Please try again.");
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#000000] flex flex-col items-center justify-center p-4">
            {/* Cold-start banner — positioned at top */}
            <div className="fixed top-0 left-0 right-0 z-50">
                <ColdStartBanner />
            </div>
            <Link
                to="/"
                className="flex items-center gap-3 mb-8 hover:opacity-80 transition-opacity"
            >
                <Shield size={32} className="text-white" />
                <span className="text-white text-2xl font-bold tracking-tight font-['Inter']">
                    Onyx
                </span>
            </Link>

            <div className="w-full max-w-md bg-[#0A0A0A] border border-[#1A1A1A] rounded-lg p-8 shadow-2xl">
                <h1 className="text-2xl font-semibold text-white mb-6 font-['Inter']">
                    Create your account
                </h1>

                {error && (
                    <div className="mb-6 font-mono text-red-500 text-sm bg-red-500/10 p-3 rounded">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <label className="block text-sm font-mono text-neutral-300">
                            Email
                        </label>
                        <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full bg-black border border-[#2A2A2A] text-white font-mono px-4 py-2 rounded outline-none focus:border-[#22d3ee] focus:ring-1 focus:ring-[#22d3ee] transition-all"
                            placeholder="operator@onyx.dev"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="block text-sm font-mono text-neutral-300">
                            Password
                        </label>
                        <input
                            type="password"
                            required
                            minLength={8}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full bg-black border border-[#2A2A2A] text-white font-mono px-4 py-2 rounded outline-none focus:border-[#22d3ee] focus:ring-1 focus:ring-[#22d3ee] transition-all"
                            placeholder="•••••••• (Min 8 chars)"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={
                            loading ||
                            !email ||
                            password.length < 8 ||
                            !serverReady
                        }
                        className="w-full font-['Inter'] font-semibold py-2.5 mt-4 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-white text-black hover:bg-neutral-200"
                    >
                        {!serverReady
                            ? "Waiting for server..."
                            : loading
                              ? "Provisioning..."
                              : "Establish Uplink"}
                    </button>
                </form>

                <p className="mt-6 text-sm text-center text-neutral-400 font-['Inter']">
                    Already an operator?{" "}
                    <Link to="/signin" className="text-white hover:underline">
                        Sign in to Onyx
                    </Link>
                </p>
            </div>
        </div>
    );
};

export default SignUp;

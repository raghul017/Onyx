// =============================================================================
// OAuthCallback — lands here after the backend completes a Google/GitHub login.
// The backend redirects to /auth/callback#token=<jwt> (or #error=<reason>),
// with the token in the URL fragment so it never reaches server logs. We decode
// the JWT, store auth, and forward to the dashboard. On error, fall back to /signin.
// =============================================================================

import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/useAuthStore";

const ERROR_COPY: Record<string, string> = {
    not_configured: "Social sign-in is not configured yet. Use email and password for now.",
    missing_code: "The sign-in response was incomplete. Please try again.",
    bad_state: "The sign-in request expired or could not be verified. Please try again.",
    no_email: "We could not read a verified email from that account.",
    oauth_failed: "Social sign-in failed. Please try again.",
};

function decodeUser(token: string): { id: string; email: string } | null {
    try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        if (payload?.id && payload?.email) {
            return { id: payload.id, email: payload.email };
        }
        return null;
    } catch {
        return null;
    }
}

const OAuthCallback = () => {
    const navigate = useNavigate();
    const setAuth = useAuthStore((s) => s.setAuth);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const frag = new URLSearchParams(window.location.hash.slice(1));
        const token = frag.get("token");
        const err = frag.get("error");

        if (token) {
            const user = decodeUser(token);
            if (user) {
                setAuth(token, user);
                // Clear the token from the URL before navigating away.
                window.history.replaceState(null, "", window.location.pathname);
                navigate("/dashboard", { replace: true });
                return;
            }
            setError(ERROR_COPY.oauth_failed);
            return;
        }
        setError(ERROR_COPY[err ?? "oauth_failed"] ?? ERROR_COPY.oauth_failed);
    }, [navigate, setAuth]);

    return (
        <main className="onyx-mono min-h-screen flex items-center justify-center px-6">
            <div className="w-full max-w-sm text-center">
                <div className="flex items-center justify-center gap-2">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <rect width="24" height="24" fill="black" />
                        <path d="M7 7H11V11H7V7Z" fill="white" />
                        <path d="M13 13H17V17H13V13Z" fill="white" />
                        <path d="M7 13H11V17H7V13Z" fill="white" />
                    </svg>
                    <span className="font-semibold text-[22px] tracking-tight">Onyx</span>
                </div>

                {!error ? (
                    <div className="mt-8 flex flex-col items-center gap-4">
                        <span
                            className="h-6 w-6 rounded-full border-2 border-[#e6e6e6] border-t-[#3b82f6] animate-spin"
                            aria-hidden="true"
                        />
                        <p className="font-mono text-[13px] uppercase tracking-wide text-[#666]">
                            Signing you in…
                        </p>
                    </div>
                ) : (
                    <div className="mt-8 flex flex-col items-center gap-5">
                        <p className="text-[14px] leading-[1.6] text-[#555] text-pretty max-w-[34ch]">
                            {error}
                        </p>
                        <Link to="/signin" className="mono-btn">
                            Back to sign in
                        </Link>
                    </div>
                )}
            </div>
        </main>
    );
};

export default OAuthCallback;

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
        <main className="min-h-screen bg-[#080808] text-white font-['Inter'] antialiased flex items-center justify-center px-6">
            <div className="w-full max-w-sm text-center">
                <span className="font-['Inter'] text-white text-[22px] tracking-tight">
                    Onyx
                </span>

                {!error ? (
                    <div className="mt-8 flex flex-col items-center gap-4">
                        <span
                            className="h-6 w-6 rounded-full border-2 border-white/15 border-t-[#73bfc4] animate-spin"
                            aria-hidden="true"
                        />
                        <p className="text-[14px] text-white/55">Signing you in…</p>
                    </div>
                ) : (
                    <div className="mt-8 flex flex-col items-center gap-5">
                        <p className="text-[14px] leading-[1.6] text-[#A1A1AA] text-pretty max-w-[34ch]">
                            {error}
                        </p>
                        <Link
                            to="/signin"
                            className="inline-flex items-center justify-center bg-white text-black rounded-full px-5 py-2 text-[14px] font-semibold hover:bg-neutral-100 active:scale-[0.96] transition-[background-color,transform] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[#080808] focus-visible:ring-[#73bfc4]"
                        >
                            Back to sign in
                        </Link>
                    </div>
                )}
            </div>
        </main>
    );
};

export default OAuthCallback;

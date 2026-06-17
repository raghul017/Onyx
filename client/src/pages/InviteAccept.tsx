// =============================================================================
// InviteAccept — handles /invite/accept?token=<token>
// =============================================================================

import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Shield, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { acceptInviteApi, getMyOrgs } from "@/services/api";
import { useAuthStore } from "@/store/useAuthStore";
import { useOrgStore } from "@/store/useOrgStore";

export default function InviteAccept() {
    const [params] = useSearchParams();
    const navigate = useNavigate();
    const token = params.get("token") ?? "";
    const { isAuthenticated } = useAuthStore();
    const { setActiveOrg } = useOrgStore();

    const [state, setState] = useState<"loading" | "success" | "error">("loading");
    const [orgName, setOrgName] = useState<string | null>(null);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    useEffect(() => {
        if (!token) {
            setState("error");
            setErrorMsg("No invite token found in the URL.");
            return;
        }

        // Not logged in — store token and redirect to sign in
        if (!isAuthenticated) {
            sessionStorage.setItem("onyx-pending-invite", token);
            navigate("/signin");
            return;
        }

        acceptInviteApi(token)
            .then(async ({ orgId }) => {
                // Fetch orgs to get org name + set active
                const { orgs } = await getMyOrgs();
                const joined = orgs.find((o) => o.id === orgId);
                if (joined) {
                    setActiveOrg(joined);
                    setOrgName(joined.name);
                }
                setState("success");
            })
            .catch((err) => {
                const msg = err?.response?.data?.error ?? "Failed to accept invite.";
                setErrorMsg(msg);
                setState("error");
            });
    }, [token, isAuthenticated]);

    return (
        <div className="min-h-screen bg-black flex items-center justify-center font-['Inter']">
            <div className="w-full max-w-md px-6">
                <div className="flex items-center gap-2 mb-8">
                    <Shield size={18} className="text-cyan-400" />
                    <span className="text-white font-semibold tracking-tight">Onyx</span>
                </div>

                <div className="border border-neutral-800 bg-[#0A0A0A] rounded-sm p-8 text-center">
                    {state === "loading" && (
                        <>
                            <Loader2 size={32} className="text-neutral-600 animate-spin mx-auto mb-4" />
                            <p className="text-neutral-400 text-[14px]">Accepting invite...</p>
                        </>
                    )}

                    {state === "success" && (
                        <>
                            <CheckCircle size={32} className="text-emerald-400 mx-auto mb-4" />
                            <h2 className="text-white font-semibold text-lg mb-2">You're in!</h2>
                            {orgName && (
                                <p className="text-neutral-400 text-[14px] mb-6">
                                    You've joined <span className="text-white font-medium">{orgName}</span>.
                                </p>
                            )}
                            <button
                                onClick={() => navigate("/dashboard")}
                                className="bg-white text-black text-[13px] font-bold px-6 py-2 rounded-sm hover:bg-neutral-200 transition-colors"
                            >
                                Go to Dashboard
                            </button>
                        </>
                    )}

                    {state === "error" && (
                        <>
                            <XCircle size={32} className="text-red-400 mx-auto mb-4" />
                            <h2 className="text-white font-semibold text-lg mb-2">Invite Failed</h2>
                            <p className="text-neutral-400 text-[14px] mb-6">{errorMsg}</p>
                            <button
                                onClick={() => navigate("/")}
                                className="text-neutral-500 hover:text-white text-[13px] transition-colors"
                            >
                                Go home
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

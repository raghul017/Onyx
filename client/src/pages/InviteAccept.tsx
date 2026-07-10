// =============================================================================
// InviteAccept — handles /invite/accept?token=<token>
// =============================================================================

import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
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
        <div className="onyx-mono min-h-screen flex items-center justify-center">
            <div className="w-full max-w-md px-6">
                <div className="flex items-center gap-2 mb-8">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <rect width="24" height="24" fill="black" />
                        <path d="M7 7H11V11H7V7Z" fill="white" />
                        <path d="M13 13H17V17H13V13Z" fill="white" />
                        <path d="M7 13H11V17H7V13Z" fill="white" />
                    </svg>
                    <span className="font-semibold text-xl tracking-tight">Onyx</span>
                </div>

                <div className="border border-[#e6e6e6] bg-white p-8 text-center">
                    {state === "loading" && (
                        <>
                            <Loader2 size={30} className="text-[#3b82f6] animate-spin mx-auto mb-4" />
                            <p className="font-mono text-[13px] uppercase tracking-wide text-[#666]">
                                Accepting invite…
                            </p>
                        </>
                    )}

                    {state === "success" && (
                        <>
                            <span className="inline-flex items-center justify-center w-11 h-11 bg-[#16a34a] text-white mx-auto mb-4">
                                <CheckCircle size={22} />
                            </span>
                            <h2 className="text-black font-medium text-[20px] tracking-tight mb-2">
                                You're in.
                            </h2>
                            {orgName && (
                                <p className="text-[#666] text-[14px] mb-6">
                                    You've joined{" "}
                                    <span className="text-black font-medium">{orgName}</span>.
                                </p>
                            )}
                            <button
                                onClick={() => navigate("/dashboard")}
                                className="mono-btn justify-center"
                            >
                                Go to dashboard
                            </button>
                        </>
                    )}

                    {state === "error" && (
                        <>
                            <span className="inline-flex items-center justify-center w-11 h-11 bg-[#dc2626] text-white mx-auto mb-4">
                                <XCircle size={22} />
                            </span>
                            <h2 className="text-black font-medium text-[20px] tracking-tight mb-2">
                                Invite failed
                            </h2>
                            <p className="text-[#666] text-[14px] mb-6">{errorMsg}</p>
                            <button
                                onClick={() => navigate("/")}
                                className="mono-btn-ghost justify-center"
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

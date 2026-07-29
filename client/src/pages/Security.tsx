// =============================================================================
// /security — trust / security overview (T21a stub).
// Presentable placeholder; full posture page (SSRF, domain verification, secret
// handling, data handling, disclosure pointer) lands in T21e.
// =============================================================================
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import MarketingPage from "../components/MarketingPage";

const PILLARS = [
    {
        title: "Domain-verified targets",
        body: "Onyx only fires payloads at APIs whose domain you've proven you own — via a file probe or DNS TXT record.",
    },
    {
        title: "SSRF-guarded engine",
        body: "The attack engine blocks internal/metadata addresses and enforces per-plan rate limits and a hard job timeout.",
    },
    {
        title: "Secrets encrypted at rest",
        body: "Auth credentials (tokens, keys, OAuth secrets) are encrypted with AES-256-GCM and never written to logs.",
    },
];

const Security = () => (
    <MarketingPage>
        <section className="border-b border-[#e6e6e6] px-6 pt-16 pb-12 lg:pt-24">
            <div className="max-w-[1280px] mx-auto">
                <div className="mono-eyebrow mb-4">
                    <span className="sq" /> SECURITY
                </div>
                <h1 className="text-[clamp(2rem,5vw,44px)] leading-tight text-balance max-w-2xl">
                    Security at Onyx.
                </h1>
                <p className="text-[15px] text-[#666] mt-4 max-w-xl leading-relaxed">
                    Onyx is an offensive tool built to be safe by design: it attacks only
                    APIs you own, guards against SSRF, and encrypts every secret at rest.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 border-t border-l border-[#e6e6e6] mt-10">
                    {PILLARS.map((p) => (
                        <div key={p.title} className="border-r border-b border-[#e6e6e6] p-6 bg-white">
                            <h2 className="text-[15px] mb-2">{p.title}</h2>
                            <p className="text-[13.5px] text-[#666] leading-relaxed">{p.body}</p>
                        </div>
                    ))}
                </div>

                <Link
                    to="/docs"
                    className="mono-btn mt-10 inline-flex w-max"
                >
                    Read the security docs
                    <ArrowRight size={14} />
                </Link>
            </div>
        </section>
    </MarketingPage>
);

export default Security;

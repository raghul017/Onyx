// =============================================================================
// MoreFeatures — the composio for-you sections I was missing, mapped to Onyx:
//   • "Multiple accounts per app"  → "Every spec, every environment"
//   • "Stay on the bleeding edge"  → "Swap models without re-wiring" (bullets)
//   • "Peace of mind" + Guardrails → "Safe by design" two-up
//   • Privacy pair                 → "Never touches production" / "Your data stays yours"
// Rounded surfaces, hairline borders, NO shadows, scroll-entrance animations.
// =============================================================================

import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Check, ShieldCheck, EyeOff, Lock } from "lucide-react";

const enter = {
    initial: { opacity: 0, y: 24 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: "-100px" },
    transition: { duration: 0.6, ease: [0.2, 0, 0, 1] as const },
};

const MoreFeatures = () => {
    const navigate = useNavigate();

    return (
        <>
            {/* ---- Multi-environment (composio "Multiple accounts per app") ---- */}
            <section className="border-b border-[#e6e6e6] grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-[#e6e6e6]">
                <motion.div {...enter} className="p-12 lg:p-24 flex flex-col justify-center">
                    <div className="mono-eyebrow mb-4">
                        <span className="sq" /> MULTI-ENVIRONMENT
                    </div>
                    <h2 className="text-[44px] mb-6 leading-[1.05] text-balance">
                        Every spec, every environment
                    </h2>
                    <p className="text-[#000]/70 max-w-md text-[17px] leading-7 text-pretty">
                        Point Onyx at staging, then production, then a partner's sandbox,
                        each with its own ownership proof. Run them all from one dashboard,
                        no re-setup between targets.
                    </p>
                </motion.div>

                {/* env chips */}
                <div className="p-12 lg:p-24 bg-white/50 flex items-center justify-center">
                    <motion.div {...enter} className="w-full max-w-md grid grid-cols-2 gap-3">
                        {[
                            { env: "staging", host: "api.staging.acme.dev", ok: true },
                            { env: "production", host: "api.acme.com", ok: true },
                            { env: "partner", host: "api.partner.io", ok: true },
                            { env: "local", host: "localhost:4000", ok: false },
                        ].map((e) => (
                            <div
                                key={e.env}
                                className="mono-card p-4 flex flex-col gap-2"
                            >
                                <div className="flex items-center justify-between">
                                    <span className="font-mono text-[11px] uppercase tracking-wide text-[#666]">
                                        {e.env}
                                    </span>
                                    <span
                                        className={`w-2 h-2 rounded-full ${
                                            e.ok ? "bg-[#16a34a]" : "bg-[#ccc]"
                                        }`}
                                    />
                                </div>
                                <span className="font-mono text-[12px] text-black truncate">
                                    {e.host}
                                </span>
                                <span className="font-mono text-[10px] text-[#999]">
                                    {e.ok ? "verified" : "unverified"}
                                </span>
                            </div>
                        ))}
                    </motion.div>
                </div>
            </section>

            {/* ---- Swap models (composio "Stay on the bleeding edge") ---- */}
            <section className="border-b border-[#e6e6e6] p-12 lg:p-24">
                <motion.div {...enter} className="max-w-2xl">
                    <div className="mono-eyebrow mb-4">
                        <span className="sq" /> MODEL-AGNOSTIC
                    </div>
                    <h2 className="text-[44px] mb-6 leading-[1.05] text-balance">
                        Swap models without re-wiring
                    </h2>
                    <p className="text-[#000]/70 mb-8 max-w-md text-[17px] leading-7 text-pretty">
                        Your attack config lives with Onyx, not the model. The moment a
                        sharper model ships, point to it and your specs, scopes, and
                        history come along.
                    </p>
                    <ul className="space-y-3 mb-8">
                        {[
                            "Gemini 2.5 Flash today, the next SOTA model tomorrow, zero re-config",
                            "Static fallback payloads keep runs green even if the model is down",
                            "Per-endpoint tuning is preserved across every model swap",
                        ].map((b) => (
                            <li
                                key={b}
                                className="flex items-start gap-2.5 text-[14px] leading-6 text-[#333]"
                            >
                                <Check size={15} className="shrink-0 mt-0.5 text-[#3b82f6]" />
                                {b}
                            </li>
                        ))}
                    </ul>
                    <button onClick={() => navigate("/signup")} className="mono-btn-ghost w-fit">
                        Start free scan <ArrowRight size={14} />
                    </button>
                </motion.div>
            </section>

            {/* ---- Safe by design (composio "Peace of mind" + guardrails) ---- */}
            <section className="border-b border-[#e6e6e6] p-12 lg:p-24">
                <motion.div {...enter} className="mb-12 max-w-2xl">
                    <div className="mono-eyebrow mb-4">
                        <span className="sq" /> BUILT TO BE SAFE
                    </div>
                    <h2 className="text-[44px] mb-4 leading-[1.05] text-balance">
                        Peace of mind, built in
                    </h2>
                    <p className="text-[#000]/70 max-w-md text-[17px] leading-7 text-pretty">
                        Onyx acts on your behalf and never puts you at risk. Every run is
                        fenced by ownership proofs, SSRF guards, and hard timeouts.
                    </p>
                </motion.div>

                <div className="grid grid-cols-1 md:grid-cols-3 border-t border-l border-[#e6e6e6] overflow-hidden">
                    {[
                        {
                            icon: ShieldCheck,
                            title: "Ownership-gated",
                            body: "No payload fires until you prove you own the target via file probe or DNS TXT record.",
                        },
                        {
                            icon: EyeOff,
                            title: "Never touches prod by accident",
                            body: "SSRF guards block private and internal hosts; per-plan rate limits and a 10s timeout cap every job.",
                        },
                        {
                            icon: Lock,
                            title: "Your data stays yours",
                            body: "Onyx stores results scoped to your account. No one else sees your specs, payloads, or findings.",
                        },
                    ].map((c, i) => {
                        const Icon = c.icon;
                        return (
                            <motion.div
                                key={c.title}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true, margin: "-80px" }}
                                transition={{ delay: i * 0.1, duration: 0.5, ease: [0.2, 0, 0, 1] }}
                                className="group flex flex-col border-r border-b border-[#e6e6e6] p-6 hover:bg-white transition-colors"
                            >
                                <span className="inline-flex items-center justify-center w-11 h-11 border border-[#e6e6e6] bg-white mb-6 text-[#3b82f6]">
                                    <Icon size={20} />
                                </span>
                                <h3 className="text-[20px] font-medium mb-2">{c.title}</h3>
                                <p className="text-[14px] text-[#666] leading-relaxed text-pretty">
                                    {c.body}
                                </p>
                            </motion.div>
                        );
                    })}
                </div>
            </section>
        </>
    );
};

export default MoreFeatures;

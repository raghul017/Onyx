// =============================================================================
// HowItWorks — "Key Benefits"-style 3-card layout, Onyx content (dark theme)
// =============================================================================

// Hero-matched gradient blob (purple/slate water-plane palette)
const BLOB_GRADIENT =
    "radial-gradient(circle at 30% 30%, #8d7dca, transparent 60%), radial-gradient(circle at 70% 70%, #606080, transparent 60%), radial-gradient(circle at 50% 50%, #8d7dca, transparent 70%)";

const HowItWorks = () => {
    return (
        <section
            id="how-it-works"
            className="relative w-full bg-black px-5 sm:px-8 lg:px-12 py-16 sm:py-20 lg:py-24"
        >
            <div className="w-full max-w-[1280px] mx-auto">
                {/* Badge row */}
                <div className="flex items-center gap-3 mb-6 sm:mb-8">
                    <div className="flex items-center justify-center w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-white text-black text-[11px] sm:text-[12px] font-semibold">
                        02
                    </div>
                    <span className="text-[12px] sm:text-[13px] font-medium text-white/80 border border-[#2A2A2A] rounded-full px-3 sm:px-4 py-1 sm:py-1.5">
                        How it works
                    </span>
                </div>

                {/* Heading */}
                <h2
                    className="text-white text-3xl sm:text-4xl md:text-5xl font-light mb-10 sm:mb-14"
                    style={{ letterSpacing: "-0.04em" }}
                >
                    How Onyx breaks your API.
                </h2>

                {/* Three-column card grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
                    {/* ----------------------------------------------------- */}
                    {/* Card 1 — Ingest Schema (text)                        */}
                    {/* ----------------------------------------------------- */}
                    <div className="relative h-[340px] sm:h-[420px] rounded-2xl bg-neutral-950 overflow-hidden p-6 sm:p-8">
                        {/* Hero-matched gradient blob */}
                        <div
                            className="absolute top-1/2 -translate-y-1/2 -left-40 h-72 w-72 rounded-full blur-3xl opacity-50"
                            style={{ background: BLOB_GRADIENT }}
                        />

                        <div className="relative z-10 flex flex-col h-full">
                            <div className="text-[#8d7dca] text-[13px] tracking-widest font-['JetBrains_Mono'] mb-4">
                                [01]
                            </div>
                            <h3 className="text-white text-xl sm:text-2xl font-light leading-tight">
                                Ingest
                                <br />
                                Your API Schema
                            </h3>
                            <p className="mt-8 sm:mt-12 text-[13px] sm:text-[14px] leading-relaxed text-white/70 font-light max-w-[280px]">
                                Paste your OpenAPI v3 or Swagger URL. The engine
                                parses every route, parameter, and request body
                                schema automatically — no manual setup.
                            </p>
                        </div>
                    </div>

                    {/* ----------------------------------------------------- */}
                    {/* Card 2 — AI Generation (text)                        */}
                    {/* ----------------------------------------------------- */}
                    <div className="relative h-[340px] sm:h-[420px] rounded-2xl bg-neutral-950 overflow-hidden p-6 sm:p-8">
                        {/* Hero-matched gradient blob */}
                        <div
                            className="absolute -top-24 left-1/2 -translate-x-1/2 h-72 w-72 rounded-full blur-3xl opacity-50"
                            style={{ background: BLOB_GRADIENT }}
                        />

                        <div className="relative z-10 flex flex-col h-full">
                            <div className="text-[#8d7dca] text-[13px] tracking-widest font-['JetBrains_Mono'] mb-4">
                                [02]
                            </div>
                            <h3 className="text-white text-xl sm:text-2xl font-light leading-tight">
                                AI-Generated
                                <br />
                                Attack Payloads
                            </h3>
                            <p className="mt-8 sm:mt-12 text-[13px] sm:text-[14px] leading-relaxed text-white/70 font-light max-w-[280px]">
                                Gemini 2.5 Flash analyzes each endpoint and crafts
                                targeted payloads — SQL injection, XSS, auth bypass,
                                and more — tuned to your schema.
                            </p>
                        </div>
                    </div>

                    {/* ----------------------------------------------------- */}
                    {/* Card 3 — Queue & Fire (text)                         */}
                    {/* ----------------------------------------------------- */}
                    <div className="relative h-[340px] sm:h-[420px] rounded-2xl bg-neutral-950 overflow-hidden p-6 sm:p-8">
                        {/* Hero-matched gradient blob */}
                        <div
                            className="absolute -top-24 -right-24 h-72 w-72 rounded-full blur-3xl opacity-50"
                            style={{ background: BLOB_GRADIENT }}
                        />

                        <div className="relative z-10 flex flex-col h-full">
                            <div className="text-[#8d7dca] text-[13px] tracking-widest font-['JetBrains_Mono'] mb-4">
                                [03]
                            </div>
                            <h3 className="text-white text-xl sm:text-2xl font-light leading-tight">
                                Queue, Fire
                                <br />
                                &amp; Stream Results
                            </h3>
                            <p className="mt-8 sm:mt-12 text-[13px] sm:text-[14px] leading-relaxed text-white/70 font-light max-w-[280px]">
                                Payloads load into a BullMQ Redis queue and fire
                                at the target, with every result streaming back
                                live over WebSockets and scored by severity.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default HowItWorks;

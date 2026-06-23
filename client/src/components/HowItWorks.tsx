// =============================================================================
// HowItWorks — "Key Benefits"-style 3-card layout, Onyx content (dark theme)
// =============================================================================

const VIDEO_URL =
    "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260421_072701_f6a01abb-eb30-4559-9d6e-774362defbc3.mp4";

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
                        {/* Cyan blob */}
                        <div className="absolute top-1/2 -translate-y-1/2 -left-[420px] h-[460px] w-[460px] rounded-full bg-[#0e7490] blur-3xl opacity-40" />

                        <div className="relative z-10 flex flex-col h-full">
                            <div className="text-[#06b6d4] text-[13px] tracking-widest font-['JetBrains_Mono'] mb-4">
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
                    {/* Card 2 — AI Generation (video)                       */}
                    {/* ----------------------------------------------------- */}
                    <div className="relative h-[340px] sm:h-[420px] rounded-2xl bg-neutral-950 overflow-hidden flex flex-col">
                        {/* Top video region */}
                        <div
                            className="relative w-full overflow-hidden"
                            style={{ height: "75%" }}
                        >
                            <video
                                className="w-full h-full object-cover block"
                                autoPlay
                                loop
                                muted
                                playsInline
                            >
                                <source src={VIDEO_URL} type="video/mp4" />
                            </video>
                            {/* Bottom fade overlay */}
                            <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-b from-transparent to-neutral-950" />
                        </div>

                        {/* Bottom text region */}
                        <div className="flex-1 flex items-center justify-start p-6 sm:p-8">
                            <div>
                                <div className="text-[#06b6d4] text-[13px] tracking-widest font-['JetBrains_Mono'] mb-2">
                                    [02]
                                </div>
                                <h3 className="text-white text-xl sm:text-2xl font-light leading-tight text-left">
                                    AI-Generated
                                    <br />
                                    Attack Payloads
                                </h3>
                            </div>
                        </div>
                    </div>

                    {/* ----------------------------------------------------- */}
                    {/* Card 3 — Queue & Fire (text)                         */}
                    {/* ----------------------------------------------------- */}
                    <div className="relative h-[340px] sm:h-[420px] rounded-2xl bg-neutral-950 overflow-hidden p-6 sm:p-8">
                        {/* Cyan blob */}
                        <div className="absolute -top-28 -right-28 h-56 w-56 rounded-full bg-[#0e7490] blur-3xl opacity-40" />

                        <div className="relative z-10 flex flex-col h-full">
                            <div className="text-[#06b6d4] text-[13px] tracking-widest font-['JetBrains_Mono'] mb-4">
                                [03]
                            </div>
                            <h3 className="text-white text-xl sm:text-2xl font-light leading-tight">
                                Queue, Fire
                                <br />
                                &amp; Stream Results
                            </h3>
                            <p className="mt-auto text-[13px] sm:text-[14px] leading-relaxed text-white/70 font-light max-w-[320px]">
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

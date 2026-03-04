const Pipeline = () => {
    return (
        <div className="relative w-full bg-black text-[#F3F4F6] antialiased overflow-hidden">
            <style>{`
                .lift-card {
                    position: relative;
                    transform-style: preserve-3d;
                    transition: transform 0.6s cubic-bezier(0.19, 1, 0.22, 1);
                }

                .lift-card::before {
                    content: '';
                    position: absolute;
                    bottom: -10px;
                    left: 5%;
                    right: 5%;
                    height: 10px;
                    background: rgba(6, 182, 212, 0);
                    filter: blur(8px);
                    transition: all 0.6s cubic-bezier(0.19, 1, 0.22, 1);
                    transform: translateZ(-1px);
                }

                .lift-card::after {
                    content: '';
                    position: absolute;
                    bottom: 0;
                    left: 0;
                    right: 0;
                    height: 2px;
                    background: rgba(255, 255, 255, 0.1);
                    transition: all 0.6s cubic-bezier(0.19, 1, 0.22, 1);
                    transform-origin: bottom;
                }

                .lift-card:hover {
                    transform: perspective(1000px) rotateX(2deg) translateY(-4px);
                }

                .lift-card:hover::before {
                    background: rgba(6, 182, 212, 0.4);
                    bottom: -15px;
                    height: 15px;
                    filter: blur(12px);
                }

                .lift-card:hover::after {
                    height: 6px;
                    background: rgba(6, 182, 212, 0.8);
                    transform: rotateX(-80deg);
                }

                .sweep-container {
                    position: absolute;
                    inset: 0;
                    overflow: hidden;
                    pointer-events: none;
                }

                .sweep {
                    position: absolute;
                    top: 0;
                    bottom: 0;
                    left: -100%;
                    width: 50%;
                    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.08), transparent);
                    transform: skewX(-20deg);
                }

                .lift-card:hover .sweep {
                    animation: sweep-anim 1s cubic-bezier(0.19, 1, 0.22, 1) forwards;
                }

                @keyframes sweep-anim {
                    0% { left: -100%; }
                    100% { left: 200%; }
                }

                .corner-tick {
                    position: absolute;
                    width: 8px;
                    height: 8px;
                    opacity: 0;
                    transition: all 0.5s cubic-bezier(0.19, 1, 0.22, 1);
                    pointer-events: none;
                }

                .corner-tl { top: 0; left: 0; border-top: 1px solid #06b6d4; border-left: 1px solid #06b6d4; transform: translate(-4px, -4px); }
                .corner-tr { top: 0; right: 0; border-top: 1px solid #06b6d4; border-right: 1px solid #06b6d4; transform: translate(4px, -4px); }
                .corner-bl { bottom: 0; left: 0; border-bottom: 1px solid #06b6d4; border-left: 1px solid #06b6d4; transform: translate(-4px, 4px); }
                .corner-br { bottom: 0; right: 0; border-bottom: 1px solid #06b6d4; border-right: 1px solid #06b6d4; transform: translate(4px, 4px); }

                .lift-card:hover .corner-tick { opacity: 1; }
                .lift-card:hover .corner-tl { transform: translate(8px, 8px); }
                .lift-card:hover .corner-tr { transform: translate(-8px, 8px); }
                .lift-card:hover .corner-bl { transform: translate(8px, -8px); }
                .lift-card:hover .corner-br { transform: translate(-8px, -8px); }
            `}</style>

            {/* Blueprint Background Layer */}
            <div className="absolute inset-0 z-0 pointer-events-none">
                <div
                    className="absolute inset-0 opacity-30"
                    style={{
                        backgroundImage:
                            "linear-gradient(to right, rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.03) 1px, transparent 1px)",
                        backgroundSize: "3rem 3rem",
                    }}
                ></div>
                <div
                    className="absolute inset-0"
                    style={{
                        background:
                            "radial-gradient(circle at center, transparent 10%, #000000 100%)",
                    }}
                ></div>
            </div>

            {/* Content Section */}
            <section
                id="how-it-works"
                className="relative z-10 py-32 flex flex-col items-center justify-center"
            >
                <h2 className="font-['Satoshi_Variable','Satoshi_Variable_Placeholder',sans-serif] font-normal text-[32px] md:text-[40px] text-white mb-16 text-center tracking-tight">
                    How Onyx breaks your API.
                </h2>
                <div className="max-w-7xl w-full mx-auto px-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-px border border-white/10 bg-white/5">
                        {/* CARD 01 */}
                        <div className="bg-[#050505] aspect-square p-8 md:p-12 flex flex-col justify-between hover:bg-white/[0.02] transition-colors lift-card group cursor-pointer">
                            <div className="text-[#06b6d4] text-[14px] tracking-widest font-['JetBrains_Mono']">
                                [01]
                            </div>
                            <div>
                                <h3 className="font-['Satoshi_Variable','Satoshi_Variable_Placeholder',sans-serif] font-normal text-3xl md:text-4xl tracking-tight mb-4 text-white">
                                    Ingest Schema
                                </h3>
                                <p className="font-['Inter',sans-serif] font-normal text-[15px] md:text-[16px] leading-relaxed text-[#A1A1AA]">
                                    Paste your OpenAPI v3 or Swagger URL. The
                                    engine parses every route, parameter, and
                                    request body schema automatically.
                                </p>
                            </div>
                            <div className="sweep-container">
                                <div className="sweep"></div>
                            </div>
                            <div className="corner-tick corner-tl"></div>
                            <div className="corner-tick corner-tr"></div>
                            <div className="corner-tick corner-bl"></div>
                            <div className="corner-tick corner-br"></div>
                        </div>

                        {/* CARD 02 */}
                        <div className="bg-[#050505] aspect-square p-8 md:p-12 flex flex-col justify-between hover:bg-white/[0.02] transition-colors lift-card group cursor-pointer">
                            <div className="text-[#06b6d4] text-[14px] tracking-widest font-['JetBrains_Mono']">
                                [02]
                            </div>
                            <div>
                                <h3 className="font-['Satoshi_Variable','Satoshi_Variable_Placeholder',sans-serif] font-normal text-3xl md:text-4xl tracking-tight mb-4 text-white">
                                    AI Generation
                                </h3>
                                <p className="font-['Inter',sans-serif] font-normal text-[15px] md:text-[16px] leading-relaxed text-[#A1A1AA]">
                                    Gemini 2.5 Flash analyzes your specific
                                    endpoints and engineers dozens of highly
                                    targeted, malicious JSON payloads.
                                </p>
                            </div>
                            <div className="sweep-container">
                                <div className="sweep"></div>
                            </div>
                            <div className="corner-tick corner-tl"></div>
                            <div className="corner-tick corner-tr"></div>
                            <div className="corner-tick corner-bl"></div>
                            <div className="corner-tick corner-br"></div>
                        </div>

                        {/* CARD 03 */}
                        <div className="bg-[#050505] aspect-square p-8 md:p-12 flex flex-col justify-between hover:bg-white/[0.02] transition-colors lift-card group cursor-pointer">
                            <div className="text-[#06b6d4] text-[14px] tracking-widest font-['JetBrains_Mono']">
                                [03]
                            </div>
                            <div>
                                <h3 className="font-['Satoshi_Variable','Satoshi_Variable_Placeholder',sans-serif] font-normal text-3xl md:text-4xl tracking-tight mb-4 text-white">
                                    Queue & Fire
                                </h3>
                                <p className="font-['Inter',sans-serif] font-normal text-[15px] md:text-[16px] leading-relaxed text-[#A1A1AA]">
                                    Payloads are loaded into a BullMQ Redis
                                    queue and fired at the target, streaming
                                    results back via WebSockets.
                                </p>
                            </div>
                            <div className="sweep-container">
                                <div className="sweep"></div>
                            </div>
                            <div className="corner-tick corner-tl"></div>
                            <div className="corner-tick corner-tr"></div>
                            <div className="corner-tick corner-bl"></div>
                            <div className="corner-tick corner-br"></div>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
};

export default Pipeline;

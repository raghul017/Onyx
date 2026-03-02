const Pipeline = () => {
    return (
        <section className="py-24 px-8 w-full border-t border-[#2A2A2A] border-b border-[#1A1A1A]">
            <h2 className="font-['Satoshi_Variable'] font-medium text-[32px] text-white mb-12 text-center tracking-tight">
                How Onyx breaks your API.
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Step 1 */}
                <div className="border-l-2 border-[#2A2A2A] pl-6 hover:border-cyan-400 transition-colors group">
                    <div className="text-neutral-600 font-['JetBrains_Mono'] text-sm mb-2 group-hover:text-cyan-500 transition-colors">
                        01
                    </div>
                    <h3 className="text-white font-['Inter'] text-lg font-medium mb-3">
                        Ingest Schema
                    </h3>
                    <p className="text-[#A1A1AA] font-['Inter'] text-sm leading-relaxed">
                        Drop in your OpenAPI v3 or Swagger URL. The Onyx engine
                        instantly maps your entire routing architecture.
                    </p>
                </div>

                {/* Step 2 */}
                <div className="border-l-2 border-[#2A2A2A] pl-6 hover:border-cyan-400 transition-colors group">
                    <div className="text-neutral-600 font-['JetBrains_Mono'] text-sm mb-2 group-hover:text-cyan-500 transition-colors">
                        02
                    </div>
                    <h3 className="text-white font-['Inter'] text-lg font-medium mb-3">
                        AI Generation
                    </h3>
                    <p className="text-[#A1A1AA] font-['Inter'] text-sm leading-relaxed">
                        Gemini 2.5 Flash analyzes your specific endpoints and
                        engineers dozens of highly targeted, malicious JSON
                        payloads.
                    </p>
                </div>

                {/* Step 3 */}
                <div className="border-l-2 border-[#2A2A2A] pl-6 hover:border-cyan-400 transition-colors group">
                    <div className="text-neutral-600 font-['JetBrains_Mono'] text-sm mb-2 group-hover:text-cyan-500 transition-colors">
                        03
                    </div>
                    <h3 className="text-white font-['Inter'] text-lg font-medium mb-3">
                        Queue & Fire
                    </h3>
                    <p className="text-[#A1A1AA] font-['Inter'] text-sm leading-relaxed">
                        Payloads are loaded into a BullMQ Redis queue and fired
                        at the target, streaming results back via WebSockets.
                    </p>
                </div>
            </div>
        </section>
    );
};

export default Pipeline;

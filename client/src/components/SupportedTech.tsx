import {
    Globe,
    Database,
    Activity,
    Cpu,
    Webhook,
    Code,
    Terminal,
    Zap,
    Plus,
    ArrowRight,
} from "lucide-react";

const SupportedTech = () => {
    return (
        <section className="p-8 lg:p-12 w-full border-t border-[#2A2A2A]">
            <h2 className="font-['Satoshi_Variable'] font-medium text-[32px] text-white mb-8 tracking-tight">
                Supported architectures
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[1px] bg-[#1A1A1A] border border-[#1A1A1A] rounded-xl overflow-hidden shadow-2xl">
                {/* 1. REST API */}
                <div className="bg-[#0c0c0c] p-6 lg:p-7 flex items-center gap-5 hover:bg-[#141414] transition-colors cursor-pointer group">
                    <div className="w-9 h-9 shrink-0 flex items-center justify-center text-cyan-400 group-hover:scale-110 transition-transform">
                        <Globe size={26} strokeWidth={1.5} />
                    </div>
                    <div className="flex flex-col">
                        <span className="font-['Inter'] text-white text-[16px] font-medium leading-tight mb-1">
                            REST API
                        </span>
                        <span className="font-['Inter'] text-[#A1A1AA] text-[14px] leading-tight">
                            OpenAPI v3 / Swagger
                        </span>
                    </div>
                </div>

                {/* 2. GraphQL */}
                <div className="bg-[#0c0c0c] p-6 lg:p-7 flex items-center gap-5 hover:bg-[#141414] transition-colors cursor-pointer group">
                    <div className="w-9 h-9 shrink-0 flex items-center justify-center text-purple-400 group-hover:scale-110 transition-transform">
                        <Database size={26} strokeWidth={1.5} />
                    </div>
                    <div className="flex flex-col">
                        <span className="font-['Inter'] text-white text-[16px] font-medium leading-tight mb-1">
                            GraphQL
                        </span>
                        <span className="font-['Inter'] text-[#A1A1AA] text-[14px] leading-tight">
                            Schema Introspection
                        </span>
                    </div>
                </div>

                {/* 3. WebSockets */}
                <div className="bg-[#0c0c0c] p-6 lg:p-7 flex items-center gap-5 hover:bg-[#141414] transition-colors cursor-pointer group">
                    <div className="w-9 h-9 shrink-0 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform">
                        <Activity size={26} strokeWidth={1.5} />
                    </div>
                    <div className="flex flex-col">
                        <span className="font-['Inter'] text-white text-[16px] font-medium leading-tight mb-1">
                            WebSockets
                        </span>
                        <span className="font-['Inter'] text-[#A1A1AA] text-[14px] leading-tight">
                            WSS Data Streams
                        </span>
                    </div>
                </div>

                {/* 4. gRPC */}
                <div className="bg-[#0c0c0c] p-6 lg:p-7 flex items-center gap-5 hover:bg-[#141414] transition-colors cursor-pointer group">
                    <div className="w-9 h-9 shrink-0 flex items-center justify-center text-orange-400 group-hover:scale-110 transition-transform">
                        <Cpu size={26} strokeWidth={1.5} />
                    </div>
                    <div className="flex flex-col">
                        <span className="font-['Inter'] text-white text-[16px] font-medium leading-tight mb-1">
                            gRPC
                        </span>
                        <span className="font-['Inter'] text-[#A1A1AA] text-[14px] leading-tight">
                            Protobuf Analysis
                        </span>
                    </div>
                </div>

                {/* 5. Webhooks */}
                <div className="bg-[#0c0c0c] p-6 lg:p-7 flex items-center gap-5 hover:bg-[#141414] transition-colors cursor-pointer group">
                    <div className="w-9 h-9 shrink-0 flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform">
                        <Webhook size={26} strokeWidth={1.5} />
                    </div>
                    <div className="flex flex-col">
                        <span className="font-['Inter'] text-white text-[16px] font-medium leading-tight mb-1">
                            Webhooks
                        </span>
                        <span className="font-['Inter'] text-[#A1A1AA] text-[14px] leading-tight">
                            Event Receivers
                        </span>
                    </div>
                </div>

                {/* 6. SOAP */}
                <div className="bg-[#0c0c0c] p-6 lg:p-7 flex items-center gap-5 hover:bg-[#141414] transition-colors cursor-pointer group">
                    <div className="w-9 h-9 shrink-0 flex items-center justify-center text-yellow-400 group-hover:scale-110 transition-transform">
                        <Code size={26} strokeWidth={1.5} />
                    </div>
                    <div className="flex flex-col">
                        <span className="font-['Inter'] text-white text-[16px] font-medium leading-tight mb-1">
                            SOAP
                        </span>
                        <span className="font-['Inter'] text-[#A1A1AA] text-[14px] leading-tight">
                            Legacy XML
                        </span>
                    </div>
                </div>

                {/* 7. JSON-RPC */}
                <div className="bg-[#0c0c0c] p-6 lg:p-7 flex items-center gap-5 hover:bg-[#141414] transition-colors cursor-pointer group">
                    <div className="w-9 h-9 shrink-0 flex items-center justify-center text-pink-400 group-hover:scale-110 transition-transform">
                        <Terminal size={26} strokeWidth={1.5} />
                    </div>
                    <div className="flex flex-col">
                        <span className="font-['Inter'] text-white text-[16px] font-medium leading-tight mb-1">
                            JSON-RPC
                        </span>
                        <span className="font-['Inter'] text-[#A1A1AA] text-[14px] leading-tight">
                            Custom Endpoints
                        </span>
                    </div>
                </div>

                {/* 8. tRPC */}
                <div className="bg-[#0c0c0c] p-6 lg:p-7 flex items-center gap-5 hover:bg-[#141414] transition-colors cursor-pointer group">
                    <div className="w-9 h-9 shrink-0 flex items-center justify-center text-teal-400 group-hover:scale-110 transition-transform">
                        <Zap size={26} strokeWidth={1.5} />
                    </div>
                    <div className="flex flex-col">
                        <span className="font-['Inter'] text-white text-[16px] font-medium leading-tight mb-1">
                            tRPC
                        </span>
                        <span className="font-['Inter'] text-[#A1A1AA] text-[14px] leading-tight">
                            TypeScript Native
                        </span>
                    </div>
                </div>

                {/* 9. CTA Card */}
                <div className="bg-[#0c0c0c] p-6 lg:p-7 flex items-center gap-5 hover:bg-[#141414] transition-colors cursor-pointer group">
                    <div className="w-9 h-9 shrink-0 flex items-center justify-center text-[#22d3ee] group-hover:scale-110 transition-transform">
                        <Plus size={32} strokeWidth={1} />
                    </div>
                    <div className="flex flex-col">
                        <span className="font-['Inter'] text-white text-[16px] font-medium leading-tight mb-1">
                            Your stack can be next
                        </span>
                        <span className="font-['Inter'] text-[#22d3ee] text-[14px] leading-tight flex items-center gap-1 group-hover:underline">
                            Talk to us{" "}
                            <ArrowRight size={14} className="inline-block" />
                        </span>
                    </div>
                </div>
            </div>

            <a
                href="#"
                className="inline-flex items-center gap-1.5 text-[#22d3ee] text-[14px] font-['Inter'] font-medium hover:underline mt-8 transition-colors"
            >
                Explore all specs <ArrowRight size={14} />
            </a>
        </section>
    );
};

export default SupportedTech;

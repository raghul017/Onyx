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
        <section className="px-8 lg:px-12 w-full pt-40 pb-32">
            <h2 className="font-['Satoshi_Variable','Satoshi_Variable_Placeholder',sans-serif] font-normal text-[32px] md:text-[40px] text-[rgb(255,255,255)] mb-8 tracking-tight">
                Supported architectures
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* 1. React */}
                <div className="bg-[#0c0c0c] border border-[#222] rounded-xl p-6 lg:p-7 flex items-center gap-5 hover:border-[#444] hover:bg-[#141414] transition-colors cursor-pointer group">
                    <div className="w-9 h-9 shrink-0 flex items-center justify-center text-[#61DAFB] group-hover:scale-110 transition-transform">
                        <Globe size={26} strokeWidth={1.5} />
                    </div>
                    <div className="flex flex-col">
                        <span className="font-['Inter',sans-serif] font-normal text-[rgb(255,255,255)] text-[18px] leading-tight mb-1">
                            React
                        </span>
                        <span className="font-['Inter',sans-serif] font-normal text-[#888888] text-[15px] leading-tight">
                            Interactive UI
                        </span>
                    </div>
                </div>

                {/* 2. Node.js */}
                <div className="bg-[#0c0c0c] border border-[#222] rounded-xl p-6 lg:p-7 flex items-center gap-5 hover:border-[#444] hover:bg-[#141414] transition-colors cursor-pointer group">
                    <div className="w-9 h-9 shrink-0 flex items-center justify-center text-[#339933] group-hover:scale-110 transition-transform">
                        <Database size={26} strokeWidth={1.5} />
                    </div>
                    <div className="flex flex-col">
                        <span className="font-['Inter',sans-serif] font-normal text-[rgb(255,255,255)] text-[18px] leading-tight mb-1">
                            Node.js
                        </span>
                        <span className="font-['Inter',sans-serif] font-normal text-[#888888] text-[15px] leading-tight">
                            Express Server
                        </span>
                    </div>
                </div>

                {/* 3. BullMQ */}
                <div className="bg-[#0c0c0c] border border-[#222] rounded-xl p-6 lg:p-7 flex items-center gap-5 hover:border-[#444] hover:bg-[#141414] transition-colors cursor-pointer group">
                    <div className="w-9 h-9 shrink-0 flex items-center justify-center text-[#E34C26] group-hover:scale-110 transition-transform">
                        <Activity size={26} strokeWidth={1.5} />
                    </div>
                    <div className="flex flex-col">
                        <span className="font-['Inter',sans-serif] font-normal text-[rgb(255,255,255)] text-[18px] leading-tight mb-1">
                            BullMQ
                        </span>
                        <span className="font-['Inter',sans-serif] font-normal text-[#888888] text-[15px] leading-tight">
                            Job Queues
                        </span>
                    </div>
                </div>

                {/* 4. Gemini AI */}
                <div className="bg-[#0c0c0c] border border-[#222] rounded-xl p-6 lg:p-7 flex items-center gap-5 hover:border-[#444] hover:bg-[#141414] transition-colors cursor-pointer group">
                    <div className="w-9 h-9 shrink-0 flex items-center justify-center text-[#8E75FF] group-hover:scale-110 transition-transform">
                        <Cpu size={26} strokeWidth={1.5} />
                    </div>
                    <div className="flex flex-col">
                        <span className="font-['Inter',sans-serif] font-normal text-[rgb(255,255,255)] text-[18px] leading-tight mb-1">
                            Gemini AI
                        </span>
                        <span className="font-['Inter',sans-serif] font-normal text-[#888888] text-[15px] leading-tight">
                            Payload Engine
                        </span>
                    </div>
                </div>

                {/* 5. WebSockets */}
                <div className="bg-[#0c0c0c] border border-[#222] rounded-xl p-6 lg:p-7 flex items-center gap-5 hover:border-[#444] hover:bg-[#141414] transition-colors cursor-pointer group">
                    <div className="w-9 h-9 shrink-0 flex items-center justify-center text-[#22d3ee] group-hover:scale-110 transition-transform">
                        <Webhook size={26} strokeWidth={1.5} />
                    </div>
                    <div className="flex flex-col">
                        <span className="font-['Inter',sans-serif] font-normal text-[rgb(255,255,255)] text-[18px] leading-tight mb-1">
                            WebSockets
                        </span>
                        <span className="font-['Inter',sans-serif] font-normal text-[#888888] text-[15px] leading-tight">
                            Real-time Streams
                        </span>
                    </div>
                </div>

                {/* 6. Prisma */}
                <div className="bg-[#0c0c0c] border border-[#222] rounded-xl p-6 lg:p-7 flex items-center gap-5 hover:border-[#444] hover:bg-[#141414] transition-colors cursor-pointer group">
                    <div className="w-9 h-9 shrink-0 flex items-center justify-center text-[#2D3748] group-hover:scale-110 transition-transform">
                        <Code size={26} strokeWidth={1.5} />
                    </div>
                    <div className="flex flex-col">
                        <span className="font-['Inter',sans-serif] font-normal text-[rgb(255,255,255)] text-[18px] leading-tight mb-1">
                            Prisma ORM
                        </span>
                        <span className="font-['Inter',sans-serif] font-normal text-[#888888] text-[15px] leading-tight">
                            Modern Database
                        </span>
                    </div>
                </div>

                {/* 7. PostgreSQL */}
                <div className="bg-[#0c0c0c] border border-[#222] rounded-xl p-6 lg:p-7 flex items-center gap-5 hover:border-[#444] hover:bg-[#141414] transition-colors cursor-pointer group">
                    <div className="w-9 h-9 shrink-0 flex items-center justify-center text-[#4169E1] group-hover:scale-110 transition-transform">
                        <Terminal size={26} strokeWidth={1.5} />
                    </div>
                    <div className="flex flex-col">
                        <span className="font-['Inter',sans-serif] font-normal text-[rgb(255,255,255)] text-[18px] leading-tight mb-1">
                            PostgreSQL
                        </span>
                        <span className="font-['Inter',sans-serif] font-normal text-[#888888] text-[15px] leading-tight">
                            Relational Storage
                        </span>
                    </div>
                </div>

                {/* 8. Redis */}
                <div className="bg-[#0c0c0c] border border-[#222] rounded-xl p-6 lg:p-7 flex items-center gap-5 hover:border-[#444] hover:bg-[#141414] transition-colors cursor-pointer group">
                    <div className="w-9 h-9 shrink-0 flex items-center justify-center text-[#DC382D] group-hover:scale-110 transition-transform">
                        <Zap size={26} strokeWidth={1.5} />
                    </div>
                    <div className="flex flex-col">
                        <span className="font-['Inter',sans-serif] font-normal text-[rgb(255,255,255)] text-[18px] leading-tight mb-1">
                            Redis
                        </span>
                        <span className="font-['Inter',sans-serif] font-normal text-[#888888] text-[15px] leading-tight">
                            In-memory Cache
                        </span>
                    </div>
                </div>

                {/* 9. CTA Card */}
                <div className="bg-[#0c0c0c] border border-[#222] rounded-xl p-6 lg:p-7 flex items-center gap-5 hover:border-[#444] hover:bg-[#141414] transition-colors cursor-pointer group">
                    <div className="w-9 h-9 shrink-0 flex items-center justify-center text-[#22d3ee] group-hover:scale-110 transition-transform">
                        <Plus size={32} strokeWidth={1} />
                    </div>
                    <div className="flex flex-col">
                        <span className="font-['Inter',sans-serif] font-normal text-[rgb(255,255,255)] text-[18px] leading-tight mb-1">
                            Your stack can be next
                        </span>
                        <span className="font-['Inter',sans-serif] font-normal text-[#22d3ee] text-[15px] leading-tight flex items-center gap-1 group-hover:underline">
                            Talk to us{" "}
                            <ArrowRight size={14} className="inline-block" />
                        </span>
                    </div>
                </div>
            </div>

            <a
                href="#"
                className="inline-flex items-center gap-1.5 text-[#22d3ee] text-[15px] font-['Inter',sans-serif] font-normal hover:underline mt-8 transition-colors"
            >
                Explore all specs <ArrowRight size={14} />
            </a>
        </section>
    );
};

export default SupportedTech;

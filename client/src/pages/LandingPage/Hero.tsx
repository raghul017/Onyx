import { useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Terminal } from "lucide-react";

const Hero = () => {
    const [targetUrl, setTargetUrl] = useState("");
    const navigate = useNavigate();

    const handleLaunch = () => {
        if (!targetUrl) return;
        navigate("/dashboard", { state: { url: targetUrl } });
    };

    return (
        <section className="relative min-h-screen flex flex-col items-center justify-center pt-32 pb-20 px-6 overflow-hidden">
            {/* Radial gradient background */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(0,255,255,0.02)_0%,rgba(0,0,0,1)_70%)] pointer-events-none" />

            <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className="relative z-10 w-full max-w-5xl flex flex-col items-center text-center space-y-8"
            >
                <h1 className="text-5xl md:text-7xl lg:text-[80px] font-bold tracking-tighter text-white leading-[1.1]">
                    Break Your API.
                    <br />
                    <span className="text-neutral-500">Before They Do.</span>
                </h1>

                <p className="text-lg md:text-xl text-neutral-400 max-w-2xl font-light">
                    The fastest, AI-driven vulnerability testing engine for
                    modern infrastructure.
                </p>

                <div className="w-full max-w-2xl mt-8 flex flex-col sm:flex-row items-center gap-4 bg-[#0A0A0A] p-2 border border-white/10 rounded-none relative">
                    <div className="flex-1 w-full relative group">
                        <Terminal
                            className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500 transition-colors group-focus-within:text-cyan-400 z-10"
                            size={18}
                        />
                        <input
                            type="text"
                            value={targetUrl}
                            onChange={(e) => setTargetUrl(e.target.value)}
                            onKeyDown={(e) =>
                                e.key === "Enter" && handleLaunch()
                            }
                            placeholder="Paste OpenAPI / Swagger URL..."
                            className="w-full bg-transparent pl-12 pr-4 py-4 font-mono text-sm text-white placeholder:text-neutral-600 focus:outline-none transition-all rounded-none"
                        />
                    </div>
                    <button
                        onClick={handleLaunch}
                        className="w-full sm:w-auto bg-white text-black px-8 py-4 font-semibold text-sm hover:bg-neutral-200 transition-colors rounded-none flex items-center justify-center gap-2 whitespace-nowrap"
                    >
                        Initiate Scan &rarr;
                    </button>
                </div>
            </motion.div>

            <motion.div
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1, delay: 0.3, ease: "easeOut" }}
                className="mt-24 w-full max-w-4xl relative z-10"
            >
                <div className="bg-[#0A0A0A] border border-white/10 rounded-none overflow-hidden shadow-2xl">
                    <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10 bg-black/50">
                        <div className="w-3 h-3 rounded-full bg-[#FF5F56]" />
                        <div className="w-3 h-3 rounded-full bg-[#FFBD2E]" />
                        <div className="w-3 h-3 rounded-full bg-[#27C93F]" />
                        <span className="ml-4 text-xs font-mono text-neutral-500">
                            terminal &ndash; onyx
                        </span>
                    </div>
                    <div className="p-6 font-mono text-sm text-neutral-300 min-h-[300px]">
                        <p className="text-neutral-500">
                            user % onyx config init
                        </p>
                        <p className="mt-2 text-cyan-400">
                            &gt; Generating malicious payload schema...
                        </p>
                        <p className="mt-4 break-words">
                            {"{"} <br />
                            &nbsp;&nbsp;"target": "api.production.internal",{" "}
                            <br />
                            &nbsp;&nbsp;"methods": ["SQLi", "XSS", "RateLimit",
                            "Fuzzing"], <br />
                            &nbsp;&nbsp;"intensity": "MAX",
                            <br />
                            &nbsp;&nbsp;"threads": 1000
                            <br />
                            {"}"}
                        </p>
                        <p className="mt-4 text-neutral-500">
                            5.217s, 52.613t/s
                        </p>
                        <p className="mt-2 flex items-center">
                            <span className="text-cyan-400 mr-2">?</span> Ready
                            to launch
                            <span className="animate-pulse ml-1 inline-block w-2 h-4 bg-white/50" />
                        </p>
                    </div>
                </div>
            </motion.div>
        </section>
    );
};

export default Hero;

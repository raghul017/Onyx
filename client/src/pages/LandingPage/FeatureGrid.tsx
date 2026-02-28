import { motion } from "framer-motion";
import { Activity, Zap, ShieldAlert, GitBranch } from "lucide-react";

const features = [
    {
        title: "Automated Payload Generation",
        description:
            "Intelligently crafts edge-case JSON and XML configurations to bypass common validations.",
        icon: <GitBranch className="text-neutral-400 mb-4" size={24} />,
    },
    {
        title: "Zero-Day Emulation",
        description:
            "Simulates the latest known infrastructure exploits before they hit the CVE database.",
        icon: <ShieldAlert className="text-neutral-400 mb-4" size={24} />,
    },
    {
        title: "Sub-millisecond Latency",
        description:
            "Built on a Rust core to fire requests faster than your WAF can rate limit.",
        icon: <Zap className="text-neutral-400 mb-4" size={24} />,
    },
];

const FeatureGrid = () => {
    return (
        <section
            id="features"
            className="py-24 px-6 lg:px-12 max-w-7xl mx-auto"
        >
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.6 }}
                className="space-y-4 mb-16"
            >
                <h2 className="text-3xl md:text-5xl font-bold text-white tracking-tight">
                    Find the break
                    <br />
                    before the breach.
                </h2>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {features.map((feature, idx) => (
                    <motion.div
                        key={idx}
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: "-50px" }}
                        transition={{ duration: 0.5, delay: idx * 0.1 }}
                        className="bg-[#0A0A0A] border border-white/5 p-8 flex flex-col hover:border-white/10 transition-colors"
                    >
                        {feature.icon}
                        <h3 className="text-white font-medium text-lg mb-2">
                            {feature.title}
                        </h3>
                        <p className="text-neutral-400 text-sm font-light leading-relaxed">
                            {feature.description}
                        </p>
                    </motion.div>
                ))}

                {/* Wide Benchmark Card */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-50px" }}
                    transition={{ duration: 0.5, delay: 0.3 }}
                    className="md:col-span-3 bg-[#0A0A0A] border border-white/5 p-8 flex flex-col lg:flex-row gap-12 items-center hover:border-white/10 transition-colors"
                >
                    <div className="flex-1 space-y-4">
                        <Activity className="text-neutral-400 mb-2" size={24} />
                        <h3 className="text-white font-medium text-xl">
                            Benchmark.
                        </h3>
                        <p className="text-neutral-400 text-sm font-light">
                            Onyx throughput compared to traditional testing
                            suites. We don't just find bugs, we overwhelm them.
                        </p>
                    </div>

                    <div className="flex-1 w-full space-y-6 font-mono text-xs">
                        <div>
                            <div className="flex justify-between text-neutral-500 mb-2">
                                <span>Onyx (Havoc-3)</span>
                                <span className="text-cyan-400">
                                    124k req/s
                                </span>
                            </div>
                            <div className="w-full bg-black h-2 overflow-hidden">
                                <motion.div
                                    initial={{ width: 0 }}
                                    whileInView={{ width: "95%" }}
                                    viewport={{ once: true }}
                                    transition={{
                                        duration: 1.5,
                                        ease: "easeOut",
                                    }}
                                    className="h-full bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.5)]"
                                />
                            </div>
                        </div>
                        <div>
                            <div className="flex justify-between text-neutral-500 mb-2">
                                <span>Traditional Runner</span>
                                <span>12k req/s</span>
                            </div>
                            <div className="w-full bg-black h-2 overflow-hidden">
                                <motion.div
                                    initial={{ width: 0 }}
                                    whileInView={{ width: "15%" }}
                                    viewport={{ once: true }}
                                    transition={{
                                        duration: 1.5,
                                        ease: "easeOut",
                                    }}
                                    className="h-full bg-neutral-600"
                                />
                            </div>
                        </div>
                    </div>
                </motion.div>
            </div>
        </section>
    );
};

export default FeatureGrid;

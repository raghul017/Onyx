import { motion } from "framer-motion";

const Architectures = [
    { name: "REST API", status: "Supported" },
    { name: "GraphQL", status: "Supported" },
    { name: "WebSockets", status: "Supported" },
    { name: "gRPC", status: "Beta" },
    { name: "tRPC", status: "Supported" },
    { name: "SOAP", status: "Legacy" },
];

const TechStack = () => {
    return (
        <section
            id="architecture"
            className="py-24 px-6 lg:px-12 max-w-7xl mx-auto border-t border-white/5"
        >
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.6 }}
                className="mb-12"
            >
                <h2 className="text-2xl md:text-4xl font-bold text-white tracking-tight mb-4">
                    Supported Architectures
                </h2>
                <p className="text-neutral-400 font-light">
                    Out-of-the-box support for the most common protocols.
                </p>
            </motion.div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {Architectures.map((arch, idx) => (
                    <motion.div
                        key={arch.name}
                        initial={{ opacity: 0, y: 15 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: "-50px" }}
                        transition={{ duration: 0.4, delay: idx * 0.05 }}
                        className="bg-[#0A0A0A] border border-white/5 p-6 flex flex-col justify-between h-32 hover:border-white/10 transition-colors group cursor-default"
                    >
                        <div className="flex justify-between items-start w-full">
                            <span className="text-white font-medium group-hover:text-cyan-400 transition-colors">
                                {arch.name}
                            </span>
                            <span
                                className={`text-[10px] uppercase font-mono px-2 py-0.5 border ${
                                    arch.status === "Supported"
                                        ? "border-green-500/30 text-green-500 bg-green-500/10"
                                        : arch.status === "Beta"
                                          ? "border-yellow-500/30 text-yellow-500 bg-yellow-500/10"
                                          : "border-neutral-500/30 text-neutral-500 bg-neutral-500/10"
                                }`}
                            >
                                {arch.status}
                            </span>
                        </div>
                    </motion.div>
                ))}
            </div>
        </section>
    );
};

export default TechStack;

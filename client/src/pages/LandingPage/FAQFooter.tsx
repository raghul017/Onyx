import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Shield } from "lucide-react";

const faqs = [
    {
        q: "How does Onyx bypass WAFs?",
        a: "We don't bypass them; we train them. By utilizing highly metamorphic payload generators that execute under strict rate limits, Onyx analyzes the exact heuristics of your firewall dynamically.",
    },
    {
        q: "Is it safe to run in production?",
        a: "Onyx allows you to define strict 'Blast Radios' inside the terminal interface. We recommend testing on staging environments first, but safe-mode runs can be executed safely on live instances.",
    },
    {
        q: "What protocols are supported?",
        a: "REST, GraphQL, and WebSockets represent our primary focus. We are also rolling out gRPC and raw socket testing plugins next quarter.",
    },
];

const FAQFooter = () => {
    const [openIndex, setOpenIndex] = useState<number | null>(null);

    return (
        <>
            <section className="py-24 px-6 lg:px-12 max-w-3xl mx-auto border-t border-white/5 mb-24">
                <h2 className="text-2xl font-bold text-white mb-8">
                    Frequently Asked.
                </h2>
                <div className="space-y-4">
                    {faqs.map((faq, idx) => (
                        <div key={idx} className="border-b border-white/10">
                            <button
                                onClick={() =>
                                    setOpenIndex(openIndex === idx ? null : idx)
                                }
                                className="w-full flex items-center justify-between py-4 text-left focus:outline-none"
                            >
                                <span
                                    className={`font-medium transition-colors ${openIndex === idx ? "text-white" : "text-neutral-400 hover:text-neutral-200"}`}
                                >
                                    {faq.q}
                                </span>
                                <ChevronDown
                                    size={16}
                                    className={`text-neutral-500 transition-transform duration-300 ${openIndex === idx ? "rotate-180" : ""}`}
                                />
                            </button>
                            <AnimatePresence>
                                {openIndex === idx && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: "auto", opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{
                                            duration: 0.3,
                                            ease: "easeInOut",
                                        }}
                                        className="overflow-hidden"
                                    >
                                        <p className="pb-6 text-neutral-500 font-light text-sm leading-relaxed">
                                            {faq.a}
                                        </p>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    ))}
                </div>
            </section>

            <footer className="w-full border-t border-white/10 bg-black py-12 px-6 lg:px-12">
                <div className="max-w-7xl mx-auto grid grid-cols-2 lg:grid-cols-4 gap-8">
                    <div className="col-span-2 lg:col-span-1 flex flex-col items-start gap-4">
                        <div className="flex items-center gap-2">
                            <Shield className="text-white" size={20} />
                            <span className="text-white font-semibold">
                                Onyx
                            </span>
                        </div>
                        <p className="text-neutral-500 text-xs font-mono">
                            Break your API.
                            <br />
                            Before they do. &copy; {new Date().getFullYear()}
                        </p>
                    </div>

                    <div className="flex flex-col gap-3">
                        <span className="text-white text-sm font-medium mb-2">
                            Product
                        </span>
                        <a
                            href="#"
                            className="text-neutral-500 text-sm hover:text-white transition-colors"
                        >
                            Features
                        </a>
                        <a
                            href="#"
                            className="text-neutral-500 text-sm hover:text-white transition-colors"
                        >
                            Pricing
                        </a>
                        <a
                            href="#"
                            className="text-neutral-500 text-sm hover:text-white transition-colors"
                        >
                            Changelog
                        </a>
                    </div>

                    <div className="flex flex-col gap-3">
                        <span className="text-white text-sm font-medium mb-2">
                            Company
                        </span>
                        <a
                            href="#"
                            className="text-neutral-500 text-sm hover:text-white transition-colors"
                        >
                            About
                        </a>
                        <a
                            href="#"
                            className="text-neutral-500 text-sm hover:text-white transition-colors"
                        >
                            Blog
                        </a>
                        <a
                            href="#"
                            className="text-neutral-500 text-sm hover:text-white transition-colors"
                        >
                            Careers
                        </a>
                    </div>

                    <div className="flex flex-col gap-3">
                        <span className="text-white text-sm font-medium mb-2">
                            Legal
                        </span>
                        <a
                            href="#"
                            className="text-neutral-500 text-sm hover:text-white transition-colors"
                        >
                            Privacy
                        </a>
                        <a
                            href="#"
                            className="text-neutral-500 text-sm hover:text-white transition-colors"
                        >
                            Terms
                        </a>
                    </div>
                </div>
            </footer>
        </>
    );
};

export default FAQFooter;

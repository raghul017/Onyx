import { motion } from "framer-motion";
import { Player } from "@lottiefiles/react-lottie-player";

const features = [
    {
        title: "AI Payload Generation",
        description:
            "Gemini 2.5 Flash analyzes your API schema and crafts targeted attack payloads — SQL injection, XSS, type confusion, and auth bypass vectors.",
        component: (
            <Player
                src="/lottie/scanning.json"
                loop
                autoplay
                background="transparent"
                style={{ height: "100%", width: "100%" }}
            />
        ),
        span: "lg:col-span-2",
        height: "h-64",
    },
    {
        title: "Live Attack Stream",
        description:
            "Watch attacks execute in real-time through a WebSocket-powered live feed. Every payload streams instantly to your dashboard.",
        component: (
            <Player
                src="/lottie/meter.json"
                loop
                autoplay
                background="transparent"
                style={{
                    height: "100%",
                    width: "100%",
                    transform: "scale(1.2)",
                }}
            />
        ),
        span: "lg:col-span-1",
        height: "h-64",
    },
    {
        title: "Real-Time Dashboard",
        description:
            "A command center for your test runs. Track critical failures and drill into individual endpoint results — all updating live.",
        component: (
            <Player
                src="/lottie/analytics.json"
                loop
                autoplay
                background="transparent"
                style={{
                    height: "100%",
                    width: "100%",
                    transform: "scale(1.2)",
                }}
            />
        ),
        span: "md:col-span-1 lg:col-span-1",
        height: "h-[300px]",
    },
    {
        title: "Deep Vulnerability Detection",
        description:
            "Pinpoint exact query parameters, headers, and request bodies that trigger sensitive data leaks or crashes.",
        component: (
            <Player
                src="/lottie/search.json"
                loop
                autoplay
                background="transparent"
                style={{
                    height: "100%",
                    width: "100%",
                    transform: "scale(1.2)",
                }}
            />
        ),
        span: "md:col-span-1 lg:col-span-1",
        height: "h-[300px]",
    },
    {
        title: "Detailed Reporting",
        description:
            "Export comprehensive PDF/JSON reports with severity classification, response snippets, and remediation steps.",
        component: (
            <Player
                src="/lottie/reporting.json"
                loop
                autoplay
                background="transparent"
                style={{
                    height: "100%",
                    width: "100%",
                    transform: "scale(1.2)",
                }}
            />
        ),
        span: "md:col-span-1 lg:col-span-1",
        height: "h-[300px]",
    },
];

const container = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.1 } },
};

const item = {
    hidden: { opacity: 0, y: 30 },
    visible: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.5 },
    },
};

const FeatureShowcase = () => {
    return (
        <section id="features" className="w-full py-16 sm:py-20 lg:py-24 px-5 sm:px-8 lg:px-12 relative">
            <div className="max-w-[1280px] mx-auto">
                {/* Section Header */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-100px" }}
                    transition={{ duration: 0.5 }}
                    className="mb-10 sm:mb-12 flex flex-col items-start text-left"
                >
                    <div className="flex items-center gap-3 mb-5 sm:mb-6">
                        <div className="flex items-center justify-center w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-white text-black text-[11px] sm:text-[12px] font-semibold">
                            03
                        </div>
                        <span className="text-[12px] sm:text-[13px] font-medium text-white/80 border border-[#2A2A2A] rounded-full px-3 sm:px-4 py-1 sm:py-1.5">
                            Features
                        </span>
                    </div>

                    <h2
                        className="text-white max-w-2xl"
                        style={{
                            fontFamily: '"Satoshi Variable", sans-serif',
                            fontWeight: 400,
                            fontSize: "clamp(1.875rem, 4vw, 2.75rem)",
                            lineHeight: 1.1,
                            letterSpacing: "-0.03em",
                        }}
                    >
                        Everything you need to stress-test your API.
                    </h2>
                    <p className="font-['Inter'] text-[16px] sm:text-[17px] leading-[1.6] text-[#ADADAD] mt-4 max-w-xl">
                        From schema parsing to vulnerability detection — all
                        automated, all real-time.
                    </p>
                </motion.div>

                {/* Bento Grid */}
                <motion.div
                    variants={container}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, margin: "-80px" }}
                    className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
                >
                {features.map((feature, idx) => (
                    <motion.div
                        key={idx}
                        variants={item}
                        className={`${feature.span} group bg-[#0A0A0A] border border-[#1A1A1A] rounded-2xl flex flex-col hover:border-[#333] transition-colors duration-300 relative overflow-hidden`}
                    >
                        {/* Hover glow */}
                        <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/[0.04] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

                        {/* Native Motion Animation Container */}
                        <div
                            className={`w-full ${feature.height} bg-[#0A0A0A] relative border-b border-[#1A1A1A] overflow-hidden`}
                        >
                            {feature.component}
                        </div>

                        <div className="p-6 sm:p-7 relative z-10 text-left">
                            <h3 className="font-['Inter'] text-white text-[19px] sm:text-xl font-medium mb-2.5 tracking-tight leading-snug">
                                {feature.title}
                            </h3>
                            <p className="font-['Inter'] text-[#A1A1AA] text-[15px] leading-[1.6]">
                                {feature.description}
                            </p>
                        </div>
                    </motion.div>
                ))}
                </motion.div>
            </div>
        </section>
    );
};

export default FeatureShowcase;

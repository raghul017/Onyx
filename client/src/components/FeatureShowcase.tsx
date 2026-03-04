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
        span: "md:col-span-1 lg:col-span-2",
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
        span: "md:col-span-1",
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
        <section id="features" className="w-full pt-24 pb-32 px-8 relative">
            {/* Section Header */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.5 }}
                className="mb-12"
            >
                <div className="flex items-center gap-6 mb-8">
                    <div className="h-px flex-1 bg-white/10" />
                    <span className="uppercase text-xs tracking-widest text-neutral-500 font-['Inter']">
                        Features
                    </span>
                    <div className="h-px flex-1 bg-white/10" />
                </div>

                <h2
                    className="max-w-2xl text-white"
                    style={{
                        fontFamily: '"Satoshi Variable", sans-serif',
                        fontWeight: 400,
                        fontSize: "40px",
                        lineHeight: "56px",
                    }}
                >
                    Everything you need to stress-test your API.
                </h2>
                <p className="font-['Inter'] text-[17px] leading-[29px] text-[#ADADAD] mt-3 max-w-xl">
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
                        className={`${feature.span} group bg-[#0A0A0A] border border-[#1A1A1A] rounded-xl flex flex-col hover:border-[#333] transition-all duration-300 relative overflow-hidden`}
                    >
                        {/* Hover glow */}
                        <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

                        {/* Native Motion Animation Container */}
                        <div
                            className={`w-full ${feature.height} bg-[#0A0A0A] relative border-b border-[#1A1A1A] overflow-hidden`}
                        >
                            {feature.component}
                        </div>

                        <div className="p-6 relative z-10">
                            <h3 className="font-['Inter'] text-white text-xl font-medium mb-3 tracking-tight">
                                {feature.title}
                            </h3>
                            <p className="font-['Inter'] text-[#A1A1AA] text-[15px] leading-relaxed">
                                {feature.description}
                            </p>
                        </div>
                    </motion.div>
                ))}
            </motion.div>
        </section>
    );
};

export default FeatureShowcase;

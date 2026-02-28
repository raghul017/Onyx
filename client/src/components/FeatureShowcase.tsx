import { useState } from "react";
import {
    Activity,
    Zap,
    BarChart2,
    FileText,
    ChevronDown,
    ChevronUp,
    Check,
} from "lucide-react";

const FeatureShowcase = () => {
    const [activeIndex, setActiveIndex] = useState(0);

    const features = [
        {
            title: "Generate.",
            icon: <Activity size={24} strokeWidth={1.5} />,
            body: "Use LLMs to automatically generate thousands of edge-case payloads.",
            checks: [
                "Zero-config schema parsing.",
                "Deep vulnerability generation.",
                "Support for REST and GraphQL.",
            ],
        },
        {
            title: "Attack.",
            icon: <Zap size={24} strokeWidth={1.5} />,
            body: "High-concurrency assault engines designed to break rate limits and discover unhandled exceptions.",
            checks: [
                "Unlimited concurrent requests.",
                "Intelligent request throttling.",
                "Payload mutation rendering.",
            ],
        },
        {
            title: "Analyze.",
            icon: <BarChart2 size={24} strokeWidth={1.5} />,
            body: "Real-time parsing of structural anomalies across deep JSON trees.",
            checks: [
                "Diff-based anomaly detection.",
                "Automatic stack trace parsing.",
                "Intelligent severity scoring.",
            ],
        },
        {
            title: "Report.",
            icon: <FileText size={24} strokeWidth={1.5} />,
            body: "Generate compliance-ready PDF and JSON exports of discovered attack vectors.",
            checks: [
                "One-click PDF generation.",
                "Developer-friendly JSON schemas.",
                "Historical trending analysis.",
            ],
        },
    ];

    return (
        <section className="w-full mt-32 mb-24 relative">
            <h2
                className="mb-12 max-w-2xl text-white px-8 lg:px-16"
                style={{
                    fontFamily:
                        '"Satoshi Variable", "Satoshi Variable Placeholder", sans-serif',
                    fontWeight: 400,
                    fontSize: "40px",
                    lineHeight: "56px",
                }}
            >
                Generate, attack, analyze &amp; report on your APIs.
            </h2>

            <div className="grid grid-cols-1 lg:grid-cols-2 border-y border-[#2A2A2A] bg-[#0A0A0A] w-full lg:h-[750px] relative">
                {/* Intersection Nodes (matching Hero section) */}
                <div className="absolute top-[-2px] left-[-2px] w-[3px] h-[3px] bg-[#444444] z-10 hidden lg:block" />
                <div className="absolute top-[-2px] right-[-2px] w-[3px] h-[3px] bg-[#444444] z-10 hidden lg:block" />
                <div className="absolute bottom-[-2px] left-[-2px] w-[3px] h-[3px] bg-[#444444] z-10 hidden lg:block" />
                <div className="absolute bottom-[-2px] right-[-2px] w-[3px] h-[3px] bg-[#444444] z-10 hidden lg:block" />

                {/* Left Column: Terminal Asset Image Background */}
                <div
                    className="bg-cover bg-center p-8 md:p-12 lg:p-16 flex items-center justify-center min-h-[500px] lg:min-h-full border-b lg:border-b-0 lg:border-r border-[#2A2A2A]"
                    style={{ backgroundImage: "url('/hero-bg.png')" }}
                >
                    <div className="w-full max-w-[500px] bg-[#0A0A0A]/90 backdrop-blur-xl rounded-[10px] border border-[#333] shadow-2xl shadow-black/50 flex flex-col overflow-hidden">
                        {/* Terminal Header */}
                        <div className="h-10 flex items-center px-4 shrink-0 relative bg-[#0A0A0A]">
                            <div className="flex gap-2 absolute left-4">
                                <div className="w-3 h-3 rounded-full bg-[#FF5F57]" />
                                <div className="w-3 h-3 rounded-full bg-[#FEBC2E]" />
                                <div className="w-3 h-3 rounded-full bg-[#28C840]" />
                            </div>
                            <div
                                className="w-full text-center text-[#666666] text-xs"
                                style={{
                                    fontFamily: '"JetBrains Mono", monospace',
                                }}
                            >
                                terminal — onyx
                            </div>
                        </div>

                        {/* Terminal Body */}
                        <div
                            className="p-6 md:p-8 flex flex-col gap-4 overflow-hidden bg-[#0A0A0A]/80"
                            style={{
                                fontFamily:
                                    '"JetBrains Mono", "SF Mono", "Fira Code", "Cascadia Code", monospace',
                                fontSize: "14px",
                                lineHeight: "24px",
                                color: "rgb(230, 237, 243)",
                                fontWeight: 400,
                            }}
                        >
                            <div className="flex">
                                <span className="opacity-70 mr-3">user %</span>
                                <span>onyx run target-api --intensity=max</span>
                            </div>
                            <div className="opacity-70">
                                Loaded: OpenAPI Schema (45 endpoints)
                            </div>

                            <div className="flex mt-2 gap-3">
                                <span className="text-[#32D5C6]">{">"}</span>
                                <span className="text-[#32D5C6]">
                                    Generating synthetic payloads via Gemini...
                                </span>
                            </div>
                            <div className="opacity-70">
                                1.24s, 50 payloads generated
                            </div>

                            <div className="flex mt-2 gap-3">
                                <span className="text-[#32D5C6]">{">"}</span>
                                <span className="text-[#32D5C6]">
                                    Initiating chaos sequence...
                                </span>
                            </div>

                            <div className="text-red-400 mt-1">
                                [POST] /auth/login - 500 Internal Server Error
                            </div>
                            <div className="opacity-70">
                                [GET] /users/me - 200 OK
                            </div>
                            <div className="opacity-70">
                                [GET] /products?limit=1000 - 200 OK
                            </div>
                            <div className="text-red-400">
                                [PUT] /admin/settings - 401 Unauthorized (Bypass
                                Detected)
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Column: Interactive Accordion */}
                <div className="flex flex-col flex-1 justify-start p-8 md:p-12 lg:p-16 bg-[#111111] overflow-y-auto w-full max-h-full">
                    {features.map((feature, index) => {
                        const isActive = activeIndex === index;

                        return (
                            <div
                                key={index}
                                className={`${index !== features.length - 1 ? "border-b border-[#2A2A2A]" : ""} overflow-hidden transition-all duration-300`}
                            >
                                <button
                                    onClick={() => setActiveIndex(index)}
                                    className="w-full py-6 flex items-center justify-between text-left group cursor-pointer"
                                >
                                    <div
                                        className={`flex items-center gap-4 transition-colors ${isActive ? "text-white" : "text-[rgb(173,173,173)] group-hover:text-white"}`}
                                    >
                                        <div
                                            className={
                                                isActive
                                                    ? "text-white"
                                                    : "text-[rgb(173,173,173)]"
                                            }
                                        >
                                            {feature.icon}
                                        </div>
                                        <span
                                            style={{
                                                fontFamily:
                                                    '"Inter Variable", "Inter Variable Placeholder", sans-serif',
                                                fontSize: "22px",
                                                fontWeight: 400,
                                            }}
                                        >
                                            {feature.title}
                                        </span>
                                    </div>
                                    <div
                                        className={
                                            isActive
                                                ? "text-white"
                                                : "text-[rgb(173,173,173)]"
                                        }
                                    >
                                        {isActive ? (
                                            <ChevronUp size={20} />
                                        ) : (
                                            <ChevronDown size={20} />
                                        )}
                                    </div>
                                </button>

                                {/* Expandable Body content */}
                                <div
                                    className={`transition-all duration-300 ease-in-out ${isActive ? "max-h-[500px] opacity-100 pb-8" : "max-h-0 opacity-0 pb-0"}`}
                                >
                                    <div
                                        style={{
                                            fontFamily:
                                                '"Inter Variable", "Inter Variable Placeholder", sans-serif',
                                            fontWeight: 400,
                                            color: "rgb(173, 173, 173)",
                                            fontSize: "17px",
                                            lineHeight: "29px",
                                        }}
                                    >
                                        <p className="mb-6">{feature.body}</p>
                                        <ul className="flex flex-col gap-5">
                                            {feature.checks.map(
                                                (check, cIndex) => (
                                                    <li
                                                        key={cIndex}
                                                        className="flex items-start gap-4"
                                                    >
                                                        <Check
                                                            size={18}
                                                            strokeWidth={2}
                                                            className="text-white mt-[5px] shrink-0"
                                                        />
                                                        <span>{check}</span>
                                                    </li>
                                                ),
                                            )}
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </section>
    );
};

export default FeatureShowcase;

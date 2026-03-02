import React from "react";

const AdvancedFeatures = () => {
    return (
        <section
            className="animate-entry delay-200 [animation:animationIn_0.8s_ease-out_0.1s_both] animate-on-scroll animate lg:mx-auto max-w-7xl mt-24 mr-auto mb-24 ml-auto pt-10 pr-10 pb-10 pl-10 relative"
            style={
                {
                    position: "relative",
                    "--border-gradient":
                        "linear-gradient(135deg, rgba(255, 255, 255, 0.2), rgba(255, 255, 255, 0), rgba(255, 255, 255, 0.1))",
                    "--border-radius-before": "24px",
                } as React.CSSProperties
            }
        >
            <div className="flex flex-col rounded-none mt-0 mb-0 pt-0 pr-0 pb-0 pl-0 relative">
                {/* Header Section */}
                <div className="flex flex-col gap-10 w-full gap-x-10 gap-y-10">
                    <div className="flex items-center gap-6">
                        <div className="h-px flex-1 bg-white/10"></div>
                        <span className="uppercase text-xs tracking-widest text-neutral-500 font-['Inter']">
                            Why Onyx
                        </span>
                    </div>

                    <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-10 gap-x-10 gap-y-10">
                        <div className="max-w-3xl flex flex-col gap-6">
                            <h2 className="font-['Satoshi_Variable','Satoshi_Variable_Placeholder',sans-serif] font-normal text-[40px] leading-[56px] text-[rgb(255,255,255)] tracking-tight">
                                Attacks you can see.
                                <span className="block text-[#ADADAD] font-['Satoshi_Variable','Satoshi_Variable_Placeholder',sans-serif] font-normal tracking-tight">
                                    Vulnerabilities you can patch.
                                </span>
                            </h2>

                            <p className="font-['Inter_Variable','Inter_Variable_Placeholder',sans-serif] font-normal text-[17px] leading-[29px] text-[rgb(173,173,173)] max-w-xl">
                                A modern dynamic testing infrastructure designed
                                for deep API inspection, clarity, and zero-day
                                prevention.
                            </p>
                        </div>

                        <button className="group flex items-center gap-2 px-6 py-3 border border-[#2A2A2A] text-white text-sm font-medium rounded-full hover:bg-white/5 transition font-['Inter'] whitespace-nowrap">
                            <span className="font-['Inter']">
                                Explore Features
                            </span>
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="w-4 h-4 transition-transform group-hover:translate-x-1"
                            >
                                <path d="M5 12h14" />
                                <path d="m12 5 7 7-7 7" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Features Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 w-full mt-8 gap-x-6 gap-y-6">
                    {/* Card 1: AI Payload Generation */}
                    <div className="group flex flex-col overflow-hidden hover:border-cyan-500/30 transition-all duration-500 md:col-span-1 bg-[#0A0A0A] border-[#1A1A1A] border rounded-md pt-8 pr-8 pb-8 pl-8 relative justify-between">
                        <style>{`
              @keyframes orbit-slow {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
              }
              @keyframes breathe-glow {
                0%, 100% { transform: scale(1); box-shadow: 0 0 20px rgba(59, 130, 246, 0.1); }
                50% { transform: scale(1.05); box-shadow: 0 0 35px rgba(59, 130, 246, 0.3); }
              }
              @keyframes ripple-expand {
                0% { transform: scale(0.8); opacity: 0.6; border-width: 1px; }
                100% { transform: scale(2.5); opacity: 0; border-width: 0px; }
              }
              @keyframes dot-handoff {
                0%, 100% { opacity: 0.3; r: 2px; fill: #22d3ee; }
                50% { opacity: 1; r: 3.5px; fill: #06b6d4; }
              }
            `}</style>

                        <div className="relative h-48 w-full flex items-center justify-center mb-6 overflow-visible">
                            <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/5 to-transparent opacity-50 rounded-full blur-3xl transform scale-75"></div>
                            <div
                                className="absolute w-16 h-16 rounded-full border border-cyan-400/30 z-0"
                                style={{
                                    animation:
                                        "ripple-expand 4s cubic-bezier(0, 0, 0.2, 1) infinite",
                                }}
                            ></div>

                            <svg
                                className="w-full h-full text-cyan-500/20 z-10"
                                viewBox="0 0 200 200"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                            >
                                <g
                                    style={{
                                        transformOrigin: "100px 100px",
                                        animation:
                                            "orbit-slow 12s linear infinite",
                                    }}
                                >
                                    <circle
                                        cx="100"
                                        cy="100"
                                        r="80"
                                        stroke="currentColor"
                                        strokeWidth="1"
                                        strokeDasharray="6 6"
                                        className="opacity-30"
                                    />
                                    <circle
                                        cx="100"
                                        cy="20"
                                        r="3"
                                        fill="#22d3ee"
                                        className="drop-shadow-[0_0_8px_rgba(96,165,250,0.8)]"
                                    />
                                    <circle
                                        cx="180"
                                        cy="100"
                                        r="2.5"
                                        fill="#06b6d4"
                                        className="opacity-60"
                                    />
                                    <circle
                                        cx="20"
                                        cy="100"
                                        r="2.5"
                                        fill="#06b6d4"
                                        className="opacity-60"
                                    />
                                </g>

                                <circle
                                    cx="100"
                                    cy="100"
                                    r="50"
                                    stroke="currentColor"
                                    strokeWidth="1"
                                    className="opacity-40"
                                />

                                <circle
                                    cx="100"
                                    cy="50"
                                    r="2"
                                    fill="#06b6d4"
                                    style={{
                                        animation:
                                            "dot-handoff 3s ease-in-out infinite",
                                        animationDelay: "0s",
                                    }}
                                />
                                <circle
                                    cx="150"
                                    cy="100"
                                    r="2"
                                    fill="#06b6d4"
                                    style={{
                                        animation:
                                            "dot-handoff 3s ease-in-out infinite",
                                        animationDelay: "1s",
                                    }}
                                />
                                <circle
                                    cx="100"
                                    cy="150"
                                    r="2"
                                    fill="#06b6d4"
                                    style={{
                                        animation:
                                            "dot-handoff 3s ease-in-out infinite",
                                        animationDelay: "2s",
                                    }}
                                />
                                <circle
                                    cx="50"
                                    cy="100"
                                    r="2"
                                    fill="#06b6d4"
                                    style={{
                                        animation:
                                            "dot-handoff 3s ease-in-out infinite",
                                        animationDelay: "3s",
                                    }}
                                />
                            </svg>

                            <div
                                className="absolute flex items-center justify-center w-16 h-16 bg-[#15151A] rounded-full border border-[#1A1A1A] z-20"
                                style={{
                                    animation:
                                        "breathe-glow 4s ease-in-out infinite",
                                }}
                            >
                                <div className="absolute inset-0 bg-cyan-500/10 rounded-full blur-sm"></div>
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    width="28"
                                    height="28"
                                    viewBox="0 0 24 24"
                                    fill="currentColor"
                                    stroke="none"
                                    className="text-gray-100 relative z-10"
                                >
                                    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                                    <circle cx="12" cy="7" r="4" />
                                </svg>
                            </div>
                        </div>

                        <div className="relative z-10">
                            <h3 className="font-['Satoshi_Variable','Satoshi_Variable_Placeholder',sans-serif] font-normal text-[40px] leading-[56px] text-[rgb(255,255,255)] text-left tracking-tight">
                                AI Payload Generation
                            </h3>
                            <p className="font-['Inter_Variable','Inter_Variable_Placeholder',sans-serif] font-normal text-[17px] leading-[29px] text-[rgb(173,173,173)] text-left mt-2">
                                Eliminate manual testing with intelligent,
                                LLM-driven edge-case generation.
                            </p>
                        </div>
                    </div>

                    {/* Card 2: Live Attack Telemetry */}
                    <div className="md:col-span-2 group flex flex-col overflow-hidden hover:border-cyan-500/30 transition-all duration-500 bg-[#0A0A0A] border-[#1A1A1A] border rounded-md px-8 py-8 relative justify-between">
                        <style>{`
              @keyframes flowData {
                0% { stroke-dashoffset: 120; opacity: 0; }
                15% { opacity: 1; }
                85% { opacity: 1; }
                100% { stroke-dashoffset: 0; opacity: 0; }
              }
              @keyframes breatheDiamond {
                0%, 100% { transform: rotate(45deg) scale(1); box-shadow: 0 0 30px rgba(59,130,246,0.3); border-color: rgba(59,130,246,0.3); }
                50% { transform: rotate(45deg) scale(1.05); box-shadow: 0 0 50px rgba(59,130,246,0.5); border-color: rgba(59,130,246,0.6); }
              }
              @keyframes orbitSpin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
            `}</style>

                        <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-cyan-600/20 blur-[100px] rounded-full -translate-y-1/2 translate-x-1/2 group-hover:bg-cyan-500/30 transition-colors duration-700"></div>

                        <div className="relative h-48 w-full flex items-center justify-center mb-6 overflow-visible">
                            <svg
                                className="absolute top-0 right-0 bottom-0 left-0 w-full h-full"
                                viewBox="0 0 400 200"
                                fill="none"
                                preserveAspectRatio="xMidYMid meet"
                            >
                                <defs>
                                    <linearGradient
                                        id="flowGradientLeft"
                                        x1="0%"
                                        y1="0%"
                                        x2="100%"
                                        y2="0%"
                                    >
                                        <stop
                                            offset="0%"
                                            stopColor="#06b6d4"
                                            stopOpacity="0"
                                        />
                                        <stop
                                            offset="50%"
                                            stopColor="#22d3ee"
                                            stopOpacity="1"
                                        />
                                        <stop
                                            offset="100%"
                                            stopColor="#06b6d4"
                                            stopOpacity="0"
                                        />
                                    </linearGradient>
                                    <linearGradient
                                        id="flowGradientRight"
                                        x1="100%"
                                        y1="0%"
                                        x2="0%"
                                        y2="0%"
                                    >
                                        <stop
                                            offset="0%"
                                            stopColor="#06b6d4"
                                            stopOpacity="0"
                                        />
                                        <stop
                                            offset="50%"
                                            stopColor="#22d3ee"
                                            stopOpacity="1"
                                        />
                                        <stop
                                            offset="100%"
                                            stopColor="#06b6d4"
                                            stopOpacity="0"
                                        />
                                    </linearGradient>
                                </defs>

                                <path
                                    d="M50 100 L120 100 L150 70"
                                    stroke="currentColor"
                                    strokeWidth="1"
                                    className="text-white/10"
                                />
                                <path
                                    d="M350 100 L280 100 L250 130"
                                    stroke="currentColor"
                                    strokeWidth="1"
                                    className="text-white/10"
                                />

                                <path
                                    d="M50 100 L120 100 L150 70"
                                    stroke="url(#flowGradientLeft)"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeDasharray="120"
                                    strokeDashoffset="120"
                                    style={{
                                        animation:
                                            "flowData 3s cubic-bezier(0.4, 0, 0.2, 1) infinite",
                                    }}
                                />
                                <path
                                    d="M350 100 L280 100 L250 130"
                                    stroke="url(#flowGradientRight)"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeDasharray="120"
                                    strokeDashoffset="120"
                                    style={{
                                        animation:
                                            "flowData 3s cubic-bezier(0.4, 0, 0.2, 1) infinite",
                                        animationDelay: "1.5s",
                                    }}
                                />

                                <g transform="translate(50 100) rotate(45)">
                                    <rect
                                        x="-10"
                                        y="-10"
                                        width="20"
                                        height="20"
                                        fill="#1A1A20"
                                        stroke="white"
                                        strokeOpacity="0.2"
                                        className="group-hover:stroke-cyan-500/50 transition-colors duration-300"
                                    />
                                    <circle
                                        cx="0"
                                        cy="0"
                                        r="2"
                                        fill="#22d3ee"
                                        className="opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                                    />
                                </g>
                                <g transform="translate(350 100) rotate(45)">
                                    <rect
                                        x="-10"
                                        y="-10"
                                        width="20"
                                        height="20"
                                        fill="#1A1A20"
                                        stroke="white"
                                        strokeOpacity="0.2"
                                        className="group-hover:stroke-cyan-500/50 transition-colors duration-300"
                                    />
                                    <circle
                                        cx="0"
                                        cy="0"
                                        r="2"
                                        fill="#22d3ee"
                                        className="opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                                    />
                                </g>
                            </svg>

                            <div className="relative flex items-center justify-center">
                                <div className="absolute inset-0 bg-cyan-600 blur-[40px] opacity-40 group-hover:opacity-60 transition-opacity duration-500"></div>
                                <div
                                    className="w-24 h-24 border border-cyan-500/30 bg-gradient-to-br from-cyan-900/50 to-cyan-900/20 backdrop-blur-md rounded-2xl flex items-center justify-center shadow-[0_0_30px_rgba(59,130,246,0.3)] z-10 relative overflow-hidden"
                                    style={{
                                        animation:
                                            "breatheDiamond 4s ease-in-out infinite",
                                    }}
                                >
                                    <div className="w-12 h-12 border border-cyan-400/50 rounded-lg flex items-center justify-center bg-cyan-500/5 relative z-20">
                                        <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full shadow-[0_0_10px_#22d3ee]"></div>
                                    </div>
                                    <div
                                        className="absolute inset-0 z-10 opacity-30"
                                        style={{
                                            animation:
                                                "orbitSpin 8s linear infinite",
                                        }}
                                    >
                                        <div className="w-full h-full rounded-2xl border-t border-r border-cyan-400/40"></div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="relative z-10">
                            <h3 className="font-['Satoshi_Variable','Satoshi_Variable_Placeholder',sans-serif] font-normal text-[40px] leading-[56px] text-[rgb(255,255,255)] text-left group-hover:text-cyan-50 transition-colors duration-300 tracking-tight">
                                Live Attack Telemetry
                            </h3>
                            <p className="font-['Inter_Variable','Inter_Variable_Placeholder',sans-serif] font-normal text-[17px] leading-[29px] text-[rgb(173,173,173)] text-left mt-2 group-hover:text-neutral-300 transition-colors duration-300">
                                Watch your infrastructure break in real-time
                                through a high-frequency WebSocket stream.
                            </p>
                        </div>
                    </div>

                    {/* Card 3: Auth Bypass Detection */}
                    <div className="md:col-span-2 group flex flex-col overflow-hidden hover:border-cyan-500/30 transition-all duration-500 bg-[#0A0A0A] border-[#1A1A1A] border rounded-md px-8 py-8 relative justify-between">
                        <style>{`
              @keyframes shimmer-lock {
                0%, 100% { opacity: 0.4; border-color: rgba(255,255,255,0.1); transform: scale(1); }
                50% { opacity: 0.8; border-color: rgba(255,255,255,0.25); transform: scale(1.05); }
              }
              @keyframes active-pulse {
                0%, 100% { box-shadow: 0 0 20px rgba(79, 70, 229, 0.4); transform: scale(1); border-color: rgba(255,255,255,0.1); }
                50% { box-shadow: 0 0 35px rgba(79, 70, 229, 0.6); transform: scale(1.02); border-color: rgba(79, 70, 229, 0.5); }
              }
              @keyframes scan-sweep {
                0% { transform: translateY(-150%) rotate(15deg); opacity: 0; }
                20% { opacity: 1; }
                80% { opacity: 1; }
                100% { transform: translateY(250%) rotate(15deg); opacity: 0; }
              }
              @keyframes bg-pulse-soft {
                0%, 100% { opacity: 0.15; transform: translate(-50%, -50%) scale(0.9); }
                50% { opacity: 0.25; transform: translate(-50%, -50%) scale(1.1); }
              }
              @keyframes progress-spin {
                0% { stroke-dashoffset: 100; }
                100% { stroke-dashoffset: 25; }
              }
            `}</style>

                        <div className="flex w-full h-48 mb-6 relative items-center justify-center">
                            <div className="flex items-center gap-4 relative">
                                <div
                                    className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-cyan-600/20 blur-[60px] rounded-full pointer-events-none"
                                    style={{
                                        animation:
                                            "bg-pulse-soft 4s ease-in-out infinite",
                                    }}
                                ></div>

                                <div
                                    className="w-12 h-12 rounded-xl border border-[#1A1A1A] bg-[#121215] flex items-center justify-center text-neutral-600"
                                    style={{
                                        animation:
                                            "shimmer-lock 4s ease-in-out infinite",
                                        animationDelay: "0s",
                                    }}
                                >
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        width="18"
                                        height="18"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    >
                                        <rect
                                            width="18"
                                            height="11"
                                            x="3"
                                            y="11"
                                            rx="2"
                                            ry="2"
                                        />
                                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                    </svg>
                                </div>
                                <div
                                    className="w-12 h-12 rounded-xl border border-[#1A1A1A] bg-[#121215] flex items-center justify-center text-neutral-500"
                                    style={{
                                        animation:
                                            "shimmer-lock 4s ease-in-out infinite",
                                        animationDelay: "1s",
                                    }}
                                >
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        width="18"
                                        height="18"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    >
                                        <rect
                                            width="18"
                                            height="11"
                                            x="3"
                                            y="11"
                                            rx="2"
                                            ry="2"
                                        />
                                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                    </svg>
                                </div>

                                <div
                                    className="relative w-20 h-20 rounded-2xl bg-[#000000] flex items-center justify-center text-white shadow-[0_0_20px_rgba(79,70,229,0.4)] z-10 border border-[#1A1A1A] ring-4 ring-[#08080A]"
                                    style={{
                                        animation:
                                            "active-pulse 3s ease-in-out infinite",
                                    }}
                                >
                                    <div className="absolute inset-0 overflow-hidden rounded-2xl">
                                        <div
                                            className="w-full h-1/3 bg-gradient-to-b from-white/0 via-white/20 to-white/0 absolute top-0 left-0"
                                            style={{
                                                animation:
                                                    "scan-sweep 3s ease-in-out infinite",
                                            }}
                                        ></div>
                                    </div>

                                    <svg
                                        className="absolute inset-0 w-full h-full -rotate-90 p-1"
                                        viewBox="0 0 36 36"
                                    >
                                        <path
                                            className="text-white/20"
                                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                        />
                                        <path
                                            className="text-white drop-shadow-[0_0_2px_rgba(255,255,255,0.8)]"
                                            strokeDasharray="100, 100"
                                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            style={{
                                                animation:
                                                    "progress-spin 1.5s ease-out forwards",
                                            }}
                                        />
                                    </svg>

                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        width="32"
                                        height="32"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        className="relative z-10"
                                    >
                                        <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                                    </svg>

                                    <div className="absolute -bottom-3 bg-[#0A0A0A] text-white border border-[#1A1A1A] px-2 py-0.5 rounded-full flex items-center gap-1 shadow-lg">
                                        <span className="relative flex h-2 w-2">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                                        </span>
                                        <span className="text-[9px] font-mono tracking-wider font-semibold font-['Inter']">
                                            LIVE
                                        </span>
                                    </div>
                                </div>

                                <div
                                    className="w-12 h-12 rounded-xl border border-[#1A1A1A] bg-[#121215] flex items-center justify-center text-neutral-500"
                                    style={{
                                        animation:
                                            "shimmer-lock 4s ease-in-out infinite",
                                        animationDelay: "2s",
                                    }}
                                >
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        width="18"
                                        height="18"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    >
                                        <rect
                                            width="18"
                                            height="11"
                                            x="3"
                                            y="11"
                                            rx="2"
                                            ry="2"
                                        />
                                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                    </svg>
                                </div>
                                <div
                                    className="w-12 h-12 rounded-xl border border-[#1A1A1A] bg-[#121215] flex items-center justify-center text-neutral-600"
                                    style={{
                                        animation:
                                            "shimmer-lock 4s ease-in-out infinite",
                                        animationDelay: "3s",
                                    }}
                                >
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        width="18"
                                        height="18"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    >
                                        <rect
                                            width="18"
                                            height="11"
                                            x="3"
                                            y="11"
                                            rx="2"
                                            ry="2"
                                        />
                                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                    </svg>
                                </div>
                            </div>
                        </div>

                        <div className="relative z-10">
                            <h3 className="font-['Satoshi_Variable','Satoshi_Variable_Placeholder',sans-serif] font-normal text-[40px] leading-[56px] text-[rgb(255,255,255)] text-left tracking-tight">
                                Auth Bypass Detection
                            </h3>
                            <p className="font-['Inter_Variable','Inter_Variable_Placeholder',sans-serif] font-normal text-[17px] leading-[29px] text-[rgb(173,173,173)] text-left mt-2">
                                Automatically test JWTs, OAuth tokens, and
                                broken access controls at scale.
                            </p>
                        </div>
                    </div>

                    {/* Card 4: Distributed Execution */}
                    <div className="md:col-span-1 group flex flex-col overflow-hidden hover:border-cyan-500/30 transition-all duration-500 bg-[#0A0A0A] border-[#1A1A1A] border rounded-md p-8 relative justify-between">
                        <style>{`
              @keyframes drift-vertical-slow {
                0%, 100% { transform: translateY(0px); }
                50% { transform: translateY(-8px); }
              }
              @keyframes drift-vertical-reverse {
                0%, 100% { transform: translateY(0px); }
                50% { transform: translateY(8px); }
              }
              @keyframes signal-flow {
                0% { stroke-dashoffset: 20; opacity: 0.3; }
                100% { stroke-dashoffset: 0; opacity: 0.6; }
              }
              @keyframes signal-pulse {
                0%, 100% { stroke-width: 1; opacity: 0.2; }
                50% { stroke-width: 1.5; opacity: 0.8; stroke: #22d3ee; }
              }
              @keyframes node-activate {
                0%, 90%, 100% { fill: white; r: 3px; filter: none; }
                92% { fill: #06b6d4; r: 4.5px; filter: drop-shadow(0 0 8px rgba(59, 130, 246, 0.8)); }
                95% { fill: #22d3ee; r: 4px; }
              }
              @keyframes grid-pan-diagonal {
                0% { background-position: 0% 0%; }
                100% { background-position: 100px 100px; }
              }
            `}</style>

                        <div
                            className="absolute inset-0 opacity-[0.07] pointer-events-none"
                            style={{
                                backgroundImage:
                                    "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
                                backgroundSize: "40px 40px",
                                transform: "scale(1.5) rotate(15deg)",
                                animation:
                                    "grid-pan-diagonal 60s linear infinite",
                            }}
                        ></div>
                        <div className="bg-[#0A0A0A] z-0 absolute top-0 right-0 bottom-0 left-0"></div>

                        <div className="relative h-48 w-full flex items-center justify-center mb-6 z-10">
                            <svg
                                className="w-full h-full text-white/10"
                                viewBox="0 0 200 200"
                                fill="none"
                            >
                                <line
                                    x1="100"
                                    y1="20"
                                    x2="100"
                                    y2="180"
                                    stroke="currentColor"
                                    strokeWidth="1"
                                />
                                <line
                                    x1="60"
                                    y1="20"
                                    x2="60"
                                    y2="180"
                                    stroke="currentColor"
                                    strokeWidth="1"
                                    strokeDasharray="4 4"
                                    style={{
                                        animation:
                                            "signal-flow 3s linear infinite",
                                    }}
                                />
                                <line
                                    x1="140"
                                    y1="20"
                                    x2="140"
                                    y2="180"
                                    stroke="currentColor"
                                    strokeWidth="1"
                                    strokeDasharray="4 4"
                                    style={{
                                        animation:
                                            "signal-flow 4s linear infinite reverse",
                                    }}
                                />

                                <g
                                    style={{
                                        animation:
                                            "drift-vertical-slow 7s ease-in-out infinite",
                                    }}
                                >
                                    <path
                                        d="M60 80 C 80 80, 80 100, 100 100"
                                        stroke="currentColor"
                                        strokeWidth="1"
                                        style={{
                                            animation:
                                                "signal-pulse 5s ease-in-out infinite 0s",
                                        }}
                                    />
                                    <circle
                                        cx="60"
                                        cy="80"
                                        r="3"
                                        fill="white"
                                        style={{
                                            animation:
                                                "node-activate 8s ease-in-out infinite 0.5s",
                                        }}
                                    />
                                </g>

                                <g
                                    style={{
                                        animation:
                                            "drift-vertical-reverse 8s ease-in-out infinite 1s",
                                    }}
                                >
                                    <path
                                        d="M100 60 C 120 60, 120 80, 140 80"
                                        stroke="currentColor"
                                        strokeWidth="1"
                                        style={{
                                            animation:
                                                "signal-pulse 5s ease-in-out infinite 2.5s",
                                        }}
                                    />
                                    <circle
                                        cx="140"
                                        cy="80"
                                        r="3"
                                        fill="white"
                                        style={{
                                            animation:
                                                "node-activate 8s ease-in-out infinite 3s",
                                        }}
                                    />
                                </g>

                                <g
                                    style={{
                                        animation:
                                            "drift-vertical-slow 6s ease-in-out infinite 2s",
                                    }}
                                >
                                    <path
                                        d="M100 120 C 80 120, 80 140, 60 140"
                                        stroke="currentColor"
                                        strokeWidth="1"
                                        style={{
                                            animation:
                                                "signal-pulse 5s ease-in-out infinite 1.5s",
                                        }}
                                    />
                                    <circle
                                        cx="60"
                                        cy="140"
                                        r="3"
                                        fill="white"
                                        style={{
                                            animation:
                                                "node-activate 8s ease-in-out infinite 5.5s",
                                        }}
                                    />
                                </g>

                                <circle
                                    cx="100"
                                    cy="60"
                                    r="3"
                                    fill="white"
                                    style={{
                                        animation:
                                            "node-activate 8s ease-in-out infinite 0s",
                                    }}
                                />
                                <circle
                                    cx="100"
                                    cy="100"
                                    r="3"
                                    fill="white"
                                    style={{
                                        animation:
                                            "node-activate 8s ease-in-out infinite 2s",
                                    }}
                                />
                                <circle
                                    cx="100"
                                    cy="150"
                                    r="3"
                                    fill="white"
                                    style={{
                                        animation:
                                            "node-activate 8s ease-in-out infinite 4s",
                                    }}
                                />

                                <circle
                                    cx="120"
                                    cy="40"
                                    r="1"
                                    fill="#22d3ee"
                                    className="opacity-50"
                                    style={{
                                        animation:
                                            "drift-vertical-reverse 10s ease-in-out infinite",
                                    }}
                                />
                                <circle
                                    cx="80"
                                    cy="160"
                                    r="1"
                                    fill="#22d3ee"
                                    className="opacity-50"
                                    style={{
                                        animation:
                                            "drift-vertical-slow 9s ease-in-out infinite",
                                    }}
                                />
                            </svg>
                        </div>

                        <div className="relative z-10">
                            <h3 className="font-['Satoshi_Variable','Satoshi_Variable_Placeholder',sans-serif] font-normal text-[40px] leading-[56px] text-[rgb(255,255,255)] text-left group-hover:text-cyan-50 transition-colors duration-300 tracking-tight">
                                Distributed Execution
                            </h3>
                            <p className="font-['Inter_Variable','Inter_Variable_Placeholder',sans-serif] font-normal text-[17px] leading-[29px] text-[rgb(173,173,173)] text-left mt-2 group-hover:text-neutral-300 transition-colors duration-300">
                                Onyx scales with your CI/CD pipeline, handling
                                thousands of endpoints asynchronously via
                                BullMQ.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default AdvancedFeatures;

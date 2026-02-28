import { motion } from "framer-motion";
import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";

const bashLines = [
    {
        text: "> Initializing Onyx Engine v2.4.0...",
        className: "text-neutral-500",
    },
    {
        text: "> Loading vulnerability modules...",
        className: "text-neutral-300",
    },
    {
        text: "> Establishing connection to target environment...",
        className: "text-cyan-400",
    },
    {
        text: `> Ready. Enter target OpenAPI URL below to begin analysis:`,
        className: "text-neutral-300",
    },
];

const HeroTerminal = () => {
    const navigate = useNavigate();
    const [linesVisible, setLinesVisible] = useState(0);
    const [showInput, setShowInput] = useState(false);
    const [urlInput, setUrlInput] = useState("");
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const sequence = [1000, 2500, 4500, 6000]; // timing for each line to appear
        const timeouts: ReturnType<typeof setTimeout>[] = [];

        sequence.forEach((time, index) => {
            const timeout = setTimeout(() => {
                setLinesVisible(index + 1);

                // Show input after the last line
                if (index === sequence.length - 1) {
                    setTimeout(() => setShowInput(true), 500);
                }
            }, time);
            timeouts.push(timeout);
        });

        return () => {
            timeouts.forEach(clearTimeout);
        };
    }, []);

    // Auto focus input when it appears
    useEffect(() => {
        if (showInput && inputRef.current) {
            inputRef.current.focus();
        }
    }, [showInput]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter" && urlInput.trim() !== "") {
            navigate("/dashboard", { state: { targetUrl: urlInput } });
        }
    };

    return (
        <div
            className="w-full aspect-[16/10] mt-16 mb-32 bg-cover bg-center border-y border-[#2A2A2A] flex items-center justify-center p-8 overflow-hidden relative"
            style={{ backgroundImage: "url('/hero-bg.png')" }}
        >
            {/* Intersection Nodes (Top/Bottom, Left/Right corners of the border-y wrapper hitting the grid) */}
            <div className="absolute top-[-2px] left-[-2px] w-[3px] h-[3px] bg-[#444444] z-10" />
            <div className="absolute top-[-2px] right-[-2px] w-[3px] h-[3px] bg-[#444444] z-10" />
            <div className="absolute bottom-[-2px] left-[-2px] w-[3px] h-[3px] bg-[#444444] z-10" />
            <div className="absolute bottom-[-2px] right-[-2px] w-[3px] h-[3px] bg-[#444444] z-10" />

            <div className="w-full max-w-4xl aspect-video bg-[#000000] rounded-[10px] border border-[#333] p-8 shadow-2xl shadow-black/50 flex flex-col relative overflow-hidden">
                {/* Top Bar */}
                <div className="h-8 border-b border-neutral-800 pb-3 mb-4 flex items-center justify-between shrink-0">
                    {/* macOS controls */}
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-[#FF5F57]" />{" "}
                        {/* Red */}
                        <div className="w-3 h-3 rounded-full bg-[#FEBC2E]" />{" "}
                        {/* Yellow */}
                        <div className="w-3 h-3 rounded-full bg-[#28C840]" />{" "}
                        {/* Green */}
                    </div>
                    {/* Title */}
                    <div className="font-mono text-xs text-neutral-500 absolute left-1/2 -translate-x-1/2">
                        onyx -- interactive-session
                    </div>
                    <div className="w-[44px]" /> {/* Spacer for symmetry */}
                </div>

                {/* Terminal Body */}
                <div className="flex-1 font-mono text-sm leading-loose flex flex-col">
                    {bashLines.slice(0, linesVisible).map((line, idx) => (
                        <motion.div
                            key={idx}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3 }}
                            className={line.className}
                        >
                            {line.text}
                        </motion.div>
                    ))}

                    {/* Interactive Input Phase */}
                    {showInput ? (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="mt-2 flex items-center relative"
                        >
                            <span className="text-cyan-400 mr-2">{">"}</span>
                            {/* Native Approach Customization */}
                            <input
                                ref={inputRef}
                                type="text"
                                value={urlInput}
                                onChange={(e) => setUrlInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="https://api.your-company.com/openapi.json"
                                className="bg-transparent text-white font-mono outline-none w-full placeholder:text-neutral-600 focus:ring-0 border-none px-0"
                                spellCheck={false}
                                autoComplete="off"
                            />
                            {/* Blinking block for aesthetics if empty */}
                            {!urlInput && (
                                <motion.div
                                    animate={{ opacity: [1, 0] }}
                                    transition={{
                                        repeat: Infinity,
                                        duration: 0.8,
                                    }}
                                    className="absolute left-[3ch] w-2 h-4 bg-neutral-500 pointer-events-none"
                                />
                            )}
                        </motion.div>
                    ) : (
                        /* Loading Blinking Cursor */
                        linesVisible < bashLines.length && (
                            <motion.div
                                animate={{ opacity: [1, 0] }}
                                transition={{ repeat: Infinity, duration: 0.8 }}
                                className="inline-block w-2 h-4 bg-neutral-500 mt-2"
                            />
                        )
                    )}
                </div>
            </div>
        </div>
    );
};

export default HeroTerminal;

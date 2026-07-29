// =============================================================================
// CiCdSection (#cicd) — homepage "shift-left" section (T21c).
// Advertises the shipped CLI (T10b) + GitHub Action (T11). Mirrors the light-mono
// sections: split grid, mono-eyebrow, text-[44px] headline, p-12 lg:p-24 rhythm,
// hairline borders, mono-card tiles, single blue #3b82f6 accent, no shadows.
// The code blocks use a LIGHT treatment (JetBrains Mono on #f5f5f5, hairline
// border) — never a dark terminal — so they stay on-brand.
// =============================================================================
import { useState } from "react";
import { motion } from "framer-motion";
import { Check, Copy, Terminal, GitPullRequest, ShieldCheck, SlidersHorizontal } from "lucide-react";

const enter = {
    initial: { opacity: 0, y: 24 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: "-100px" },
    transition: { duration: 0.6, ease: [0.2, 0, 0, 1] as const },
};

const CLI_CMD = "onyx scan --spec ./openapi.json --fail-on high --format sarif";

// A compact, on-brand GitHub Action snippet (secondary visual).
const ACTION_YAML = `- uses: onyx/scan-action@v1
  with:
    spec: ./openapi.json
    fail-on: high`;

const TILES: { icon: typeof Terminal; title: string; note: string }[] = [
    {
        icon: Terminal,
        title: "One-line CLI",
        note: "table / JSON / SARIF output",
    },
    {
        icon: GitPullRequest,
        title: "GitHub Action with PR comments",
        note: "Findings commented inline on the PR",
    },
    {
        icon: ShieldCheck,
        title: "SARIF → GitHub Security tab",
        note: "Alerts land in code scanning",
    },
    {
        icon: SlidersHorizontal,
        title: "Exit-code gating for any CI",
        note: "Fail the build on criticals",
    },
];

// Light-mono code block with a copy affordance. Header is optional (label).
const CodeBlock = ({ code, label }: { code: string; label?: string }) => {
    const [copied, setCopied] = useState(false);
    const copy = async () => {
        try {
            await navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
        } catch {
            /* clipboard unavailable */
        }
    };
    return (
        <div className="border border-[#e6e6e6] bg-[#f5f5f5] overflow-hidden">
            {label && (
                <div className="flex items-center justify-between border-b border-[#e6e6e6] px-3 py-2 bg-white">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-[#999]">
                        {label}
                    </span>
                    <button
                        onClick={copy}
                        aria-label={copied ? "Copied" : "Copy to clipboard"}
                        className="flex items-center justify-center w-6 h-6 text-[#999] hover:text-black transition-colors cursor-pointer"
                    >
                        {copied ? (
                            <Check size={13} className="text-[#16a34a]" />
                        ) : (
                            <Copy size={13} />
                        )}
                    </button>
                </div>
            )}
            <pre className="font-mono text-[12.5px] leading-[1.7] text-[#334155] p-4 overflow-x-auto">
                <code>{code}</code>
            </pre>
        </div>
    );
};

const CiCdSection = () => (
    <section
        id="cicd"
        className="scroll-mt-24 border-b border-[#e6e6e6] grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-[#e6e6e6]"
    >
        {/* Left — statement + tiles */}
        <motion.div {...enter} className="p-12 lg:p-24 flex flex-col justify-center">
            <div className="mono-eyebrow mb-4">
                <span className="sq" /> SHIFT LEFT
            </div>
            <h2 className="text-[44px] mb-6 leading-[1.05] text-balance">
                Break the build before attackers break in.
            </h2>
            <p className="text-[#000]/70 max-w-md text-[17px] leading-7 text-pretty">
                Run Onyx in CI with one command or drop in our GitHub Action. Fail the PR
                on criticals, comment findings inline, and ship SARIF straight to your
                GitHub Security tab.
            </p>

            <ul className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md">
                {TILES.map(({ icon: Icon, title, note }) => (
                    <li key={title} className="mono-card p-4 flex flex-col gap-2">
                        <Icon size={16} className="text-[#3b82f6]" aria-hidden="true" />
                        <span className="text-[13px] leading-snug text-black">{title}</span>
                        <span className="font-mono text-[10px] uppercase tracking-wide text-[#999] leading-snug">
                            {note}
                        </span>
                    </li>
                ))}
            </ul>
        </motion.div>

        {/* Right — CLI command + GitHub Action snippet */}
        <div className="p-12 lg:p-24 bg-white/50 flex items-center justify-center">
            <motion.div {...enter} className="w-full max-w-md flex flex-col gap-4">
                <CodeBlock code={CLI_CMD} label="terminal" />
                <CodeBlock code={ACTION_YAML} label=".github/workflows/onyx.yml" />
            </motion.div>
        </div>
    </section>
);

export default CiCdSection;

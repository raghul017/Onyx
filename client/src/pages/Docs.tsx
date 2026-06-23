// =============================================================================
// Docs — Full product documentation (dark, interactive, landing-matched)
// Content sourced from WORKFLOW.md / README.md. Built to feel like part of the
// landing page: c5 gradient glow, framer-motion reveals, interactive accordion,
// File/DNS tabs, copy-to-clipboard code, animated scroll-spy TOC.
// =============================================================================

import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AnimatePresence, motion, useScroll, useSpring } from "framer-motion";
import {
    ArrowLeft,
    ShieldCheck,
    Cpu,
    Activity,
    FileText,
    Boxes,
    Gauge,
    Lock,
    Terminal,
    Check,
    Copy,
    ChevronDown,
    FolderOpen,
    Globe,
    Rocket,
    Radio,
    Network,
    BookOpen,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Section registry — drives the sidebar TOC and scroll-spy
// ---------------------------------------------------------------------------
const SECTIONS = [
    { id: "overview", label: "Overview" },
    { id: "quick-start", label: "Quick Start" },
    { id: "what-to-paste", label: "What You Can Paste" },
    { id: "verification", label: "Domain Verification" },
    { id: "attack-flow", label: "The Attack Flow" },
    { id: "attack-types", label: "Attack Types" },
    { id: "live-results", label: "Live Results" },
    { id: "scoring", label: "CVSS Severity Scoring" },
    { id: "security", label: "Security & Resilience" },
    { id: "architecture", label: "Architecture" },
    { id: "plans", label: "Plans & Quotas" },
    { id: "faq", label: "FAQ" },
    { id: "glossary", label: "Glossary" },
] as const;

// Shared scroll-reveal variants (mirrors the landing-page sections)
const reveal = {
    hidden: { opacity: 0, y: 24 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" as const } },
};
const revealStagger = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.08 } },
};

// ---------------------------------------------------------------------------
// Small presentational helpers
// ---------------------------------------------------------------------------
const Eyebrow = ({ icon: Icon, children }: { icon: React.ElementType; children: React.ReactNode }) => (
    <div className="flex items-center gap-2.5 mb-4">
        <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-[#22d3ee]/10 border border-[#22d3ee]/25">
            <Icon size={15} className="text-[#22d3ee]" />
        </span>
        <span className="font-['JetBrains_Mono'] text-[12px] tracking-widest uppercase text-white/55">
            {children}
        </span>
    </div>
);

const H2 = ({ children }: { children: React.ReactNode }) => (
    <h2
        className="text-white mb-4"
        style={{
            fontFamily: '"Satoshi Variable", sans-serif',
            fontWeight: 400,
            fontSize: "clamp(1.625rem, 3vw, 2.25rem)",
            lineHeight: 1.15,
            letterSpacing: "-0.03em",
        }}
    >
        {children}
    </h2>
);

const H3 = ({ children }: { children: React.ReactNode }) => (
    <h3 className="text-white text-[17px] sm:text-[18px] font-medium tracking-tight mt-8 mb-3">
        {children}
    </h3>
);

const P = ({ children }: { children: React.ReactNode }) => (
    <p className="font-['Inter'] text-[15px] sm:text-[16px] leading-[1.7] text-[#B4B4B4] max-w-[68ch] mb-4">
        {children}
    </p>
);

const Code = ({ children }: { children: React.ReactNode }) => (
    <code className="font-['JetBrains_Mono'] text-[13px] text-[#22d3ee] bg-[#0E0E0E] border border-[#1A1A1A] rounded px-1.5 py-0.5">
        {children}
    </code>
);

// Copy-to-clipboard code block with success feedback (skill: success feedback + checkmark)
const CodeBlock = ({ code }: { code: string }) => {
    const [copied, setCopied] = useState(false);
    const copy = async () => {
        try {
            await navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
        } catch {
            /* clipboard unavailable — no-op */
        }
    };
    return (
        <div className="relative group my-5 max-w-[68ch]">
            <pre className="font-['JetBrains_Mono'] text-[13px] leading-[1.7] text-[#C9C9C9] bg-[#0A0A0A] border border-[#1A1A1A] rounded-xl p-4 sm:p-5 pr-12 overflow-x-auto group-hover:border-[#2A2A2A] transition-colors">
                <code>{code}</code>
            </pre>
            <button
                onClick={copy}
                aria-label={copied ? "Copied" : "Copy to clipboard"}
                className="absolute top-3 right-3 flex items-center justify-center w-8 h-8 rounded-lg bg-[#141414] border border-[#222] text-white/50 hover:text-white hover:border-[#333] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22d3ee]/60"
            >
                {copied ? (
                    <Check size={14} className="text-[#22d3ee]" />
                ) : (
                    <Copy size={14} />
                )}
            </button>
        </div>
    );
};

const Callout = ({
    tone = "info",
    title,
    children,
}: {
    tone?: "info" | "warn";
    title: string;
    children: React.ReactNode;
}) => {
    const tones = {
        info: "border-[#22d3ee]/25 bg-[#22d3ee]/[0.04]",
        warn: "border-[#F26522]/30 bg-[#F26522]/[0.05]",
    };
    const dot = { info: "bg-[#22d3ee]", warn: "bg-[#F26522]" };
    return (
        <div className={`rounded-xl border ${tones[tone]} p-4 sm:p-5 my-5 max-w-[68ch]`}>
            <div className="flex items-center gap-2 mb-1.5">
                <span className={`w-2 h-2 rounded-full ${dot[tone]}`} aria-hidden="true" />
                <span className="font-medium text-white text-[14px]">{title}</span>
            </div>
            <p className="font-['Inter'] text-[14px] leading-[1.65] text-[#A1A1AA]">
                {children}
            </p>
        </div>
    );
};

// Scroll-revealed section wrapper
const Section = ({ id, children }: { id: string; children: React.ReactNode }) => (
    <motion.section
        id={id}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-100px" }}
        variants={reveal}
        className="scroll-mt-28 pb-16 sm:pb-20 border-b border-[#141414] mb-16 sm:mb-20 last:border-0"
    >
        {children}
    </motion.section>
);

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------
const ATTACK_TYPES = [
    { type: "SQL_INJECTION", desc: "Classic, blind, UNION, time-based, stacked, auth bypass" },
    { type: "XSS", desc: "Reflected, stored, DOM, polyglot, event-handler vectors" },
    { type: "MISSING_AUTH", desc: "Forged JWT (alg:none), missing headers, privilege escalation" },
    { type: "PATH_TRAVERSAL", desc: "../, URL-encoded, double-dot, Windows paths" },
    { type: "BOUNDARY", desc: "Null bytes, integer overflow, empty strings, NaN" },
    { type: "OVERSIZED_PAYLOAD", desc: "Array bombs (10k elements), deeply nested JSON" },
    { type: "TYPE_CONFUSION", desc: "Strings where ints expected, arrays where strings expected" },
    { type: "RATE_LIMIT", desc: "Burst markers to probe rate-limiting behaviour" },
];

const SEVERITY = [
    { label: "CRITICAL", color: "#ef4444", rule: "5xx on an injection/auth attack, or secrets/DB errors leaked in the response", deduct: "−25" },
    { label: "HIGH", color: "#f97316", rule: "Any other 5xx, or a 401/403 on an auth-bypass attempt", deduct: "−15" },
    { label: "MEDIUM", color: "#eab308", rule: "4xx where the response leaks an error, stack, or trace", deduct: "−8" },
    { label: "LOW", color: "#22d3ee", rule: "Any other 4xx response", deduct: "−3" },
    { label: "INFO", color: "#71717a", rule: "2xx / 3xx / no response — no deduction", deduct: "0" },
];

const PLANS = [
    { name: "Free", price: "$0", runs: "5 / mo", endpoints: "10 / run", pdf: false },
    { name: "Pro", price: "$9 / mo", runs: "100 / mo", endpoints: "50 / run", pdf: true },
    { name: "Team", price: "$18 / mo", runs: "500 / mo", endpoints: "Unlimited", pdf: true },
];

const FLOW = [
    ["Parse", "The spec is fetched with WAF-bypass headers, then every endpoint, parameter, and request body is extracted."],
    ["Generate", "Gemini crafts up to 20 schema-aware payloads per endpoint (with a 35-payload static fallback)."],
    ["Queue", "Payloads are added to a BullMQ Redis queue — 5 concurrent workers, 10 jobs/second, 10s timeout each."],
    ["Fire", "Each worker re-checks SSRF, fires the payload, and records status code, latency, and a response snippet."],
    ["Score", "Every result is classified with CVSS-inspired severity and folded into an overall 0–100 API security score."],
    ["Stream", "Results broadcast live to your dashboard over WebSockets as each attack completes."],
];

const SECURITY_LAYERS = [
    ["SSRF guard", "DNS resolution on every URL before any outbound request — loopback, private, link-local, and cloud-metadata ranges are blocked at both spec-fetch and attack time."],
    ["Domain ownership gate", "Every run checks for a verified (user, domain) record. No verified record returns a 403 before anything fires."],
    ["Rate limiting", "Auth endpoints: 5 req/min per IP. Attack endpoints: 5 req/hour per IP. Plan quotas enforced per calendar month."],
    ["JWT security", "7-day token expiry; the server hard-crashes on boot if JWT_SECRET is missing, preventing weak-key deployments."],
    ["WAF bypass (fetch only)", "Spec fetch spoofs a real Chrome user-agent so Cloudflare/AWS WAFs don't false-negative during parsing."],
    ["Graceful AI fallback", "If Gemini fails, 35 static payloads keep every scan completing — the pipeline never stalls."],
];

const QUICK_START = [
    ["Create an account", "Sign up with an email and password. The Free plan needs no credit card and gives you 5 runs a month."],
    ["Paste a spec URL", "Drop your OpenAPI / Swagger URL into the dashboard. Onyx parses every endpoint the moment it loads."],
    ["Verify the domain", "Prove ownership once via a file or DNS record. The Execute Run button unlocks the instant it passes."],
    ["Execute the run", "Onyx generates payloads, queues them, and fires. Watch results stream in live — no refresh needed."],
    ["Review & export", "Triage findings by CVSS severity, drill into any endpoint, and export a PDF report on Pro and Team."],
];

const RUN_PHASES = [
    ["PARSING", "Fetching the spec and extracting every endpoint, parameter, and request body."],
    ["GENERATING", "Asking Gemini for schema-aware payloads — up to 20 per endpoint."],
    ["ATTACKING", "Workers fire payloads from the queue and log each response."],
    ["COMPLETED", "All jobs done. The overall score and severity breakdown are computed."],
];

const ARCH_STAGES = [
    ["Client", "React + Vite on Vercel. Submits the spec URL and subscribes to the run over a WebSocket."],
    ["API + guards", "Express on Render. Auth, rate-limit, quota, domain gate, and SSRF checks run before anything fires."],
    ["Gemini", "Generates the payload set per endpoint, with a static fallback if the model is unavailable."],
    ["BullMQ + Redis", "A job queue fans payloads out to 5 concurrent workers at 10/sec, surviving restarts."],
    ["Workers", "Fire each payload, score the response by CVSS severity, and persist it."],
    ["Postgres + WS", "Results are written to Neon Postgres via Prisma and broadcast live to the browser."],
];

const GLOSSARY = [
    ["OpenAPI / Swagger", "A machine-readable description of an API's endpoints, parameters, and responses. Onyx's only required input."],
    ["SSRF", "Server-Side Request Forgery — tricking a server into calling internal resources. Onyx blocks it via DNS resolution on every URL."],
    ["CVSS", "Common Vulnerability Scoring System — the industry standard Onyx's severity labels are inspired by."],
    ["BullMQ", "A Redis-backed job queue. Onyx uses it to fire attacks concurrently without overwhelming the target or Node.js."],
    ["WebSocket", "A persistent two-way connection. Onyx streams every attack result over it so the dashboard updates in real time."],
    ["Domain verification", "Proof that you own a target, via a file probe or DNS TXT record, required once before scanning."],
];

const DOC_FAQ = [
    {
        q: "Do I need to own the API I'm testing?",
        a: "Yes. Onyx requires domain ownership verification — via a file probe or DNS TXT record — before it will fire a single payload at any target. This is both a legal protection and a trust layer.",
    },
    {
        q: "What happens if Gemini is unavailable?",
        a: "The pipeline never stalls. If the Gemini API rate-limits or GEMINI_API_KEY is missing, Onyx falls back to 35 hard-coded payloads covering every attack category, so your scan still completes.",
    },
    {
        q: "Is it safe to run against production?",
        a: "Onyx enforces SSRF protection, per-plan rate limiting, and a 10-second per-attack timeout. Even so, we recommend testing against staging environments where possible.",
    },
    {
        q: "How many requests will Onyx send?",
        a: "Up to 20 payloads per endpoint, across a maximum of 20 endpoints per spec — so up to 400 attacks per run. Jobs run through a BullMQ queue capped at 5 concurrent workers and 10 jobs/second.",
    },
];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
const Docs = () => {
    const navigate = useNavigate();
    const [activeId, setActiveId] = useState<string>(SECTIONS[0].id);
    const [verifyTab, setVerifyTab] = useState<"file" | "dns">("file");
    const [openFaq, setOpenFaq] = useState<number | null>(0);

    // Top reading-progress bar
    const { scrollYProgress } = useScroll();
    const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 30, mass: 0.4 });

    // Scroll-spy — highlight the section currently in view
    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                const visible = entries
                    .filter((e) => e.isIntersecting)
                    .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
                if (visible[0]) setActiveId(visible[0].target.id);
            },
            { rootMargin: "-96px 0px -65% 0px", threshold: 0 },
        );
        SECTIONS.forEach((s) => {
            const el = document.getElementById(s.id);
            if (el) observer.observe(el);
        });
        return () => observer.disconnect();
    }, []);

    const scrollTo = (id: string) => {
        document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    };

    return (
        <div className="relative min-h-screen bg-black text-white font-['Inter'] selection:bg-cyan-400 selection:text-black overflow-x-hidden">
            {/* Reading progress bar */}
            <motion.div
                style={{ scaleX: progress }}
                className="fixed top-0 left-0 right-0 h-[2px] origin-left z-50 c5-animated-gradient"
            />

            {/* Hero glow — same c5 gradient treatment as the landing page */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-[520px] c5-animated-gradient opacity-[0.13] blur-3xl" />
            <div className="pointer-events-none absolute inset-x-0 top-0 h-[520px] bg-gradient-to-b from-transparent to-black" />

            {/* Top bar — sticky, frosted glass (matches the landing navbar on scroll) */}
            <header className="sticky top-0 z-30 w-full border-b border-white/10 bg-black/70 backdrop-blur-xl">
                <div className="max-w-[1240px] mx-auto px-5 sm:px-8 lg:px-12 h-16 flex items-center justify-between">
                    <button
                        onClick={() => navigate("/")}
                        className="group flex items-center gap-2 text-white/70 hover:text-white transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22d3ee]/60 rounded-md px-1"
                    >
                        <ArrowLeft size={16} className="transition-transform group-hover:-translate-x-0.5" />
                        <span className="text-[14px]">Back to home</span>
                    </button>
                    <div className="flex items-center gap-2">
                        <span className="font-['Inter'] text-white text-[20px] tracking-tight">Onyx</span>
                        <span className="font-['JetBrains_Mono'] text-[10px] uppercase tracking-widest text-[#22d3ee] border border-[#22d3ee]/30 rounded px-1.5 py-0.5">
                            Docs
                        </span>
                    </div>
                </div>
            </header>

            <div className="relative z-10 max-w-[1240px] mx-auto px-5 sm:px-8 lg:px-12 flex gap-12">
                {/* ----------------------------------------------------------- */}
                {/* Sticky sidebar TOC (desktop) — animated active indicator   */}
                {/* ----------------------------------------------------------- */}
                <aside className="hidden lg:block w-56 shrink-0">
                    <nav className="sticky top-24 py-12" aria-label="Documentation sections">
                        <p className="font-['JetBrains_Mono'] text-[11px] uppercase tracking-widest text-white/40 mb-4 px-3">
                            On this page
                        </p>
                        <ul className="space-y-0.5">
                            {SECTIONS.map((s) => {
                                const active = activeId === s.id;
                                return (
                                    <li key={s.id} className="relative">
                                        {active && (
                                            <motion.span
                                                layoutId="toc-active"
                                                className="absolute inset-0 rounded-md bg-white/[0.06] border-l-2 border-[#22d3ee]"
                                                transition={{ type: "spring", stiffness: 400, damping: 32 }}
                                            />
                                        )}
                                        <button
                                            onClick={() => scrollTo(s.id)}
                                            aria-current={active ? "true" : undefined}
                                            className={`relative w-full text-left text-[13.5px] rounded-md px-3 py-1.5 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22d3ee]/60 ${
                                                active ? "text-white pl-[10px]" : "text-white/55 hover:text-white/90"
                                            }`}
                                        >
                                            {s.label}
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    </nav>
                </aside>

                {/* ----------------------------------------------------------- */}
                {/* Main content                                               */}
                {/* ----------------------------------------------------------- */}
                <main className="flex-1 min-w-0 py-12 sm:py-16">
                    {/* Page title */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.55, ease: "easeOut" }}
                        className="mb-14 sm:mb-20"
                    >
                        {/* Live status dot — matches the landing hero eyebrow */}
                        <div className="flex items-center gap-2.5 mb-5">
                            <span className="relative flex h-2 w-2" aria-hidden="true">
                                <span className="absolute inline-flex h-full w-full rounded-full bg-[#22d3ee] opacity-75 motion-safe:animate-ping" />
                                <span className="relative inline-flex h-2 w-2 rounded-full bg-[#22d3ee]" />
                            </span>
                            <p className="font-['JetBrains_Mono'] text-[12px] tracking-widest uppercase text-[#22d3ee]">
                                Documentation
                            </p>
                        </div>
                        <h1
                            className="text-white"
                            style={{
                                fontFamily: '"Satoshi Variable", sans-serif',
                                fontWeight: 400,
                                fontSize: "clamp(2.25rem, 5vw, 3.5rem)",
                                lineHeight: 1.08,
                                letterSpacing: "-0.03em",
                            }}
                        >
                            How Onyx works,
                            <br />
                            end to end.
                        </h1>
                        <p className="font-['Inter'] text-[16px] sm:text-[18px] leading-[1.7] text-[#B4B4B4] mt-6 max-w-[60ch]">
                            Everything from the moment you paste a spec URL to the
                            final severity-scored result streaming to your
                            dashboard — the full pipeline, the safeguards, and the
                            answers to the questions people ask most.
                        </p>

                        {/* Quick-jump chips */}
                        <div className="flex flex-wrap gap-2 mt-8">
                            {SECTIONS.slice(0, 5).map((s) => (
                                <button
                                    key={s.id}
                                    onClick={() => scrollTo(s.id)}
                                    className="text-[12.5px] text-white/70 border border-[#1F1F1F] hover:border-[#333] hover:text-white rounded-full px-3.5 py-1.5 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22d3ee]/60"
                                >
                                    {s.label}
                                </button>
                            ))}
                        </div>
                    </motion.div>

                    {/* ---- Overview ---- */}
                    <Section id="overview">
                        <Eyebrow icon={Cpu}>Overview</Eyebrow>
                        <H2>What is Onyx?</H2>
                        <P>
                            Onyx is an AI-native API penetration-testing platform.
                            You provide a link to any API's documentation — an
                            OpenAPI / Swagger specification — and it autonomously
                            verifies ownership, parses every endpoint, generates
                            schema-aware attack payloads with Google Gemini 2.5
                            Flash, fires them through a rate-limited distributed
                            queue, and streams severity-scored results back live.
                        </P>
                        <P>
                            Unlike a generic fuzzer, Onyx reads your actual schema —
                            request bodies, path parameters, query strings — and
                            asks an LLM to reason about what would break each
                            specific endpoint. The result is context-sensitive
                            coverage across the OWASP Top 10 without writing a
                            single test case by hand.
                        </P>

                        {/* At-a-glance interactive stat tiles */}
                        <motion.div
                            variants={revealStagger}
                            initial="hidden"
                            whileInView="visible"
                            viewport={{ once: true, margin: "-60px" }}
                            className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-8 max-w-[68ch]"
                        >
                            {[
                                ["8", "Attack categories"],
                                ["≤ 400", "Payloads / run"],
                                ["5", "Concurrent workers"],
                                ["0–100", "Security score"],
                            ].map(([v, l]) => (
                                <motion.div
                                    key={l}
                                    variants={reveal}
                                    className="rounded-xl border border-[#1A1A1A] bg-[#0A0A0A] p-4 hover:border-[#2A2A2A] transition-colors"
                                >
                                    <div className="font-['Satoshi_Variable',sans-serif] text-[24px] text-white leading-none mb-1.5">
                                        {v}
                                    </div>
                                    <div className="text-[12px] text-white/50">{l}</div>
                                </motion.div>
                            ))}
                        </motion.div>
                    </Section>

                    {/* ---- Quick start ---- */}
                    <Section id="quick-start">
                        <Eyebrow icon={Rocket}>Get going</Eyebrow>
                        <H2>Quick start</H2>
                        <P>
                            Five steps take you from sign-up to a live, scored
                            attack run. Each one is covered in more depth further
                            down this page.
                        </P>
                        <motion.div
                            variants={revealStagger}
                            initial="hidden"
                            whileInView="visible"
                            viewport={{ once: true, margin: "-60px" }}
                            className="space-y-3 my-6 max-w-[68ch]"
                        >
                            {QUICK_START.map(([title, body], i) => (
                                <motion.div
                                    key={title}
                                    variants={reveal}
                                    className="group flex gap-4 rounded-xl border border-[#1A1A1A] bg-[#0A0A0A] p-4 hover:border-[#2A2A2A] transition-colors"
                                >
                                    <span className="shrink-0 flex items-center justify-center w-8 h-8 rounded-lg bg-[#22d3ee]/10 border border-[#22d3ee]/25 font-['JetBrains_Mono'] text-[13px] text-[#22d3ee]">
                                        {i + 1}
                                    </span>
                                    <div>
                                        <p className="text-[15px] font-medium text-white mb-0.5">{title}</p>
                                        <p className="text-[13.5px] leading-[1.6] text-[#A1A1AA]">{body}</p>
                                    </div>
                                </motion.div>
                            ))}
                        </motion.div>
                        <Callout tone="info" title="No setup, no agents">
                            Onyx runs entirely from the spec URL — there's nothing to
                            install on your servers and no SDK to wire in. If your API
                            publishes an OpenAPI document, you're ready.
                        </Callout>
                    </Section>

                    {/* ---- What to paste ---- */}
                    <Section id="what-to-paste">
                        <Eyebrow icon={FileText}>Input</Eyebrow>
                        <H2>What you can paste</H2>
                        <P>
                            Every modern API ships a machine-readable spec
                            describing its endpoints, parameters, and response
                            formats — written in OpenAPI (formerly Swagger). Most
                            APIs expose it at a path like{" "}
                            <Code>/openapi.json</Code>, <Code>/swagger.json</Code>,
                            or <Code>/v2/api-docs</Code>.
                        </P>

                        <div className="grid sm:grid-cols-2 gap-4 my-6 max-w-[68ch]">
                            <div className="rounded-xl border border-[#1A1A1A] bg-[#0A0A0A] p-5 hover:border-[#22d3ee]/30 transition-colors">
                                <p className="text-[13px] font-medium text-[#22d3ee] mb-3">Valid targets</p>
                                <ul className="space-y-2 font-['JetBrains_Mono'] text-[12.5px] text-[#A1A1AA] leading-relaxed">
                                    <li>petstore.swagger.io/v2/swagger.json</li>
                                    <li>api.example.com/openapi.json</li>
                                    <li>httpbin.org/spec.json</li>
                                </ul>
                            </div>
                            <div className="rounded-xl border border-[#1A1A1A] bg-[#0A0A0A] p-5 hover:border-[#F26522]/30 transition-colors">
                                <p className="text-[13px] font-medium text-[#F26522] mb-3">Blocked</p>
                                <ul className="space-y-2 font-['JetBrains_Mono'] text-[12.5px] text-[#A1A1AA] leading-relaxed">
                                    <li>google.com — HTML, not a spec</li>
                                    <li>192.168.1.5/api — private IP (SSRF)</li>
                                    <li>any domain you don't own</li>
                                </ul>
                            </div>
                        </div>

                        <Callout tone="warn" title="SSRF protection is strictly enforced">
                            Onyx performs DNS resolution on every URL. Any hostname
                            resolving to <Code>127.x</Code>, <Code>10.x</Code>,{" "}
                            <Code>172.16–31.x</Code>, <Code>192.168.x</Code>,{" "}
                            <Code>169.254.x</Code>, <Code>.local</Code>, or{" "}
                            <Code>.internal</Code> is instantly blocked.
                        </Callout>

                        <H3>Can't find your spec URL?</H3>
                        <P>
                            If your team uses Swagger UI, the spec is the JSON the UI
                            loads — open the network tab and look for the{" "}
                            <Code>.json</Code> request, or try appending one of these
                            common paths to your API's base URL:
                        </P>
                        <CodeBlock code={`/openapi.json\n/swagger.json\n/v2/api-docs\n/v3/api-docs\n/swagger/v1/swagger.json`} />
                    </Section>

                    {/* ---- Verification (interactive File/DNS tabs) ---- */}
                    <Section id="verification">
                        <Eyebrow icon={ShieldCheck}>Trust gate</Eyebrow>
                        <H2>Domain ownership verification</H2>
                        <P>
                            Before Onyx fires a single payload, you must prove you
                            own the target domain. Without it, anyone could point
                            Onyx at someone else's API — verification closes that
                            liability and is required once per domain, per account.
                        </P>

                        {/* Tab switcher */}
                        <div className="inline-flex items-center gap-1 p-1 rounded-full border border-[#1A1A1A] bg-[#0A0A0A] my-5">
                            {([
                                ["file", "File probe", FolderOpen],
                                ["dns", "DNS record", Globe],
                            ] as const).map(([key, label, Icon]) => {
                                const active = verifyTab === key;
                                return (
                                    <button
                                        key={key}
                                        onClick={() => setVerifyTab(key)}
                                        className={`relative flex items-center gap-2 text-[13px] rounded-full px-4 py-1.5 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22d3ee]/60 ${
                                            active ? "text-black" : "text-white/60 hover:text-white"
                                        }`}
                                    >
                                        {active && (
                                            <motion.span
                                                layoutId="verify-tab"
                                                className="absolute inset-0 rounded-full bg-white"
                                                transition={{ type: "spring", stiffness: 400, damping: 32 }}
                                            />
                                        )}
                                        <Icon size={14} className="relative z-10" />
                                        <span className="relative z-10">{label}</span>
                                    </button>
                                );
                            })}
                        </div>

                        <AnimatePresence mode="wait">
                            {verifyTab === "file" ? (
                                <motion.div
                                    key="file"
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -8 }}
                                    transition={{ duration: 0.2 }}
                                >
                                    <P>
                                        Host a file containing only your verification
                                        token at this exact path — no quotes, no extra
                                        whitespace, nothing else:
                                    </P>
                                    <CodeBlock code={`https://your-domain.com/.well-known/onyx-verify.txt\n\nonyx-verify-a3f9c2b1...`} />
                                </motion.div>
                            ) : (
                                <motion.div
                                    key="dns"
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -8 }}
                                    transition={{ duration: 0.2 }}
                                >
                                    <P>
                                        No file hosting? Add a TXT record to your
                                        domain's DNS instead:
                                    </P>
                                    <CodeBlock code={`Type:   TXT\nName:   _onyx-verify.your-domain.com\nValue:  onyx-verify-a3f9c2b1...`} />
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <Callout tone="info" title="Verification is permanent">
                            Once verified, a domain stays verified for your account —
                            you can delete the file or DNS record afterward. DNS can
                            take a few minutes to propagate; if a check fails right
                            after saving the record, wait and retry.
                        </Callout>

                        <H3>What actually happens</H3>
                        <P>
                            Onyx extracts the hostname from your URL, generates a
                            unique <Code>onyx-verify-&lt;token&gt;</Code>, and stores
                            it against your account. When you click{" "}
                            <Code>Check Verification</Code>, it probes the file over
                            HTTPS first (retrying over HTTP if the connection fails),
                            then falls back to a DNS TXT lookup. Whichever it finds
                            first wins, and the run button unlocks.
                        </P>
                        <P>
                            Until a domain is verified, every attempt to scan it is
                            rejected before a single request leaves the server:
                        </P>
                        <CodeBlock code={`POST /api/test-runs  →  403 Forbidden\n\n{\n  "error": "DOMAIN_NOT_VERIFIED",\n  "domain": "target-api.com",\n  "message": "You must verify ownership of\n              \\"target-api.com\\" before scanning it."\n}`} />
                    </Section>

                    {/* ---- Attack flow (interactive numbered timeline) ---- */}
                    <Section id="attack-flow">
                        <Eyebrow icon={Activity}>Lifecycle</Eyebrow>
                        <H2>The attack flow</H2>
                        <P>
                            End to end, from clicking <Code>Execute Run</Code> to
                            receiving live results:
                        </P>
                        <motion.ol
                            variants={revealStagger}
                            initial="hidden"
                            whileInView="visible"
                            viewport={{ once: true, margin: "-60px" }}
                            className="relative my-6 max-w-[68ch] pl-8"
                        >
                            {/* connecting line */}
                            <span className="absolute left-[14px] top-2 bottom-2 w-px bg-gradient-to-b from-[#22d3ee]/40 via-[#1A1A1A] to-transparent" aria-hidden="true" />
                            {FLOW.map(([title, body], i) => (
                                <motion.li key={title} variants={reveal} className="relative pb-6 last:pb-0 group">
                                    <span className="absolute -left-8 top-0 flex items-center justify-center w-7 h-7 rounded-full bg-[#0A0A0A] border border-[#22d3ee]/30 font-['JetBrains_Mono'] text-[11px] text-[#22d3ee] group-hover:border-[#22d3ee]/70 transition-colors">
                                        {String(i + 1).padStart(2, "0")}
                                    </span>
                                    <p className="text-[15px] leading-[1.6] text-[#B4B4B4]">
                                        <span className="text-white font-medium">{title}.</span> {body}
                                    </p>
                                </motion.li>
                            ))}
                        </motion.ol>

                        <H3>Run status phases</H3>
                        <P>
                            As a run progresses, its status moves through four phases
                            — the dashboard reflects each one live:
                        </P>
                        <div className="flex flex-wrap items-center gap-2 my-5 max-w-[68ch]">
                            {RUN_PHASES.map(([phase, desc], i) => (
                                <div key={phase} className="flex items-center gap-2">
                                    <span
                                        title={desc}
                                        className="font-['JetBrains_Mono'] text-[11px] tracking-wider uppercase text-[#22d3ee] bg-[#22d3ee]/10 border border-[#22d3ee]/25 rounded-md px-2.5 py-1 cursor-default"
                                    >
                                        {phase}
                                    </span>
                                    {i < RUN_PHASES.length - 1 && (
                                        <span className="text-white/25 text-[12px]" aria-hidden="true">→</span>
                                    )}
                                </div>
                            ))}
                        </div>
                    </Section>

                    {/* ---- Attack types (interactive cards) ---- */}
                    <Section id="attack-types">
                        <Eyebrow icon={Boxes}>Coverage</Eyebrow>
                        <H2>Attack types generated</H2>
                        <P>
                            Gemini produces strictly-typed JSON payloads across eight
                            categories, each tuned to the endpoint under test:
                        </P>
                        <motion.div
                            variants={revealStagger}
                            initial="hidden"
                            whileInView="visible"
                            viewport={{ once: true, margin: "-60px" }}
                            className="grid sm:grid-cols-2 gap-3 my-6 max-w-[68ch]"
                        >
                            {ATTACK_TYPES.map((a) => (
                                <motion.div
                                    key={a.type}
                                    variants={reveal}
                                    className="group rounded-xl border border-[#1A1A1A] bg-[#0A0A0A] p-4 hover:border-[#22d3ee]/40 hover:bg-[#0C0C0C] transition-colors"
                                >
                                    <p className="font-['JetBrains_Mono'] text-[12.5px] text-[#22d3ee] mb-1.5">
                                        {a.type}
                                    </p>
                                    <p className="text-[13.5px] text-[#A1A1AA] leading-relaxed">{a.desc}</p>
                                </motion.div>
                            ))}
                        </motion.div>
                    </Section>

                    {/* ---- Live results ---- */}
                    <Section id="live-results">
                        <Eyebrow icon={Radio}>Real-time</Eyebrow>
                        <H2>Live results</H2>
                        <P>
                            HTTP polling is too slow for watching attacks land. Onyx
                            opens an authenticated WebSocket and streams every result
                            the instant a worker records it — the dashboard's metrics,
                            charts, and endpoint rows update without a refresh.
                        </P>
                        <P>
                            Each event carries the method, endpoint, payload, status
                            code, latency, and computed severity. A typical{" "}
                            <Code>ATTACK_RESULT</Code> frame looks like this:
                        </P>
                        <CodeBlock code={`{\n  "type": "ATTACK_RESULT",\n  "data": {\n    "method": "POST",\n    "endpoint": "/users/login",\n    "statusCode": 500,\n    "latency": 412,\n    "attackType": "SQL_INJECTION",\n    "severity": "CRITICAL"\n  }\n}`} />
                        <div className="grid sm:grid-cols-3 gap-3 mt-6 max-w-[68ch]">
                            {[
                                ["Per-run isolation", "Each run has its own subscriber set — you only ever receive your own results."],
                                ["Heartbeat", "Ping/pong every 30s drops dead connections so the stream stays clean."],
                                ["Ownership-checked", "The server verifies you own a run in the database before allowing a subscription."],
                            ].map(([t, d]) => (
                                <div key={t} className="rounded-xl border border-[#1A1A1A] bg-[#0A0A0A] p-4 hover:border-[#2A2A2A] transition-colors">
                                    <p className="text-[14px] font-medium text-white mb-1">{t}</p>
                                    <p className="text-[12.5px] leading-[1.55] text-[#A1A1AA]">{d}</p>
                                </div>
                            ))}
                        </div>
                    </Section>

                    {/* ---- Scoring ---- */}
                    <Section id="scoring">
                        <Eyebrow icon={Gauge}>Results</Eyebrow>
                        <H2>CVSS severity scoring</H2>
                        <P>
                            Each result is classified by status code and response
                            content. The overall score starts at 100 and deducts per
                            finding — giving you a single 0–100 number to track.
                        </P>
                        <div className="space-y-2 my-6 max-w-[68ch]">
                            {SEVERITY.map((s) => (
                                <div
                                    key={s.label}
                                    className="flex items-start gap-3 rounded-lg border border-[#1A1A1A] bg-[#0A0A0A] p-3.5 hover:border-[#2A2A2A] transition-colors"
                                >
                                    <span
                                        className="shrink-0 mt-0.5 inline-flex items-center justify-center min-w-[68px] text-[10px] font-bold font-['JetBrains_Mono'] tracking-wider uppercase rounded px-2 py-1"
                                        style={{ color: s.color, backgroundColor: `${s.color}1A`, border: `1px solid ${s.color}40` }}
                                    >
                                        {s.label}
                                    </span>
                                    <span className="flex-1 text-[14px] leading-[1.55] text-[#A1A1AA]">{s.rule}</span>
                                    <span className="shrink-0 font-['JetBrains_Mono'] text-[13px] text-white/40">{s.deduct}</span>
                                </div>
                            ))}
                        </div>
                        <P>
                            The final number maps to a label: <Code>CLEAN</Code>{" "}
                            (100), <Code>LOW</Code> (76–99), <Code>MEDIUM</Code>{" "}
                            (51–75), <Code>HIGH</Code> (26–50), and{" "}
                            <Code>CRITICAL</Code> (0–25).
                        </P>
                    </Section>

                    {/* ---- Security ---- */}
                    <Section id="security">
                        <Eyebrow icon={Lock}>Safeguards</Eyebrow>
                        <H2>Security &amp; resilience</H2>
                        <motion.div
                            variants={revealStagger}
                            initial="hidden"
                            whileInView="visible"
                            viewport={{ once: true, margin: "-60px" }}
                            className="grid sm:grid-cols-2 gap-4 my-6 max-w-[68ch]"
                        >
                            {SECURITY_LAYERS.map(([title, body]) => (
                                <motion.div
                                    key={title}
                                    variants={reveal}
                                    className="rounded-xl border border-[#1A1A1A] bg-[#0A0A0A] p-5 hover:border-[#333] transition-colors duration-300"
                                >
                                    <p className="text-[15px] font-medium text-white mb-1.5">{title}</p>
                                    <p className="text-[13.5px] leading-[1.6] text-[#A1A1AA]">{body}</p>
                                </motion.div>
                            ))}
                        </motion.div>
                    </Section>

                    {/* ---- Architecture ---- */}
                    <Section id="architecture">
                        <Eyebrow icon={Network}>Under the hood</Eyebrow>
                        <H2>Architecture</H2>
                        <P>
                            Onyx is a decoupled pipeline: a React client, a guarded
                            Express API, an AI payload stage, a Redis-backed queue,
                            and a worker pool — with Postgres for persistence and
                            WebSockets for telemetry. Each stage hands off to the
                            next, so a slow target never blocks the UI.
                        </P>
                        <motion.div
                            variants={revealStagger}
                            initial="hidden"
                            whileInView="visible"
                            viewport={{ once: true, margin: "-60px" }}
                            className="relative my-6 max-w-[68ch] pl-8"
                        >
                            <span className="absolute left-[14px] top-2 bottom-2 w-px bg-gradient-to-b from-[#22d3ee]/40 via-[#1A1A1A] to-transparent" aria-hidden="true" />
                            {ARCH_STAGES.map(([title, body], i) => (
                                <motion.div key={title} variants={reveal} className="relative pb-6 last:pb-0 group">
                                    <span className="absolute -left-8 top-0 flex items-center justify-center w-7 h-7 rounded-full bg-[#0A0A0A] border border-[#22d3ee]/30 font-['JetBrains_Mono'] text-[11px] text-[#22d3ee] group-hover:border-[#22d3ee]/70 transition-colors">
                                        {String(i + 1).padStart(2, "0")}
                                    </span>
                                    <p className="text-[15px] leading-[1.6] text-[#B4B4B4]">
                                        <span className="text-white font-medium">{title}.</span> {body}
                                    </p>
                                </motion.div>
                            ))}
                        </motion.div>
                        <P>
                            Built on React 18, Express 4, Prisma 7 + Neon Postgres,
                            BullMQ 5 + Redis, Google Gemini 2.5 Flash, and Razorpay
                            for billing.
                        </P>
                    </Section>

                    {/* ---- Plans ---- */}
                    <Section id="plans">
                        <Eyebrow icon={Boxes}>Pricing</Eyebrow>
                        <H2>Plans &amp; quotas</H2>
                        <P>
                            Quotas are checked per calendar month before a run is
                            created. Exceeding a limit returns a{" "}
                            <Code>429 QUOTA_EXCEEDED</Code> with an upgrade link.
                        </P>
                        <div className="overflow-x-auto rounded-xl border border-[#1A1A1A] my-6 max-w-[68ch]">
                            <table className="w-full text-left border-collapse min-w-[440px]">
                                <thead>
                                    <tr className="bg-[#0D0D0D]">
                                        {["Plan", "Price", "Runs", "Endpoints", "PDF"].map((h) => (
                                            <th key={h} className="py-3 px-4 text-[12px] font-['JetBrains_Mono'] uppercase tracking-wider text-white/50 border-b border-[#1A1A1A]">
                                                {h}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {PLANS.map((p) => (
                                        <tr key={p.name} className="bg-[#0A0A0A] hover:bg-[#0D0D0D] transition-colors">
                                            <td className="py-3 px-4 text-[14px] text-white font-medium border-b border-[#141414]">{p.name}</td>
                                            <td className="py-3 px-4 text-[14px] text-[#A1A1AA] border-b border-[#141414]">{p.price}</td>
                                            <td className="py-3 px-4 text-[14px] text-[#A1A1AA] border-b border-[#141414]">{p.runs}</td>
                                            <td className="py-3 px-4 text-[14px] text-[#A1A1AA] border-b border-[#141414]">{p.endpoints}</td>
                                            <td className="py-3 px-4 border-b border-[#141414]">
                                                {p.pdf ? <Check size={15} className="text-[#22d3ee]" /> : <span className="text-white/30">—</span>}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <P>
                            Billing runs through Razorpay with webhook-verified plan
                            upgrades — no manual provisioning. Prices are charged in
                            INR (₹900 / ₹1800 per month).
                        </P>
                    </Section>

                    {/* ---- FAQ (interactive accordion, mirrors FaqCta) ---- */}
                    <Section id="faq">
                        <Eyebrow icon={Terminal}>Questions</Eyebrow>
                        <H2>Frequently asked</H2>
                        <div className="space-y-3 mt-6 max-w-[68ch]">
                            {DOC_FAQ.map((f, i) => {
                                const active = openFaq === i;
                                const panelId = `doc-faq-panel-${i}`;
                                const btnId = `doc-faq-btn-${i}`;
                                return (
                                    <div
                                        key={f.q}
                                        className={`bg-[#0A0A0A] border rounded-xl transition-colors duration-200 ${
                                            active ? "border-[#2A2A2A]" : "border-[#1A1A1A] hover:border-[#2A2A2A]"
                                        }`}
                                    >
                                        <button
                                            id={btnId}
                                            onClick={() => setOpenFaq(active ? null : i)}
                                            aria-expanded={active}
                                            aria-controls={panelId}
                                            className="w-full flex justify-between items-center text-left font-medium text-[15px] leading-snug text-white gap-4 py-4 px-5 cursor-pointer rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22d3ee]/60"
                                        >
                                            <span>{f.q}</span>
                                            <ChevronDown
                                                size={19}
                                                className={`text-neutral-400 shrink-0 transition-transform duration-300 ${active ? "rotate-180" : ""}`}
                                                aria-hidden="true"
                                            />
                                        </button>
                                        <AnimatePresence initial={false}>
                                            {active && (
                                                <motion.div
                                                    id={panelId}
                                                    role="region"
                                                    aria-labelledby={btnId}
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: "auto", opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    transition={{ duration: 0.25, ease: "easeInOut" }}
                                                    className="overflow-hidden"
                                                >
                                                    <p className="px-5 pb-4 text-[14px] leading-[1.65] text-[#A1A1AA]">{f.a}</p>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Closing CTA */}
                        <div className="mt-12 rounded-2xl c5-animated-gradient p-[1.5px] max-w-[68ch]">
                            <div className="rounded-2xl bg-black/50 backdrop-blur-[2px] px-6 py-8 sm:px-8 sm:py-10 text-center">
                                <h3
                                    className="text-white mb-2"
                                    style={{
                                        fontFamily: '"Satoshi Variable", sans-serif',
                                        fontSize: "clamp(1.5rem, 3vw, 2rem)",
                                        letterSpacing: "-0.02em",
                                    }}
                                >
                                    Ready to break your API?
                                </h3>
                                <p className="text-[14px] text-white/70 mb-6">
                                    Start free — no credit card required.
                                </p>
                                <Link
                                    to="/signup"
                                    className="inline-flex items-center justify-center bg-white text-black rounded-full px-6 py-2.5 text-[14px] font-semibold hover:bg-neutral-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-black focus-visible:ring-[#22d3ee] cursor-pointer"
                                >
                                    Get started free
                                </Link>
                            </div>
                        </div>
                    </Section>

                    {/* ---- Glossary ---- */}
                    <Section id="glossary">
                        <Eyebrow icon={BookOpen}>Reference</Eyebrow>
                        <H2>Glossary</H2>
                        <P>
                            Plain-English definitions for the terms used throughout
                            these docs.
                        </P>
                        <dl className="space-y-3 my-6 max-w-[68ch]">
                            {GLOSSARY.map(([term, def]) => (
                                <div
                                    key={term}
                                    className="rounded-xl border border-[#1A1A1A] bg-[#0A0A0A] p-4 hover:border-[#2A2A2A] transition-colors"
                                >
                                    <dt className="text-[14px] font-medium text-white mb-1">{term}</dt>
                                    <dd className="text-[13.5px] leading-[1.6] text-[#A1A1AA]">{def}</dd>
                                </div>
                            ))}
                        </dl>
                    </Section>
                </main>
            </div>
        </div>
    );
};

export default Docs;

// =============================================================================
// Docs — Onyx product documentation, rebuilt as a real docs experience:
// a grouped, searchable left sidebar, a readable content column, and a sticky
// "On this page" tracker on the right. Light-mono system (matches the landing):
// #fafafa surface, hairline borders, sharp corners, Geist headings, JetBrains
// Mono for code/labels, single blue accent. Content sourced from README/WORKFLOW.
// =============================================================================

import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
    ArrowLeft,
    ArrowRight,
    Check,
    Copy,
    ChevronDown,
    FolderOpen,
    Globe,
    Search,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Navigation — grouped for the sidebar; flattened for scroll-spy
// ---------------------------------------------------------------------------
const NAV_GROUPS = [
    {
        group: "Getting started",
        items: [
            { id: "overview", label: "Overview" },
            { id: "quick-start", label: "Quick start" },
            { id: "what-to-paste", label: "What you can paste" },
        ],
    },
    {
        group: "Core concepts",
        items: [
            { id: "verification", label: "Domain verification" },
            { id: "attack-flow", label: "The attack flow" },
            { id: "attack-types", label: "Attack types" },
            { id: "live-results", label: "Live results" },
            { id: "scoring", label: "Severity scoring" },
        ],
    },
    {
        group: "Reference",
        items: [
            { id: "security", label: "Security & resilience" },
            { id: "architecture", label: "Architecture" },
            { id: "plans", label: "Plans & quotas" },
            { id: "faq", label: "FAQ" },
            { id: "glossary", label: "Glossary" },
        ],
    },
] as const;

const SECTIONS = NAV_GROUPS.flatMap((g) => g.items);

// ---------------------------------------------------------------------------
// Content data
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
    { label: "CRITICAL", color: "#dc2626", rule: "5xx on an injection/auth attack, or secrets/DB errors leaked in the response", deduct: "-25" },
    { label: "HIGH", color: "#ea580c", rule: "Any other 5xx, or a 401/403 on an auth-bypass attempt", deduct: "-15" },
    { label: "MEDIUM", color: "#ca8a04", rule: "4xx where the response leaks an error, stack, or trace", deduct: "-8" },
    { label: "LOW", color: "#3b82f6", rule: "Any other 4xx response", deduct: "-3" },
    { label: "INFO", color: "#71717a", rule: "2xx / 3xx / no response, no deduction", deduct: "0" },
];

const PLANS = [
    { name: "Free", price: "$0", runs: "5 / mo", endpoints: "10 / run", pdf: false },
    { name: "Pro", price: "$9 / mo", runs: "100 / mo", endpoints: "50 / run", pdf: true },
    { name: "Team", price: "$18 / mo", runs: "500 / mo", endpoints: "Unlimited", pdf: true },
];

const FLOW = [
    ["Parse", "The spec is fetched with WAF-bypass headers, then every endpoint, parameter, and request body is extracted."],
    ["Generate", "Gemini crafts up to 20 schema-aware payloads per endpoint (with a 35-payload static fallback)."],
    ["Queue", "Payloads are added to a BullMQ Redis queue: 5 concurrent workers, 10 jobs/second, 10s timeout each."],
    ["Fire", "Each worker re-checks SSRF, fires the payload, and records status code, latency, and a response snippet."],
    ["Score", "Every result is classified with CVSS-inspired severity and folded into an overall 0-100 API security score."],
    ["Stream", "Results broadcast live to your dashboard over WebSockets as each attack completes."],
];

const SECURITY_LAYERS = [
    ["SSRF guard", "DNS resolution on every URL before any outbound request. Loopback, private, link-local, and cloud-metadata ranges are blocked at both spec-fetch and attack time."],
    ["Domain ownership gate", "Every run checks for a verified (user, domain) record. No verified record returns a 403 before anything fires."],
    ["Rate limiting", "Auth endpoints: 5 req/min per IP. Attack endpoints: 5 req/hour per IP. Plan quotas enforced per calendar month."],
    ["JWT security", "7-day token expiry; the server hard-crashes on boot if JWT_SECRET is missing, preventing weak-key deployments."],
    ["WAF bypass (fetch only)", "Spec fetch spoofs a real Chrome user-agent so Cloudflare/AWS WAFs don't false-negative during parsing."],
    ["Graceful AI fallback", "If Gemini fails, 35 static payloads keep every scan completing, so the pipeline never stalls."],
];

const QUICK_START = [
    ["Create an account", "Sign up with an email and password. The Free plan needs no credit card and gives you 5 runs a month."],
    ["Paste a spec URL", "Drop your OpenAPI / Swagger URL into the dashboard. Onyx parses every endpoint the moment it loads."],
    ["Verify the domain", "Prove ownership once via a file or DNS record. The Execute Run button unlocks the instant it passes."],
    ["Execute the run", "Onyx generates payloads, queues them, and fires. Watch results stream in live, no refresh needed."],
    ["Review & export", "Triage findings by CVSS severity, drill into any endpoint, and export a PDF report on Pro and Team."],
];

const RUN_PHASES = ["PARSING", "GENERATING", "ATTACKING", "COMPLETED"];

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
    ["SSRF", "Server-Side Request Forgery, which tricks a server into calling internal resources. Onyx blocks it via DNS resolution on every URL."],
    ["CVSS", "Common Vulnerability Scoring System. The industry standard Onyx's severity labels are inspired by."],
    ["BullMQ", "A Redis-backed job queue. Onyx uses it to fire attacks concurrently without overwhelming the target or Node.js."],
    ["WebSocket", "A persistent two-way connection. Onyx streams every attack result over it so the dashboard updates in real time."],
    ["Domain verification", "Proof that you own a target, via a file probe or DNS TXT record, required once before scanning."],
];

const DOC_FAQ = [
    {
        q: "Do I need to own the API I'm testing?",
        a: "Yes. Onyx requires domain ownership verification (via a file probe or DNS TXT record) before it will fire a single payload at any target. This is both a legal protection and a trust layer.",
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
        a: "Up to 20 payloads per endpoint, across a maximum of 20 endpoints per spec, so up to 400 attacks per run. Jobs run through a BullMQ queue capped at 5 concurrent workers and 10 jobs/second.",
    },
];

// ---------------------------------------------------------------------------
// Prose components (light-mono, sharp, no shadows)
// ---------------------------------------------------------------------------
const OnyxMark = ({ size = 22 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect width="24" height="24" fill="black" />
        <path d="M7 7H11V11H7V7Z" fill="white" />
        <path d="M13 13H17V17H13V13Z" fill="white" />
        <path d="M7 13H11V17H7V13Z" fill="white" />
    </svg>
);

const H2 = ({ children }: { children: React.ReactNode }) => (
    <h2 className="text-[30px] leading-tight font-normal tracking-tight text-black mb-4">
        {children}
    </h2>
);

const H3 = ({ children }: { children: React.ReactNode }) => (
    <h3 className="text-[18px] font-medium tracking-tight text-black mt-10 mb-3">
        {children}
    </h3>
);

const P = ({ children }: { children: React.ReactNode }) => (
    <p className="text-[15px] leading-[1.75] text-[#444] max-w-[72ch] mb-4">{children}</p>
);

const Code = ({ children }: { children: React.ReactNode }) => (
    <code className="font-mono text-[13px] text-[#3b82f6] bg-white border border-[#e6e6e6] px-1.5 py-0.5">
        {children}
    </code>
);

const CodeBlock = ({ code }: { code: string }) => {
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
        <div className="relative group my-5 max-w-[72ch]">
            <pre className="font-mono text-[13px] leading-[1.7] text-[#334155] bg-white border border-[#e6e6e6] p-4 pr-12 overflow-x-auto">
                <code>{code}</code>
            </pre>
            <button
                onClick={copy}
                aria-label={copied ? "Copied" : "Copy to clipboard"}
                className="absolute top-3 right-3 flex items-center justify-center w-8 h-8 bg-white border border-[#e6e6e6] text-[#999] hover:text-black hover:border-black transition-colors cursor-pointer"
            >
                {copied ? <Check size={14} className="text-[#16a34a]" /> : <Copy size={14} />}
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
    const styles = {
        info: { border: "border-l-[#3b82f6]", bg: "bg-[#f0f6ff]", dot: "bg-[#3b82f6]" },
        warn: { border: "border-l-[#ea580c]", bg: "bg-[#fff7ed]", dot: "bg-[#ea580c]" },
    }[tone];
    return (
        <div
            className={`border border-[#e6e6e6] border-l-2 ${styles.border} ${styles.bg} p-4 my-5 max-w-[72ch]`}
        >
            <div className="flex items-center gap-2 mb-1.5">
                <span className={`w-2 h-2 ${styles.dot}`} aria-hidden="true" />
                <span className="font-medium text-black text-[14px]">{title}</span>
            </div>
            <p className="text-[14px] leading-[1.65] text-[#555]">{children}</p>
        </div>
    );
};

const Card = ({ children }: { children: React.ReactNode }) => (
    <div className="border border-[#e6e6e6] bg-white p-4 hover:border-black transition-colors">
        {children}
    </div>
);

const Section = ({ id, children }: { id: string; children: React.ReactNode }) => (
    <section id={id} className="scroll-mt-24 pb-14 mb-14 border-b border-[#e6e6e6] last:border-0 last:mb-0">
        {children}
    </section>
);

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
const Docs = () => {
    const navigate = useNavigate();
    const [activeId, setActiveId] = useState<string>(SECTIONS[0].id);
    const [verifyTab, setVerifyTab] = useState<"file" | "dns">("file");
    const [openFaq, setOpenFaq] = useState<number | null>(0);
    const [query, setQuery] = useState("");

    // Scroll-spy — highlight the section currently in view
    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                const visible = entries
                    .filter((e) => e.isIntersecting)
                    .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
                if (visible[0]) setActiveId(visible[0].target.id);
            },
            { rootMargin: "-88px 0px -70% 0px", threshold: 0 },
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

    // Filter the sidebar nav by the search query
    const filteredGroups = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return NAV_GROUPS;
        return NAV_GROUPS.map((g) => ({
            ...g,
            items: g.items.filter((i) => i.label.toLowerCase().includes(q)),
        })).filter((g) => g.items.length > 0);
    }, [query]);

    return (
        <div className="onyx-mono min-h-screen overflow-x-clip">
            {/* Top bar */}
            <header className="sticky top-0 z-40 w-full border-b border-[#e6e6e6] bg-[#fafafa]/90 backdrop-blur-md">
                <div className="max-w-[1400px] mx-auto px-5 sm:px-8 h-14 flex items-center justify-between">
                    <button
                        onClick={() => navigate("/")}
                        className="flex items-center gap-2 shrink-0"
                        aria-label="Onyx home"
                    >
                        <OnyxMark />
                        <span className="font-semibold text-xl tracking-tight">Onyx</span>
                        <span className="border border-[#93c5fd] text-[#3b82f6] font-mono text-[10px] leading-none uppercase px-1.5 py-0.5 ml-1">
                            Docs
                        </span>
                    </button>
                    <div className="flex items-center gap-6 text-sm uppercase font-mono">
                        <button
                            onClick={() => navigate("/")}
                            className="group hidden sm:flex items-center gap-1.5 text-[#666] hover:text-black transition-colors"
                        >
                            <ArrowLeft size={14} className="transition-transform group-hover:-translate-x-0.5" />
                            Home
                        </button>
                        <a
                            href="https://github.com/raghul017/Onyx"
                            target="_blank"
                            rel="noreferrer"
                            className="hidden sm:inline text-[#666] hover:text-black transition-colors"
                        >
                            GitHub
                        </a>
                        <Link to="/signup" className="mono-btn py-2 px-4 text-[12px]">
                            Start free scan
                        </Link>
                    </div>
                </div>
            </header>

            <div className="max-w-[1400px] mx-auto flex">
                {/* -------------------------------------------------------- */}
                {/* Left sidebar — grouped, searchable nav                    */}
                {/* -------------------------------------------------------- */}
                <aside className="hidden lg:block w-64 shrink-0 border-r border-[#e6e6e6]">
                    <div className="sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto py-8 px-6">
                        {/* Search */}
                        <div className="relative mb-6">
                            <Search
                                size={15}
                                className="absolute left-3 top-1/2 -translate-y-1/2 text-[#999]"
                            />
                            <input
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Search docs"
                                className="w-full bg-white border border-[#e6e6e6] h-9 pl-9 pr-3 text-[13px] font-mono text-black placeholder:text-[#999] outline-none focus:border-black transition-colors"
                            />
                        </div>

                        <nav aria-label="Documentation" className="space-y-6">
                            {filteredGroups.map((g) => (
                                <div key={g.group}>
                                    <p className="font-mono text-[11px] uppercase tracking-widest text-[#999] mb-2.5">
                                        {g.group}
                                    </p>
                                    <ul className="space-y-0.5">
                                        {g.items.map((s) => {
                                            const active = activeId === s.id;
                                            return (
                                                <li key={s.id}>
                                                    <button
                                                        onClick={() => scrollTo(s.id)}
                                                        aria-current={active ? "true" : undefined}
                                                        className={`w-full text-left text-[13.5px] px-3 py-1.5 border-l-2 transition-colors ${
                                                            active
                                                                ? "border-[#3b82f6] text-black font-medium bg-white"
                                                                : "border-transparent text-[#666] hover:text-black hover:bg-white"
                                                        }`}
                                                    >
                                                        {s.label}
                                                    </button>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </div>
                            ))}
                            {filteredGroups.length === 0 && (
                                <p className="text-[13px] text-[#999]">No matches.</p>
                            )}
                        </nav>
                    </div>
                </aside>

                {/* -------------------------------------------------------- */}
                {/* Main content                                             */}
                {/* -------------------------------------------------------- */}
                <main className="flex-1 min-w-0 px-6 sm:px-10 lg:px-14 py-12 lg:py-16">
                    {/* Page header */}
                    <div className="mb-14 pb-12 border-b border-[#e6e6e6]">
                        <div className="mono-eyebrow mb-4">
                            <span className="sq" /> DOCUMENTATION
                        </div>
                        <h1 className="text-[clamp(2.25rem,4vw,3.25rem)] leading-[1.05] font-normal tracking-tight text-balance">
                            How Onyx works, end to end.
                        </h1>
                        <p className="text-[17px] leading-7 text-[#555] mt-5 max-w-[64ch]">
                            Everything from the moment you paste a spec URL to the final
                            severity-scored result streaming to your dashboard. The full
                            pipeline, the safeguards, and the answers to the questions
                            people ask most.
                        </p>
                        <div className="flex flex-wrap gap-2 mt-8">
                            {SECTIONS.slice(0, 5).map((s) => (
                                <button
                                    key={s.id}
                                    onClick={() => scrollTo(s.id)}
                                    className="font-mono text-[12px] uppercase tracking-wide text-[#666] border border-[#e6e6e6] hover:border-black hover:text-black px-3 py-1.5 transition-colors"
                                >
                                    {s.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* ---- Overview ---- */}
                    <Section id="overview">
                        <H2>What is Onyx?</H2>
                        <P>
                            Onyx is an AI-native API penetration-testing platform. You
                            provide a link to any API's documentation, an OpenAPI /
                            Swagger specification, and it autonomously verifies
                            ownership, parses every endpoint, generates schema-aware
                            attack payloads with Google Gemini 2.5 Flash, fires them
                            through a rate-limited distributed queue, and streams
                            severity-scored results back live.
                        </P>
                        <P>
                            Unlike a generic fuzzer, Onyx reads your actual schema:
                            request bodies, path parameters, query strings, and asks an
                            LLM to reason about what would break each specific endpoint.
                            The result is context-sensitive coverage across the OWASP Top
                            10 without writing a single test case by hand.
                        </P>
                        <div className="grid grid-cols-2 sm:grid-cols-4 border-t border-l border-[#e6e6e6] mt-8 max-w-[72ch]">
                            {[
                                ["8", "Attack categories"],
                                ["400+", "Payloads / run"],
                                ["5", "Concurrent workers"],
                                ["0-100", "Security score"],
                            ].map(([v, l]) => (
                                <div key={l} className="border-r border-b border-[#e6e6e6] p-4">
                                    <div className="text-[24px] leading-none mb-1.5 tabular-nums">{v}</div>
                                    <div className="text-[12px] text-[#666]">{l}</div>
                                </div>
                            ))}
                        </div>
                    </Section>

                    {/* ---- Quick start ---- */}
                    <Section id="quick-start">
                        <H2>Quick start</H2>
                        <P>
                            Five steps take you from sign-up to a live, scored attack
                            run. Each one is covered in more depth further down.
                        </P>
                        <div className="border-t border-l border-[#e6e6e6] my-6 max-w-[72ch]">
                            {QUICK_START.map(([title, body], i) => (
                                <div
                                    key={title}
                                    className="flex gap-4 border-r border-b border-[#e6e6e6] p-4 bg-white"
                                >
                                    <span className="shrink-0 flex items-center justify-center w-8 h-8 bg-[#3b82f6] text-white font-mono text-[13px]">
                                        {i + 1}
                                    </span>
                                    <div>
                                        <p className="text-[15px] font-medium text-black mb-0.5">{title}</p>
                                        <p className="text-[13.5px] leading-[1.6] text-[#666]">{body}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <Callout tone="info" title="No setup, no agents">
                            Onyx runs entirely from the spec URL. There's nothing to
                            install on your servers and no SDK to wire in. If your API
                            publishes an OpenAPI document, you're ready.
                        </Callout>
                    </Section>

                    {/* ---- What to paste ---- */}
                    <Section id="what-to-paste">
                        <H2>What you can paste</H2>
                        <P>
                            Every modern API ships a machine-readable spec describing its
                            endpoints, parameters, and response formats, written in
                            OpenAPI (formerly Swagger). Most APIs expose it at a path
                            like <Code>/openapi.json</Code>, <Code>/swagger.json</Code>,
                            or <Code>/v2/api-docs</Code>.
                        </P>
                        <div className="grid sm:grid-cols-2 gap-4 my-6 max-w-[72ch]">
                            <Card>
                                <p className="text-[13px] font-medium text-[#16a34a] mb-3 font-mono uppercase tracking-wide">
                                    Valid targets
                                </p>
                                <ul className="space-y-2 font-mono text-[12.5px] text-[#555] leading-relaxed">
                                    <li>petstore.swagger.io/v2/swagger.json</li>
                                    <li>api.example.com/openapi.json</li>
                                    <li>httpbin.org/spec.json</li>
                                </ul>
                            </Card>
                            <Card>
                                <p className="text-[13px] font-medium text-[#ea580c] mb-3 font-mono uppercase tracking-wide">
                                    Blocked
                                </p>
                                <ul className="space-y-2 font-mono text-[12.5px] text-[#555] leading-relaxed">
                                    <li>google.com (HTML, not a spec)</li>
                                    <li>192.168.1.5/api (private IP, SSRF)</li>
                                    <li>any domain you don't own</li>
                                </ul>
                            </Card>
                        </div>
                        <Callout tone="warn" title="SSRF protection is strictly enforced">
                            Onyx performs DNS resolution on every URL. Any hostname
                            resolving to <Code>127.x</Code>, <Code>10.x</Code>,{" "}
                            <Code>172.16-31.x</Code>, <Code>192.168.x</Code>,{" "}
                            <Code>169.254.x</Code>, <Code>.local</Code>, or{" "}
                            <Code>.internal</Code> is instantly blocked.
                        </Callout>
                        <H3>Can't find your spec URL?</H3>
                        <P>
                            If your team uses Swagger UI, the spec is the JSON the UI
                            loads. Open the network tab and look for the{" "}
                            <Code>.json</Code> request, or try appending one of these
                            common paths to your API's base URL:
                        </P>
                        <CodeBlock code={`/openapi.json\n/swagger.json\n/v2/api-docs\n/v3/api-docs\n/swagger/v1/swagger.json`} />
                    </Section>

                    {/* ---- Verification ---- */}
                    <Section id="verification">
                        <H2>Domain ownership verification</H2>
                        <P>
                            Before Onyx fires a single payload, you must prove you own
                            the target domain. Without it, anyone could point Onyx at
                            someone else's API. Verification closes that liability and is
                            required once per domain, per account.
                        </P>
                        <div className="inline-flex items-center border border-[#e6e6e6] bg-white my-5">
                            {([
                                ["file", "File probe", FolderOpen],
                                ["dns", "DNS record", Globe],
                            ] as const).map(([key, label, Icon]) => {
                                const active = verifyTab === key;
                                return (
                                    <button
                                        key={key}
                                        onClick={() => setVerifyTab(key)}
                                        className={`flex items-center gap-2 text-[13px] px-4 py-2 transition-colors ${
                                            active
                                                ? "bg-black text-white"
                                                : "text-[#666] hover:text-black"
                                        }`}
                                    >
                                        <Icon size={14} />
                                        {label}
                                    </button>
                                );
                            })}
                        </div>
                        <AnimatePresence mode="wait">
                            {verifyTab === "file" ? (
                                <motion.div
                                    key="file"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ duration: 0.15 }}
                                >
                                    <P>
                                        Host a file containing only your verification
                                        token at this exact path. No quotes, no extra
                                        whitespace, nothing else:
                                    </P>
                                    <CodeBlock code={`https://your-domain.com/.well-known/onyx-verify.txt\n\nonyx-verify-a3f9c2b1...`} />
                                </motion.div>
                            ) : (
                                <motion.div
                                    key="dns"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ duration: 0.15 }}
                                >
                                    <P>
                                        No file hosting? Add a TXT record to your domain's
                                        DNS instead:
                                    </P>
                                    <CodeBlock code={`Type:   TXT\nName:   _onyx-verify.your-domain.com\nValue:  onyx-verify-a3f9c2b1...`} />
                                </motion.div>
                            )}
                        </AnimatePresence>
                        <Callout tone="info" title="Verification is permanent">
                            Once verified, a domain stays verified for your account. You
                            can delete the file or DNS record afterward. DNS can take a
                            few minutes to propagate; if a check fails right after saving
                            the record, wait and retry.
                        </Callout>
                        <H3>What actually happens</H3>
                        <P>
                            Onyx extracts the hostname from your URL, generates a unique{" "}
                            <Code>onyx-verify-&lt;token&gt;</Code>, and stores it against
                            your account. When you click <Code>Check Verification</Code>,
                            it probes the file over HTTPS first (retrying over HTTP if the
                            connection fails), then falls back to a DNS TXT lookup.
                            Whichever it finds first wins, and the run button unlocks.
                        </P>
                        <P>
                            Until a domain is verified, every attempt to scan it is
                            rejected before a single request leaves the server:
                        </P>
                        <CodeBlock code={`POST /api/test-runs  ->  403 Forbidden\n\n{\n  "error": "DOMAIN_NOT_VERIFIED",\n  "domain": "target-api.com",\n  "message": "You must verify ownership of\n              \\"target-api.com\\" before scanning it."\n}`} />
                    </Section>

                    {/* ---- Attack flow ---- */}
                    <Section id="attack-flow">
                        <H2>The attack flow</H2>
                        <P>
                            End to end, from clicking <Code>Execute Run</Code> to
                            receiving live results:
                        </P>
                        <ol className="relative my-6 max-w-[72ch] pl-8">
                            <span className="absolute left-[13px] top-2 bottom-2 w-px bg-[#e6e6e6]" aria-hidden="true" />
                            {FLOW.map(([title, body], i) => (
                                <li key={title} className="relative pb-6 last:pb-0">
                                    <span className="absolute -left-8 top-0 flex items-center justify-center w-7 h-7 bg-white border border-[#e6e6e6] font-mono text-[11px] text-[#3b82f6]">
                                        {String(i + 1).padStart(2, "0")}
                                    </span>
                                    <p className="text-[15px] leading-[1.6] text-[#444]">
                                        <span className="text-black font-medium">{title}.</span> {body}
                                    </p>
                                </li>
                            ))}
                        </ol>
                        <H3>Run status phases</H3>
                        <P>
                            As a run progresses, its status moves through four phases, and
                            the dashboard reflects each one live:
                        </P>
                        <div className="flex flex-wrap items-center gap-2 my-5 max-w-[72ch]">
                            {RUN_PHASES.map((phase, i) => (
                                <div key={phase} className="flex items-center gap-2">
                                    <span className="font-mono text-[11px] tracking-wider uppercase text-[#3b82f6] border border-[#93c5fd] px-2.5 py-1">
                                        {phase}
                                    </span>
                                    {i < RUN_PHASES.length - 1 && (
                                        <ArrowRight size={13} className="text-[#ccc]" aria-hidden="true" />
                                    )}
                                </div>
                            ))}
                        </div>
                    </Section>

                    {/* ---- Attack types ---- */}
                    <Section id="attack-types">
                        <H2>Attack types generated</H2>
                        <P>
                            Gemini produces strictly-typed JSON payloads across eight
                            categories, each tuned to the endpoint under test:
                        </P>
                        <div className="grid sm:grid-cols-2 border-t border-l border-[#e6e6e6] my-6 max-w-[72ch]">
                            {ATTACK_TYPES.map((a) => (
                                <div
                                    key={a.type}
                                    className="border-r border-b border-[#e6e6e6] p-4 bg-white hover:bg-[#f6f9ff] transition-colors"
                                >
                                    <p className="font-mono text-[12.5px] text-[#3b82f6] mb-1.5">{a.type}</p>
                                    <p className="text-[13.5px] text-[#666] leading-relaxed">{a.desc}</p>
                                </div>
                            ))}
                        </div>
                    </Section>

                    {/* ---- Live results ---- */}
                    <Section id="live-results">
                        <H2>Live results</H2>
                        <P>
                            HTTP polling is too slow for watching attacks land. Onyx
                            opens an authenticated WebSocket and streams every result the
                            instant a worker records it, and the dashboard's metrics,
                            charts, and endpoint rows update without a refresh.
                        </P>
                        <P>
                            Each event carries the method, endpoint, payload, status
                            code, latency, and computed severity. A typical{" "}
                            <Code>ATTACK_RESULT</Code> frame looks like this:
                        </P>
                        <CodeBlock code={`{\n  "type": "ATTACK_RESULT",\n  "data": {\n    "method": "POST",\n    "endpoint": "/users/login",\n    "statusCode": 500,\n    "latency": 412,\n    "attackType": "SQL_INJECTION",\n    "severity": "CRITICAL"\n  }\n}`} />
                        <div className="grid sm:grid-cols-3 gap-3 mt-6 max-w-[72ch]">
                            {[
                                ["Per-run isolation", "Each run has its own subscriber set, so you only ever receive your own results."],
                                ["Heartbeat", "Ping/pong every 30s drops dead connections so the stream stays clean."],
                                ["Ownership-checked", "The server verifies you own a run in the database before allowing a subscription."],
                            ].map(([t, d]) => (
                                <Card key={t}>
                                    <p className="text-[14px] font-medium text-black mb-1">{t}</p>
                                    <p className="text-[12.5px] leading-[1.55] text-[#666]">{d}</p>
                                </Card>
                            ))}
                        </div>
                    </Section>

                    {/* ---- Scoring ---- */}
                    <Section id="scoring">
                        <H2>CVSS severity scoring</H2>
                        <P>
                            Each result is classified by status code and response
                            content. The overall score starts at 100 and deducts per
                            finding, giving you a single 0-100 number to track.
                        </P>
                        <div className="border border-[#e6e6e6] my-6 max-w-[72ch]">
                            {SEVERITY.map((s, i) => (
                                <div
                                    key={s.label}
                                    className={`flex items-start gap-3 p-3.5 bg-white ${
                                        i < SEVERITY.length - 1 ? "border-b border-[#e6e6e6]" : ""
                                    }`}
                                >
                                    <span
                                        className="shrink-0 mt-0.5 inline-flex items-center justify-center min-w-[68px] text-[10px] font-bold font-mono tracking-wider uppercase px-2 py-1"
                                        style={{
                                            color: s.color,
                                            border: `1px solid ${s.color}55`,
                                        }}
                                    >
                                        {s.label}
                                    </span>
                                    <span className="flex-1 text-[14px] leading-[1.55] text-[#555]">{s.rule}</span>
                                    <span className="shrink-0 font-mono text-[13px] text-[#999] tabular-nums">{s.deduct}</span>
                                </div>
                            ))}
                        </div>
                        <P>
                            The final number maps to a label: <Code>CLEAN</Code> (100),{" "}
                            <Code>LOW</Code> (76-99), <Code>MEDIUM</Code> (51-75),{" "}
                            <Code>HIGH</Code> (26-50), and <Code>CRITICAL</Code> (0-25).
                        </P>
                    </Section>

                    {/* ---- Security ---- */}
                    <Section id="security">
                        <H2>Security &amp; resilience</H2>
                        <P>
                            Every run is fenced by layered guards, checked before and
                            during the attack, so Onyx only ever hits the API you own.
                        </P>
                        <div className="grid sm:grid-cols-2 border-t border-l border-[#e6e6e6] my-6 max-w-[72ch]">
                            {SECURITY_LAYERS.map(([title, body]) => (
                                <div key={title} className="border-r border-b border-[#e6e6e6] p-5 bg-white">
                                    <p className="text-[15px] font-medium text-black mb-1.5">{title}</p>
                                    <p className="text-[13.5px] leading-[1.6] text-[#666]">{body}</p>
                                </div>
                            ))}
                        </div>
                    </Section>

                    {/* ---- Architecture ---- */}
                    <Section id="architecture">
                        <H2>Architecture</H2>
                        <P>
                            Onyx is a decoupled pipeline: a React client, a guarded
                            Express API, an AI payload stage, a Redis-backed queue, and a
                            worker pool, with Postgres for persistence and WebSockets for
                            telemetry. Each stage hands off to the next, so a slow target
                            never blocks the UI.
                        </P>
                        <ol className="relative my-6 max-w-[72ch] pl-8">
                            <span className="absolute left-[13px] top-2 bottom-2 w-px bg-[#e6e6e6]" aria-hidden="true" />
                            {ARCH_STAGES.map(([title, body], i) => (
                                <li key={title} className="relative pb-6 last:pb-0">
                                    <span className="absolute -left-8 top-0 flex items-center justify-center w-7 h-7 bg-white border border-[#e6e6e6] font-mono text-[11px] text-[#3b82f6]">
                                        {String(i + 1).padStart(2, "0")}
                                    </span>
                                    <p className="text-[15px] leading-[1.6] text-[#444]">
                                        <span className="text-black font-medium">{title}.</span> {body}
                                    </p>
                                </li>
                            ))}
                        </ol>
                        <P>
                            Built on React 18, Express 4, Prisma 7 + Neon Postgres,
                            BullMQ 5 + Redis, Google Gemini 2.5 Flash, and Razorpay for
                            billing.
                        </P>
                    </Section>

                    {/* ---- Plans ---- */}
                    <Section id="plans">
                        <H2>Plans &amp; quotas</H2>
                        <P>
                            Quotas are checked per calendar month before a run is created.
                            Exceeding a limit returns a <Code>429 QUOTA_EXCEEDED</Code>{" "}
                            with an upgrade link.
                        </P>
                        <div className="overflow-x-auto border border-[#e6e6e6] my-6 max-w-[72ch]">
                            <table className="w-full text-left border-collapse min-w-[440px]">
                                <thead>
                                    <tr className="bg-white">
                                        {["Plan", "Price", "Runs", "Endpoints", "PDF"].map((h) => (
                                            <th
                                                key={h}
                                                className="py-3 px-4 text-[11px] font-mono uppercase tracking-wider text-[#999] border-b border-[#e6e6e6]"
                                            >
                                                {h}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {PLANS.map((p) => (
                                        <tr key={p.name} className="bg-white">
                                            <td className="py-3 px-4 text-[14px] text-black font-medium border-b border-[#e6e6e6]">{p.name}</td>
                                            <td className="py-3 px-4 text-[14px] text-[#666] border-b border-[#e6e6e6]">{p.price}</td>
                                            <td className="py-3 px-4 text-[14px] text-[#666] border-b border-[#e6e6e6]">{p.runs}</td>
                                            <td className="py-3 px-4 text-[14px] text-[#666] border-b border-[#e6e6e6]">{p.endpoints}</td>
                                            <td className="py-3 px-4 border-b border-[#e6e6e6]">
                                                {p.pdf ? <Check size={15} className="text-[#3b82f6]" /> : <span className="text-[#ccc]">-</span>}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <P>
                            Billing runs through Razorpay with webhook-verified plan
                            upgrades, with no manual provisioning. Prices are charged in
                            INR (₹900 / ₹1800 per month).
                        </P>
                    </Section>

                    {/* ---- FAQ ---- */}
                    <Section id="faq">
                        <H2>Frequently asked</H2>
                        <div className="border-t border-[#e6e6e6] mt-6 max-w-[72ch]">
                            {DOC_FAQ.map((f, i) => {
                                const active = openFaq === i;
                                const panelId = `doc-faq-panel-${i}`;
                                const btnId = `doc-faq-btn-${i}`;
                                return (
                                    <div key={f.q} className="border-b border-[#e6e6e6]">
                                        <button
                                            id={btnId}
                                            onClick={() => setOpenFaq(active ? null : i)}
                                            aria-expanded={active}
                                            aria-controls={panelId}
                                            className="w-full flex justify-between items-center text-left text-[15px] text-black gap-4 py-4 cursor-pointer hover:opacity-70 transition-opacity"
                                        >
                                            <span>{f.q}</span>
                                            <ChevronDown
                                                size={18}
                                                className={`text-[#666] shrink-0 transition-transform duration-300 ${active ? "rotate-180" : ""}`}
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
                                                    <p className="pb-4 text-[14px] leading-[1.65] text-[#555] max-w-[64ch]">{f.a}</p>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Closing CTA */}
                        <div className="mt-12 border border-[#e6e6e6] bg-white p-8 sm:p-10 max-w-[72ch] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                            <div>
                                <h3 className="text-[24px] leading-tight font-normal tracking-tight mb-1">
                                    Ready to break your API?
                                </h3>
                                <p className="text-[14px] text-[#666]">
                                    Start free. No credit card required.
                                </p>
                            </div>
                            <Link to="/signup" className="mono-btn shrink-0">
                                Start free scan
                                <ArrowRight size={14} />
                            </Link>
                        </div>
                    </Section>

                    {/* ---- Glossary ---- */}
                    <Section id="glossary">
                        <H2>Glossary</H2>
                        <P>Plain-English definitions for the terms used throughout these docs.</P>
                        <dl className="border-t border-l border-[#e6e6e6] grid sm:grid-cols-2 my-6 max-w-[72ch]">
                            {GLOSSARY.map(([term, def]) => (
                                <div key={term} className="border-r border-b border-[#e6e6e6] p-4 bg-white">
                                    <dt className="text-[14px] font-medium text-black mb-1">{term}</dt>
                                    <dd className="text-[13.5px] leading-[1.6] text-[#666]">{def}</dd>
                                </div>
                            ))}
                        </dl>
                    </Section>
                </main>

                {/* -------------------------------------------------------- */}
                {/* Right — "On this page" tracker                            */}
                {/* -------------------------------------------------------- */}
                <aside className="hidden xl:block w-56 shrink-0 border-l border-[#e6e6e6]">
                    <div className="sticky top-14 py-12 px-6">
                        <p className="font-mono text-[11px] uppercase tracking-widest text-[#999] mb-3">
                            On this page
                        </p>
                        <ul className="space-y-1.5">
                            {SECTIONS.map((s) => {
                                const active = activeId === s.id;
                                return (
                                    <li key={s.id}>
                                        <button
                                            onClick={() => scrollTo(s.id)}
                                            className={`text-left text-[12.5px] leading-snug transition-colors ${
                                                active
                                                    ? "text-[#3b82f6] font-medium"
                                                    : "text-[#999] hover:text-black"
                                            }`}
                                        >
                                            {s.label}
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                </aside>
            </div>
        </div>
    );
};

export default Docs;

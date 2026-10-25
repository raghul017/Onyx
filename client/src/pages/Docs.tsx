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
// `keywords` widen the sidebar search beyond the visible label.
type DocNavItem = { id: string; label: string; keywords?: string };
type DocNavGroup = { group: string; items: DocNavItem[] };

const NAV_GROUPS: DocNavGroup[] = [
    {
        group: "Getting started",
        items: [
            { id: "overview", label: "Overview" },
            { id: "quick-start", label: "Quick start", keywords: "setup start begin" },
            { id: "what-to-paste", label: "What you can paste", keywords: "openapi swagger spec url" },
            { id: "verification", label: "Domain verification", keywords: "dns txt file ownership verify" },
        ],
    },
    {
        group: "Running scans",
        items: [
            { id: "attack-flow", label: "The scan pipeline", keywords: "phases status flow" },
            { id: "authenticated", label: "Authenticated scanning", keywords: "login token cookie api key oauth recipe credential" },
            { id: "identities", label: "Multiple identities", keywords: "bola bfla user cross authorization" },
            { id: "live-results", label: "Live results", keywords: "websocket stream realtime" },
        ],
    },
    {
        group: "Findings",
        items: [
            { id: "attack-types", label: "What Onyx checks", keywords: "attack types categories" },
            { id: "findings", label: "Reading a finding", keywords: "evidence remediation fix confidence framework" },
            { id: "owasp", label: "OWASP API Top 10", keywords: "coverage api1 api5" },
            { id: "scoring", label: "Severity & score", keywords: "cvss critical high score" },
            { id: "verify-fix", label: "Verify a fix", keywords: "rescan re-scan resolved" },
        ],
    },
    {
        group: "Share & automate",
        items: [
            { id: "sharing", label: "Reports & sharing", keywords: "pdf export public link revoke" },
            { id: "cli", label: "API tokens & CLI", keywords: "terminal sarif json exit code token" },
            { id: "github-action", label: "GitHub Action", keywords: "ci cd pull request security tab" },
        ],
    },
    {
        group: "Reference",
        items: [
            { id: "security", label: "Security & resilience", keywords: "ssrf safety encryption" },
            { id: "architecture", label: "Architecture", keywords: "stack gemini bullmq redis" },
            { id: "plans", label: "Plans & quotas", keywords: "pricing billing limits" },
            { id: "faq", label: "FAQ" },
            { id: "glossary", label: "Glossary", keywords: "terms definitions" },
        ],
    },
];

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

const AUTH_CHECKS = [
    { type: "BOLA", owasp: "API1", desc: "One user's object is requested as a different user, and the two responses are compared" },
    { type: "BFLA", owasp: "API5", desc: "Privileged or admin endpoints are called as a lower-privileged identity" },
    { type: "MASS_ASSIGNMENT", owasp: "API3", desc: "Privileged fields added to a valid write are checked for being accepted" },
    { type: "DATA_EXPOSURE", owasp: "API3", desc: "Responses are scanned for hashes, tokens, card or ID numbers, and bulk personal data" },
];

const SEVERITY = [
    { label: "CRITICAL", color: "#dc2626", rule: "Confirmed cross-user data access, an injection or file read the response proves, an auth bypass, or a leaked credential", deduct: "-25" },
    { label: "HIGH", color: "#ea580c", rule: "Reflected XSS, accepted privileged fields, an unconfirmed authorization gap, or a server crash on test input", deduct: "-15" },
    { label: "MEDIUM", color: "#ca8a04", rule: "Verbose errors or stack traces, or a likely blind injection worth a closer look", deduct: "-8" },
    { label: "LOW", color: "#3b82f6", rule: "A weak signal worth reviewing", deduct: "-3" },
    { label: "INFO", color: "#64748b", rule: "The request was handled correctly. No deduction", deduct: "0" },
];

const FINDING_PARTS = [
    ["Category", "The class of issue, for example SQL Injection or Broken Function Level Authorization."],
    ["Cause", "A plain-English explanation of why the response counts as a problem."],
    ["Evidence", "The exact signal that triggered it: status, timing, or a redacted response snippet."],
    ["Fix", "How to close it, with a code snippet for your framework where a vetted one exists."],
    ["Confidence", "Confirmed, Likely, or Possible, so you know what to fix first."],
    ["OWASP label", "The OWASP API Security Top 10 (2023) category the finding maps to."],
];

const OWASP_ACTIVE = [
    ["API1", "Broken Object Level Authorization"],
    ["API2", "Broken Authentication"],
    ["API3", "Broken Object Property Level Authorization"],
    ["API4", "Unrestricted Resource Consumption"],
    ["API5", "Broken Function Level Authorization"],
    ["API8", "Security Misconfiguration"],
];

const OWASP_MAPPED = [
    ["API6", "Unrestricted Access to Sensitive Business Flows"],
    ["API7", "Server Side Request Forgery"],
    ["API9", "Improper Inventory Management"],
    ["API10", "Unsafe Consumption of APIs"],
];

const AUTH_RECIPES = [
    ["Bearer token", "Sent as Authorization: Bearer."],
    ["API key", "Sent in a header or query parameter you name."],
    ["Custom header", "Any header name and value."],
    ["Cookie", "A session cookie sent with every request."],
    ["Login request", "Onyx calls your login endpoint and reads the token from the response."],
    ["OAuth2 client credentials", "Onyx fetches an access token from your token URL."],
];

const CLI_EXIT = [
    ["0", "Scan finished with no finding at or above --fail-on."],
    ["1", "Scan finished with at least one finding at or above --fail-on."],
    ["2", "Operational failure: bad token, unverified domain, failed run, timeout, or network error."],
];

const PLANS = [
    { name: "Free", price: "$0", runs: "5 / mo", endpoints: "10 / run", pdf: false },
    { name: "Pro", price: "$9 / mo", runs: "100 / mo", endpoints: "50 / run", pdf: true },
    { name: "Team", price: "$18 / mo", runs: "500 / mo", endpoints: "Unlimited", pdf: true },
];

const FLOW = [
    ["Parse", "The spec is fetched with WAF-bypass headers, then every endpoint, parameter, and request body is extracted."],
    ["Generate", "Gemini writes up to 20 schema-aware test payloads per endpoint, with a 36-payload built-in fallback."],
    ["Baseline", "On paid plans, one normal request per endpoint is captured first, so test responses can be compared against it."],
    ["Queue", "Requests go onto a BullMQ Redis queue: 12 concurrent workers, about 30 requests a second, 10s timeout each."],
    ["Fire", "Each worker re-checks SSRF, sends the request, and records status code, latency, and a redacted response snippet."],
    ["Analyze", "Every result becomes an explained finding. With two identities, cross-user checks run too."],
    ["Stream", "Results broadcast live to your dashboard over WebSockets, and the run gets a final 0-100 score."],
];

const SECURITY_LAYERS = [
    ["SSRF guard", "DNS resolution on every URL before any outbound request. Loopback, private, link-local, and cloud-metadata ranges are blocked at both spec-fetch and attack time."],
    ["Domain ownership gate", "Every run checks for a verified (user, domain) record. No verified record returns a 403 before anything fires."],
    ["Rate limiting", "Auth endpoints: 5 req/min per IP. Attack endpoints: 5 req/hour per IP. Plan quotas enforced per calendar month."],
    ["JWT security", "7-day token expiry; the server hard-crashes on boot if JWT_SECRET is missing, preventing weak-key deployments."],
    ["WAF bypass (fetch only)", "Spec fetch spoofs a real Chrome user-agent so Cloudflare/AWS WAFs don't false-negative during parsing."],
    ["Encrypted credentials", "Auth recipe secrets are encrypted at rest (AES-256-GCM). API tokens are stored only as hashes."],
    ["Redacted evidence", "Response snippets are redacted before they are stored or streamed, so secrets never land in a report."],
    ["Graceful AI fallback", "If Gemini fails, 36 built-in payloads keep every scan completing, so the pipeline never stalls."],
    ["AI can't invent findings", "Where AI interprets a result, it can only confirm or veto what the rules found. It never raises a finding alone."],
];

const QUICK_START = [
    ["Create an account", "Sign up with an email and password. The Free plan needs no credit card and gives you 5 runs a month."],
    ["Paste a spec URL", "Drop your OpenAPI / Swagger URL into the dashboard. Onyx parses every endpoint the moment it loads."],
    ["Verify the domain", "Prove ownership once via a file or DNS record. The launch button unlocks the instant it passes."],
    ["Add a login (optional)", "Pick a saved credential so the scan reaches what sits behind your login."],
    ["Launch the scan", "Onyx generates payloads, queues them, and fires. Watch results stream in live, no refresh needed."],
    ["Review & fix", "Open any finding for evidence and a fix, then use Verify fix to confirm it's closed."],
];

const RUN_PHASES = ["PARSING", "GENERATING", "ATTACKING", "COMPLETED"];

const ARCH_STAGES = [
    ["Client", "React + Vite on Vercel. Submits the spec URL and subscribes to the run over a WebSocket."],
    ["API + guards", "Express on Render. Auth, rate-limit, quota, domain gate, and SSRF checks run before anything fires."],
    ["Gemini", "Gemini 3.5 Flash-Lite generates the payload set per endpoint, with a built-in fallback if the model is unavailable."],
    ["BullMQ + Redis", "A job queue fans requests out to 12 concurrent workers at about 30 a second, surviving restarts."],
    ["Workers", "Send each request, analyze the response into an explained finding, and persist it."],
    ["Postgres + WS", "Results are written to Neon Postgres via Prisma and broadcast live to the browser."],
];

const GLOSSARY = [
    ["OpenAPI / Swagger", "A machine-readable description of an API's endpoints, parameters, and responses. Onyx's only required input."],
    ["SSRF", "Server-Side Request Forgery, which tricks a server into calling internal resources. Onyx blocks it via DNS resolution on every URL."],
    ["CVSS", "Common Vulnerability Scoring System. The industry standard Onyx's severity labels are inspired by."],
    ["BullMQ", "A Redis-backed job queue. Onyx uses it to fire attacks concurrently without overwhelming the target or Node.js."],
    ["WebSocket", "A persistent two-way connection. Onyx streams every attack result over it so the dashboard updates in real time."],
    ["Domain verification", "Proof that you own a target, via a file probe or DNS TXT record, required once before scanning."],
    ["BOLA", "Broken Object Level Authorization (OWASP API1). One user can read another user's data by changing an id."],
    ["BFLA", "Broken Function Level Authorization (OWASP API5). A regular user can call an admin-only endpoint."],
    ["Auth recipe", "A saved, encrypted credential Onyx attaches to a scan so it can test behind your login."],
    ["Baseline", "One normal request per endpoint, captured so test responses can be compared against it."],
    ["SARIF", "Static Analysis Results Interchange Format. The file GitHub's Security tab reads findings from."],
    ["API token", "A long-lived key for the CLI and CI. It acts as you and can be revoked at any time."],
];

const DOC_FAQ = [
    {
        q: "Do I need to own the API I'm testing?",
        a: "Yes. Onyx requires domain ownership verification (via a file probe or DNS TXT record) before it will fire a single payload at any target. This is both a legal protection and a trust layer.",
    },
    {
        q: "What happens if Gemini is unavailable?",
        a: "The pipeline never stalls. If the Gemini API is busy or not configured, Onyx falls back to 36 built-in payloads covering every category, so your scan still completes.",
    },
    {
        q: "Is it safe to run against production?",
        a: "Onyx enforces SSRF protection, per-plan rate limiting, and a 10-second per-request timeout. Even so, we recommend testing against staging, with test accounts, where possible.",
    },
    {
        q: "How many requests will Onyx send?",
        a: "Up to 20 payloads per endpoint, across a maximum of 20 endpoints per spec, so up to 400 test requests per run, plus a few baseline and cross-user checks. They run through a queue capped at 12 concurrent workers and about 30 requests a second.",
    },
    {
        q: "Do I need two accounts for authorization testing?",
        a: "Yes. BOLA and BFLA checks compare what two identities can do, so add a second signed-in test account under Identities. With one identity, every other check still runs.",
    },
    {
        q: "Can I run Onyx in CI?",
        a: "Yes. Create an API token in Settings, then use the CLI or the GitHub Action. Both fail the build on the severity you choose and can write SARIF for GitHub's Security tab.",
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
    <section id={id} className="scroll-mt-32 lg:scroll-mt-24 pb-14 mb-14 border-b border-[#e6e6e6] last:border-0 last:mb-0">
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
            items: g.items.filter((i) =>
                `${i.label} ${i.keywords ?? ""}`.toLowerCase().includes(q),
            ),
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

            {/* Mobile section jump — the sidebar and tracker are hidden below lg */}
            <div className="lg:hidden sticky top-14 z-30 border-b border-[#e6e6e6] bg-[#fafafa]/90 backdrop-blur-md">
                <div className="px-5 sm:px-8 py-2.5">
                    <label htmlFor="docs-jump" className="sr-only">
                        Jump to section
                    </label>
                    <div className="relative">
                        <select
                            id="docs-jump"
                            value={activeId}
                            onChange={(e) => scrollTo(e.target.value)}
                            className="w-full appearance-none bg-white border border-[#e6e6e6] h-10 pl-3 pr-9 text-[13px] font-mono text-black outline-none focus:border-black transition-colors cursor-pointer"
                        >
                            {NAV_GROUPS.map((g) => (
                                <optgroup key={g.group} label={g.group}>
                                    {g.items.map((s) => (
                                        <option key={s.id} value={s.id}>
                                            {s.label}
                                        </option>
                                    ))}
                                </optgroup>
                            ))}
                        </select>
                        <ChevronDown
                            size={15}
                            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#666]"
                            aria-hidden="true"
                        />
                    </div>
                </div>
            </div>

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
                            test payloads with Google Gemini 3.5 Flash-Lite, sends them
                            through a rate-limited queue, and streams explained,
                            severity-scored findings back live.
                        </P>
                        <P>
                            Unlike a generic fuzzer, Onyx reads your actual schema:
                            request bodies, path parameters, query strings, and tailors
                            tests to each endpoint. It can scan behind your login, compare
                            what two users can see, and map every finding to the OWASP API
                            Security Top 10, with evidence and a fix.
                        </P>
                        <div className="grid grid-cols-2 sm:grid-cols-4 border-t border-l border-[#e6e6e6] mt-8 max-w-[72ch]">
                            {[
                                ["12", "Check types"],
                                ["6 / 10", "OWASP actively tested"],
                                ["400", "Requests / run, max"],
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
                            Six steps take you from sign-up to a live, scored scan. Each
                            one is covered in more depth further down.
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
                        <H2>The scan pipeline</H2>
                        <P>
                            End to end, from clicking <Code>Launch scan</Code> to
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

                    {/* ---- Authenticated scanning ---- */}
                    <Section id="authenticated">
                        <H2>Authenticated scanning</H2>
                        <P>
                            Most real issues sit behind a login. Save a credential once
                            as an <span className="text-black font-medium">auth recipe</span>{" "}
                            in <Code>Settings</Code>, then pick it in the dashboard
                            toolbar before you launch. Every request in the scan carries
                            it, so Onyx tests what your signed-in users can reach.
                        </P>
                        <div className="grid sm:grid-cols-2 border-t border-l border-[#e6e6e6] my-6 max-w-[72ch]">
                            {AUTH_RECIPES.map(([name, desc]) => (
                                <div key={name} className="border-r border-b border-[#e6e6e6] p-4 bg-white">
                                    <p className="text-[14px] font-medium text-black mb-1">{name}</p>
                                    <p className="text-[13px] leading-[1.55] text-[#666]">{desc}</p>
                                </div>
                            ))}
                        </div>
                        <P>
                            If a token expires mid-scan and the target answers{" "}
                            <Code>401</Code>, Onyx signs in again and carries on. Onyx
                            also strips the credential on purpose for some requests, to
                            prove your access control holds without it.
                        </P>
                        <Callout tone="info" title="Your secrets stay secret">
                            Recipe secrets are encrypted at rest with AES-256-GCM. They
                            are never shown again after saving, never logged, and never
                            included in a report or share link.
                        </Callout>
                    </Section>

                    {/* ---- Multiple identities ---- */}
                    <Section id="identities">
                        <H2>Multiple identities</H2>
                        <P>
                            The most common serious API flaw is one user reading another
                            user's data. To test for it, Onyx needs to act as more than
                            one user. Open <Code>Identities</Code> in the dashboard
                            toolbar and add up to four.
                        </P>
                        <div className="border border-[#e6e6e6] bg-white my-6 max-w-[72ch]">
                            {[
                                ["User A", "Primary", "Uses the credential picked in the toolbar. The main scan runs as this identity, and it needs a login for cross-user checks."],
                                ["User B", "Second", "A different test account's auth recipe, or Anonymous for no login at all."],
                                ["C, D", "Optional", "More roles, for example a regular user and an admin, to compare privilege levels."],
                            ].map(([who, tag, desc], i, arr) => (
                                <div
                                    key={who}
                                    className={`flex flex-wrap sm:flex-nowrap items-start gap-x-4 gap-y-2 p-4 ${i < arr.length - 1 ? "border-b border-[#e6e6e6]" : ""}`}
                                >
                                    <span className="shrink-0 w-14 font-mono text-[12px] leading-[20px] text-black">{who}</span>
                                    <span
                                        className={`shrink-0 w-[68px] text-center font-mono text-[10px] leading-[18px] uppercase tracking-wide border ${
                                            i === 0 ? "border-[#93c5fd] text-[#3b82f6]" : "border-[#e6e6e6] text-[#999]"
                                        }`}
                                    >
                                        {tag}
                                    </span>
                                    <span className="basis-full sm:basis-auto text-[13.5px] leading-[20px] text-[#555]">{desc}</span>
                                </div>
                            ))}
                        </div>
                        <P>
                            With two or more identities, Onyx adds two checks. For{" "}
                            <span className="text-black font-medium">BOLA</span> (API1) it
                            fetches an object as User A, requests the same object as User
                            B, and compares the responses. For{" "}
                            <span className="text-black font-medium">BFLA</span> (API5) it
                            calls privileged endpoints as a second, signed-in identity
                            (Anonymous is covered by the missing-auth check instead).
                            With one identity, every other check still runs.
                        </P>
                        <Callout tone="warn" title="Use test accounts on staging">
                            Identities should be dedicated test users, never real
                            customers. BFLA checks can call admin write and delete
                            endpoints, so data on the target may change. Run these
                            against staging wherever you can.
                        </Callout>
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
                        <CodeBlock code={`{\n  "type": "ATTACK_RESULT",\n  "data": {\n    "method": "POST",\n    "endpoint": "/users/login",\n    "statusCode": 500,\n    "latency": 412,\n    "attackType": "SQL_INJECTION",\n    "severity": "CRITICAL",\n    "finding": { "category": "...", "confidence": "confirmed" }\n  }\n}`} />
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

                    {/* ---- What Onyx checks ---- */}
                    <Section id="attack-types">
                        <H2>What Onyx checks</H2>
                        <P>
                            Twelve check types in two families. Input checks are
                            generated per endpoint from your schema:
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
                        <P>
                            Authorization and data checks look at who can do what, and
                            what comes back:
                        </P>
                        <div className="grid sm:grid-cols-2 border-t border-l border-[#e6e6e6] my-6 max-w-[72ch]">
                            {AUTH_CHECKS.map((a) => (
                                <div
                                    key={a.type}
                                    className="border-r border-b border-[#e6e6e6] p-4 bg-white hover:bg-[#f6f9ff] transition-colors"
                                >
                                    <div className="flex items-center justify-between gap-3 mb-1.5">
                                        <p className="font-mono text-[12.5px] text-[#3b82f6]">{a.type}</p>
                                        <span className="font-mono text-[10px] text-[#999] border border-[#e6e6e6] px-1.5 py-0.5">
                                            {a.owasp}
                                        </span>
                                    </div>
                                    <p className="text-[13.5px] text-[#666] leading-relaxed">{a.desc}</p>
                                </div>
                            ))}
                        </div>
                        <Callout tone="info" title="Conservative by design">
                            A finding is only raised when the evidence supports it. On
                            paid plans each endpoint gets a baseline, and test responses
                            are compared against it (status, size, timing, reflection) to
                            cut false positives.
                        </Callout>
                    </Section>

                    {/* ---- Reading a finding ---- */}
                    <Section id="findings">
                        <H2>Reading a finding</H2>
                        <P>
                            Click any row on the dashboard or report to expand it. Every
                            finding is explained, not just labeled:
                        </P>
                        <dl className="border-t border-l border-[#e6e6e6] grid sm:grid-cols-2 my-6 max-w-[72ch]">
                            {FINDING_PARTS.map(([term, def]) => (
                                <div key={term} className="border-r border-b border-[#e6e6e6] p-4 bg-white">
                                    <dt className="font-mono text-[11px] uppercase tracking-wider text-[#999] mb-1.5">{term}</dt>
                                    <dd className="text-[13.5px] leading-[1.6] text-[#555]">{def}</dd>
                                </div>
                            ))}
                        </dl>
                        <H3>Framework-specific fixes</H3>
                        <P>
                            Pick <Code>Express</Code>, <Code>FastAPI</Code>,{" "}
                            <Code>Spring</Code>, or <Code>Django</Code> on a finding to see
                            a short, copy-paste fix. Snippets are hand-written and
                            reviewed, never generated. Where no vetted snippet exists, the
                            general guidance is shown instead.
                        </P>
                    </Section>

                    {/* ---- OWASP ---- */}
                    <Section id="owasp">
                        <H2>OWASP API Security Top 10</H2>
                        <P>
                            Every finding carries its OWASP API Top 10 (2023) label, and
                            the report and PDF include a coverage matrix. Six categories
                            are actively tested today; the rest are mapped while coverage
                            grows.
                        </P>
                        <div className="grid sm:grid-cols-2 gap-4 my-6 max-w-[72ch]">
                            {([
                                ["Actively tested", OWASP_ACTIVE, "#3b82f6"],
                                ["Mapped, coverage expanding", OWASP_MAPPED, "#999"],
                            ] as const).map(([title, rows, color]) => (
                                <div key={title} className="border border-[#e6e6e6] bg-white">
                                    <p className="font-mono text-[11px] uppercase tracking-wider text-[#999] px-4 py-3 border-b border-[#e6e6e6]">
                                        {title}
                                    </p>
                                    <ul>
                                        {rows.map(([code, name]) => (
                                            <li key={code} className="flex items-baseline gap-3 px-4 py-2.5 border-b border-[#e6e6e6] last:border-0">
                                                <span className="font-mono text-[12px] w-11 shrink-0" style={{ color }}>
                                                    {code}
                                                </span>
                                                <span className="text-[13.5px] text-[#555] leading-snug">{name}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ))}
                        </div>
                    </Section>

                    {/* ---- Scoring ---- */}
                    <Section id="scoring">
                        <H2>Severity &amp; score</H2>
                        <P>
                            Each finding gets a CVSS-inspired severity. The run score
                            starts at 100 and deducts per finding, giving you a single
                            0-100 number to track over time.
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

                    {/* ---- Verify a fix ---- */}
                    <Section id="verify-fix">
                        <H2>Verify a fix</H2>
                        <P>
                            Shipped a fix? You don't need a full re-scan. Open the
                            finding and click <Code>Verify fix</Code>. Onyx re-sends that
                            one exact request and runs the same analysis that raised the
                            finding, so the result can't drift from the original scan.
                        </P>
                        <div className="grid sm:grid-cols-2 gap-4 my-6 max-w-[72ch]">
                            <Card>
                                <p className="font-mono text-[11px] uppercase tracking-wider text-[#16a34a] mb-1.5">Resolved</p>
                                <p className="text-[13.5px] leading-[1.55] text-[#666]">The issue no longer reproduces. The finding is marked fixed.</p>
                            </Card>
                            <Card>
                                <p className="font-mono text-[11px] uppercase tracking-wider text-[#ea580c] mb-1.5">Still present</p>
                                <p className="text-[13.5px] leading-[1.55] text-[#666]">It still reproduces. The time it was last checked is recorded.</p>
                            </Card>
                        </div>
                        <Callout tone="info" title="Cross-user findings">
                            BOLA and BFLA findings can't be re-checked on their own yet,
                            because they need a live second identity. Onyx says so rather
                            than guessing. Run a new scan with both identities instead.
                        </Callout>
                    </Section>

                    {/* ---- Sharing ---- */}
                    <Section id="sharing">
                        <H2>Reports &amp; sharing</H2>
                        <P>
                            Every run has a full report: score, severity breakdown,
                            OWASP coverage, and every finding with its evidence and fix.
                        </P>
                        <div className="grid sm:grid-cols-2 border-t border-l border-[#e6e6e6] my-6 max-w-[72ch]">
                            {[
                                ["PDF export", "Download the full report, including the OWASP coverage section. Pro and Team."],
                                ["Share link", "Create a read-only public link from the report page. Anyone with it can view, no login needed."],
                                ["Revoke anytime", "Turn a link off and it stops working immediately."],
                                ["Nothing private", "A shared report holds only scores, findings, and coverage. Never credentials or who shared it."],
                            ].map(([t, d]) => (
                                <div key={t} className="border-r border-b border-[#e6e6e6] p-4 bg-white">
                                    <p className="text-[14px] font-medium text-black mb-1">{t}</p>
                                    <p className="text-[13px] leading-[1.55] text-[#666]">{d}</p>
                                </div>
                            ))}
                        </div>
                    </Section>

                    {/* ---- CLI ---- */}
                    <Section id="cli">
                        <H2>API tokens &amp; CLI</H2>
                        <P>
                            Create an API token in <Code>Settings</Code> under API
                            tokens. It's shown once, stored only as a hash, acts as you,
                            and can be revoked at any time. The CLI uses it to run a scan
                            from your terminal or CI:
                        </P>
                        <CodeBlock code={`ONYX_TOKEN=onyx_xxx \\\n  onyx scan --spec https://api.example.com/openapi.json \\\n  --api-url https://onyx-server-a38v.onrender.com \\\n  --fail-on high \\\n  --format sarif --out onyx.sarif`} />
                        <P>
                            Output as <Code>table</Code>, <Code>json</Code>, or{" "}
                            <Code>sarif</Code>. Add <Code>--auth-recipe &lt;id&gt;</Code>{" "}
                            to scan behind a login. The exit code gates your build:
                        </P>
                        <div className="border border-[#e6e6e6] bg-white my-6 max-w-[72ch]">
                            {CLI_EXIT.map(([code, desc], i) => (
                                <div
                                    key={code}
                                    className={`flex items-start gap-4 p-3.5 ${i < CLI_EXIT.length - 1 ? "border-b border-[#e6e6e6]" : ""}`}
                                >
                                    <span className="shrink-0 font-mono text-[13px] text-[#3b82f6] w-6 tabular-nums">{code}</span>
                                    <span className="text-[14px] leading-[1.55] text-[#555]">{desc}</span>
                                </div>
                            ))}
                        </div>
                        <P>
                            The CLI lives in the <Code>cli/</Code> folder of the{" "}
                            <a
                                href="https://github.com/raghul017/Onyx/tree/main/cli"
                                target="_blank"
                                rel="noreferrer"
                                className="text-black underline decoration-[#ccc] underline-offset-4 hover:decoration-black transition-colors"
                            >
                                Onyx repo
                            </a>{" "}
                            (Node 20 or later, no runtime dependencies).
                        </P>
                    </Section>

                    {/* ---- GitHub Action ---- */}
                    <Section id="github-action">
                        <H2>GitHub Action</H2>
                        <P>
                            Run Onyx on every pull request. One scan uploads SARIF to the
                            repository's Security tab, posts a summary comment on the PR,
                            and fails the check at your threshold.
                        </P>
                        <CodeBlock code={`- uses: actions/checkout@v4\n- uses: raghul017/Onyx@main\n  with:\n    spec: https://api.example.com/openapi.json\n    api-token: \${{ secrets.ONYX_TOKEN }}\n    fail-on: high`} />
                        <P>
                            Optional inputs: <Code>api-url</Code>,{" "}
                            <Code>auth-recipe</Code>, <Code>org</Code>, and{" "}
                            <Code>github-token</Code> (needs{" "}
                            <Code>pull-requests: write</Code> to comment).
                        </P>
                        <Callout tone="info" title="Keep the token in secrets">
                            Store the API token as a repository secret. The action reads
                            it from the environment and never puts it on the command
                            line or in logs.
                        </Callout>
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
                            BullMQ 5 + Redis, Google Gemini 3.5 Flash-Lite, and Razorpay for
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

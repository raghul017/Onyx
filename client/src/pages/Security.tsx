// =============================================================================
// /security — full Security / Trust page (T21e).
// ACCURACY: every claim maps to a real control in the server codebase — see the
// source note beside each section. No compliance certification is claimed (Onyx
// is not SOC 2 / ISO certified); the compliance line is explicitly forward-looking.
// Light-mono throughout. Sourced controls:
//   • SSRF guard ............ server/src/lib/ssrf-guard.ts
//   • Domain verification ... server/src/services/domain-verify.service.ts
//   • Request timeout ....... server/src/queues/worker.ts (REQUEST_TIMEOUT_MS 10s)
//   • Concurrency/limiter ... server/src/queues/worker.ts (concurrency 12, 3/100ms)
//   • Rate limits ........... server/src/routes/{auth.ts,index.ts} (5/min, 5/hr)
//   • Per-plan quotas ....... server/src/middleware/quota.middleware.ts
//   • Secret encryption ..... server/src/lib/crypto.ts (AES-256-GCM)
//   • API token hashing ..... server/src/services/api-token.service.ts (SHA-256)
//   • Redaction ............. server/src/lib/redact.ts
//   • JWT/bcrypt/OAuth ...... server/src/middleware/auth.ts, controllers/auth.controller.ts
// =============================================================================
import { Link } from "react-router-dom";
import { ArrowRight, ShieldCheck, Lock, KeyRound, Server, ScrollText, Radar } from "lucide-react";
import MarketingPage from "../components/MarketingPage";
import { GITHUB_URL } from "../components/nav-config";

interface Item {
    title: string;
    body: string;
}

const SafeTesting: Item[] = [
    {
        title: "You must prove you own a target",
        body: "Before Onyx fires a single payload, you verify domain ownership — either a probe file at /.well-known/onyx-verify.txt or a DNS TXT record. Unverified domains can't be scanned.",
    },
    {
        title: "SSRF guard on every request",
        body: "Every target URL is DNS-resolved and checked before use. Loopback, private, link-local, CGNAT, cloud-metadata (169.254.169.254), and IPv4-mapped IPv6 addresses are blocked — and re-vetted on a short TTL to defeat DNS rebinding.",
    },
    {
        title: "Hard request timeouts",
        body: "Every outbound attack request is aborted after 10 seconds, so a slow or hostile endpoint can't tie up the engine.",
    },
    {
        title: "Paced, rate-limited, quota-bounded",
        body: "Work is queued and evenly paced (bounded concurrency, ~30 requests/sec per run), auth and scan endpoints are IP rate-limited, and each plan has monthly run and endpoint quotas — so scans stay controlled.",
    },
];

const DataProtection: Item[] = [
    {
        title: "Auth secrets encrypted at rest",
        body: "Credentials in your auth recipes (tokens, API keys, OAuth secrets, passwords) are encrypted with AES-256-GCM — authenticated encryption — before they touch the database.",
    },
    {
        title: "API tokens are hashed, not stored",
        body: "CLI/API tokens are kept only as SHA-256 hashes; the plaintext is shown once at creation and never persisted. Tokens can be revoked at any time.",
    },
    {
        title: "Response evidence is redacted",
        body: "Before any response snippet is stored or streamed to your dashboard, secrets — bearer tokens, API keys, passwords — are masked to ***REDACTED***, so evidence stays useful without persisting real credentials.",
    },
    {
        title: "Credentials never logged",
        body: "Secrets are kept out of application logs and error messages by design.",
    },
];

const AccountSecurity: Item[] = [
    {
        title: "JWT sessions, algorithm-pinned",
        body: "Session tokens are signed and verified with HS256, with the algorithm pinned on verification to prevent algorithm-confusion attacks.",
    },
    {
        title: "Passwords hashed with bcrypt",
        body: "Passwords are stored as bcrypt hashes (cost factor 12) — never in plaintext.",
    },
    {
        title: "OAuth sign-in",
        body: "Prefer not to manage a password? Sign in with Google or GitHub.",
    },
    {
        title: "Scoped, revocable API tokens",
        body: "API tokens act as you for the CLI and CI, and can be revoked instantly from Settings the moment one is no longer needed.",
    },
];

const SectionCards = ({
    icon: Icon,
    eyebrow,
    heading,
    lede,
    items,
}: {
    icon: typeof ShieldCheck;
    eyebrow: string;
    heading: string;
    lede?: string;
    items: Item[];
}) => (
    <section className="border-b border-[#e6e6e6] px-6 py-16 lg:py-24">
        <div className="max-w-[1280px] mx-auto">
            <div className="mono-eyebrow mb-4">
                <span className="sq" /> {eyebrow}
            </div>
            <div className="flex items-center gap-3 mb-2">
                <Icon size={20} className="text-[#3b82f6]" aria-hidden="true" />
                <h2 className="text-[clamp(1.75rem,4vw,32px)] leading-tight text-balance">
                    {heading}
                </h2>
            </div>
            {lede && <p className="text-[15px] text-[#666] mt-3 max-w-2xl leading-relaxed">{lede}</p>}

            <div className="grid grid-cols-1 md:grid-cols-2 border-t border-l border-[#e6e6e6] mt-8">
                {items.map((it) => (
                    <div key={it.title} className="border-r border-b border-[#e6e6e6] p-6 bg-white">
                        <h3 className="text-[15px] mb-2">{it.title}</h3>
                        <p className="text-[13.5px] text-[#666] leading-relaxed text-pretty">
                            {it.body}
                        </p>
                    </div>
                ))}
            </div>
        </div>
    </section>
);

const Security = () => (
    <MarketingPage>
        {/* Intro */}
        <section className="border-b border-[#e6e6e6] px-6 pt-16 pb-12 lg:pt-24">
            <div className="max-w-[1280px] mx-auto">
                <div className="mono-eyebrow mb-4">
                    <span className="sq" /> SECURITY
                </div>
                <h1 className="text-[clamp(2rem,5vw,44px)] leading-tight text-balance max-w-2xl">
                    Security is the product.
                </h1>
                <p className="text-[15px] text-[#666] mt-4 max-w-2xl leading-relaxed text-pretty">
                    Onyx is an offensive tool, so safety isn&rsquo;t a feature bolted on — it&rsquo;s
                    the foundation. It attacks only targets you&rsquo;ve proven you own, guards
                    against SSRF, encrypts every secret at rest, and redacts sensitive
                    evidence before it&rsquo;s ever stored. Here&rsquo;s exactly how.
                </p>
            </div>
        </section>

        <SectionCards
            icon={Radar}
            eyebrow="HOW WE TEST SAFELY"
            heading="Aggressive on targets. Safe by design."
            lede="Onyx only ever hits the API you actually own, and it does so within strict guardrails."
            items={SafeTesting}
        />

        <SectionCards
            icon={Lock}
            eyebrow="HOW WE PROTECT YOUR DATA"
            heading="Your secrets stay secret."
            items={DataProtection}
        />

        <SectionCards
            icon={KeyRound}
            eyebrow="ACCOUNT SECURITY"
            heading="Sign in with confidence."
            items={AccountSecurity}
        />

        {/* Infrastructure — truthful, non-sensitive level only */}
        <section className="border-b border-[#e6e6e6] px-6 py-16 lg:py-24">
            <div className="max-w-[1280px] mx-auto">
                <div className="mono-eyebrow mb-4">
                    <span className="sq" /> INFRASTRUCTURE
                </div>
                <div className="flex items-center gap-3 mb-2">
                    <Server size={20} className="text-[#3b82f6]" aria-hidden="true" />
                    <h2 className="text-[clamp(1.75rem,4vw,32px)] leading-tight text-balance">
                        Built on managed, modern infrastructure.
                    </h2>
                </div>
                <p className="text-[15px] text-[#666] mt-3 max-w-2xl leading-relaxed text-pretty">
                    Onyx runs on managed cloud infrastructure with a managed PostgreSQL
                    database and a Redis-backed job queue that isolates and paces attack
                    work. Attack traffic runs through queued workers behind the SSRF guard,
                    separate from your account data. We don&rsquo;t publish exact versions,
                    hostnames, or internal topology here — by design.
                </p>
            </div>
        </section>

        {/* Compliance — honest, forward-looking (no certification claimed) */}
        <section className="border-b border-[#e6e6e6] px-6 py-16 lg:py-24">
            <div className="max-w-[1280px] mx-auto">
                <div className="mono-eyebrow mb-4">
                    <span className="sq" /> COMPLIANCE
                </div>
                <div className="flex items-center gap-3 mb-2">
                    <ScrollText size={20} className="text-[#3b82f6]" aria-hidden="true" />
                    <h2 className="text-[clamp(1.75rem,4vw,32px)] leading-tight text-balance">
                        Honest about where we are.
                    </h2>
                </div>
                <p className="text-[15px] text-[#666] mt-3 max-w-2xl leading-relaxed text-pretty">
                    Onyx is <strong className="text-black font-medium">not</strong> SOC 2 or
                    ISO 27001 certified today, and we won&rsquo;t claim otherwise. Formal
                    compliance is on our roadmap; until then, this page is our transparent
                    account of the controls that are actually in place. If you need specific
                    assurances for a security review, get in touch.
                </p>
            </div>
        </section>

        {/* Responsible disclosure */}
        <section className="px-6 py-16 lg:py-24">
            <div className="max-w-[1280px] mx-auto">
                <div className="mono-eyebrow mb-4">
                    <span className="sq" /> RESPONSIBLE DISCLOSURE
                </div>
                <div className="flex items-center gap-3 mb-2">
                    <ShieldCheck size={20} className="text-[#3b82f6]" aria-hidden="true" />
                    <h2 className="text-[clamp(1.75rem,4vw,32px)] leading-tight text-balance">
                        Found a bug in Onyx itself?
                    </h2>
                </div>
                <p className="text-[15px] text-[#666] mt-3 max-w-2xl leading-relaxed text-pretty">
                    We welcome coordinated disclosure. If you find a vulnerability in Onyx,
                    please report it privately and give us a chance to fix it before going
                    public — we&rsquo;ll work with you on a timeline.
                </p>
                <div className="flex flex-wrap gap-4 mt-8">
                    <Link to="/responsible-disclosure" className="mono-btn inline-flex w-max">
                        Disclosure policy
                        <ArrowRight size={14} />
                    </Link>
                    <a
                        href={`${GITHUB_URL}/issues`}
                        target="_blank"
                        rel="noreferrer"
                        className="mono-btn-ghost inline-flex w-max"
                    >
                        Report via GitHub
                        <ArrowRight size={14} />
                    </a>
                </div>
            </div>
        </section>
    </MarketingPage>
);

export default Security;

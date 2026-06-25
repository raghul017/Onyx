// =============================================================================
// FeatureBento — bento of feature cards, each with a live Onyx-real mini preview.
// Brand palette ONLY: teal #73bfc4 / cyan #06b6d4·#22d3ee, slate #8da0ce, warm
// orange #ff810a as the rare semantic pop, on #0A0A0A surfaces. Satoshi display,
// Inter body, JetBrains Mono for code/data. Restrained glass + on-scroll motion
// (animate-once), reduced-motion safe. Matches the hero shader + c5 gradient.
// =============================================================================

import { useRef } from "react";
import { useReducedMotion } from "framer-motion";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import {
    Broadcast,
    FileMagnifyingGlass,
    ShieldCheck,
    Gauge,
    Check,
} from "@phosphor-icons/react";

gsap.registerPlugin(ScrollTrigger);

const cx = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(" ");

// ---- Shared card shell: hairline ring, faint top sheen, soft hover lift ----
const Card = ({
    className,
    children,
}: {
    className?: string;
    children: React.ReactNode;
}) => (
    <div
        className={cx(
            "group relative flex flex-col overflow-hidden rounded-[28px] p-6 sm:p-7",
            // dark-mode shadow-border ring (make-interfaces): 0.08 rest -> teal on hover
            "bg-[var(--bento-card,#0B0C0D)] shadow-[0_0_0_1px_rgba(255,255,255,0.08)]",
            "hover:shadow-[0_0_0_1px_rgba(115,191,196,0.3)] transition-shadow duration-500",
            className,
        )}
    >
        {/* faint top sheen, brand teal, very low opacity (no neon slop) */}
        <div
            className="pointer-events-none absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-[#73bfc4]/45 to-transparent opacity-70"
            aria-hidden="true"
        />
        {children}
    </div>
);

const Caption = ({ title, body }: { title: string; body: string }) => (
    <div className="mt-6">
        <h3
            className="text-white text-[19px] sm:text-[20px] leading-[1.25] tracking-[-0.01em] text-balance"
            style={{ fontFamily: '"Satoshi Variable", sans-serif', fontWeight: 500 }}
        >
            {title}
        </h3>
        <p className="mt-2.5 text-[14.5px] leading-[1.62] text-white/65 text-pretty max-w-[46ch]">
            {body}
        </p>
    </div>
);

// Inner "preview surface" — solid panel (no glass), concentric radius (28 -> 18)
const Surface = ({ children }: { children: React.ReactNode }) => (
    <div className="relative rounded-[18px] bg-[var(--bento-panel,#070809)] p-4 ring-1 ring-white/[0.06]">
        {children}
    </div>
);

const PreviewHead = ({
    icon: Icon,
    label,
    live = false,
}: {
    icon: React.ElementType;
    label: string;
    live?: boolean;
}) => (
    <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-white/75 text-[12.5px]">
            <Icon size={15} weight="duotone" className="text-[#73bfc4]" />
            <span className="font-medium">{label}</span>
        </div>
        {live && (
            <span className="flex items-center gap-1.5 text-[10px] tracking-wider text-white/40 font-['JetBrains_Mono']">
                <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-[#73bfc4] opacity-70 motion-safe:animate-ping" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#73bfc4]" />
                </span>
                LIVE
            </span>
        )}
    </div>
);

// Severity palette — semantic, brand-aligned (orange is the warm pop here)
const SEV: Record<string, string> = {
    CRITICAL: "#ff5a5a",
    HIGH: "#ff810a", // brand warm orange
    MEDIUM: "#d8b24a",
    INFO: "#8da0ce", // brand slate
};

// ---------------------------------------------------------------------------
// CARD 1 — Live attack feed (wide)
// ---------------------------------------------------------------------------
const FEED = [
    { m: "POST", p: "/users/login", a: "SQL_INJECTION", s: 500, sev: "CRITICAL" },
    { m: "GET", p: "/orders/{id}", a: "MISSING_AUTH", s: 403, sev: "HIGH" },
    { m: "PUT", p: "/profile", a: "TYPE_CONFUSION", s: 422, sev: "MEDIUM" },
    { m: "GET", p: "/health", a: "RATE_LIMIT", s: 200, sev: "INFO" },
];

const LiveFeed = () => (
    <Surface>
        <PreviewHead icon={Broadcast} label="Attack stream" live />
        <div className="space-y-1.5" data-stagger>
            {FEED.map((r) => (
                <div
                    key={r.p}
                    data-row
                    className="flex items-center gap-2.5 rounded-xl bg-[var(--bento-row,#0E0F10)] px-2.5 py-2 ring-1 ring-white/[0.06]"
                >
                    <span className="font-['JetBrains_Mono'] text-[9.5px] font-bold tracking-wider text-[#73bfc4] bg-[#73bfc4]/12 rounded-md px-1.5 py-0.5 shrink-0 w-[42px] text-center">
                        {r.m}
                    </span>
                    <span className="font-['JetBrains_Mono'] text-[12px] text-white/80 truncate flex-1">
                        {r.p}
                    </span>
                    <span className="hidden md:inline font-['JetBrains_Mono'] text-[10.5px] text-white/35 truncate">
                        {r.a}
                    </span>
                    <span className="font-['JetBrains_Mono'] text-[11px] tabular-nums text-white/55 w-7 text-right">
                        {r.s}
                    </span>
                    <span
                        className="font-['JetBrains_Mono'] text-[9px] font-bold tracking-wider rounded-md px-1.5 py-1 shrink-0 w-[66px] text-center"
                        style={{ color: SEV[r.sev], backgroundColor: `${SEV[r.sev]}18` }}
                    >
                        {r.sev}
                    </span>
                </div>
            ))}
        </div>
    </Surface>
);

// ---------------------------------------------------------------------------
// CARD 2 — Schema parse (endpoints discovered)
// ---------------------------------------------------------------------------
const ROUTES = [
    { m: "GET", p: "/products" },
    { m: "POST", p: "/products" },
    { m: "GET", p: "/products/{id}" },
    { m: "DELETE", p: "/products/{id}" },
];

const SchemaParse = () => (
    <Surface>
        <PreviewHead icon={FileMagnifyingGlass} label="openapi.json" />
        <div className="space-y-1.5" data-stagger>
            {ROUTES.map((r) => (
                <div
                    key={r.m + r.p}
                    data-row
                    className="flex items-center gap-2.5 rounded-xl bg-[var(--bento-row,#0E0F10)] px-2.5 py-1.5 ring-1 ring-white/[0.06]"
                >
                    <span className="font-['JetBrains_Mono'] text-[9.5px] font-bold tracking-wider text-[#73bfc4] bg-[#73bfc4]/12 rounded-md px-1.5 py-0.5 shrink-0 w-[54px] text-center">
                        {r.m}
                    </span>
                    <span className="font-['JetBrains_Mono'] text-[12px] text-white/75 truncate flex-1">
                        {r.p}
                    </span>
                    <Check size={13} className="text-[#73bfc4] shrink-0" weight="bold" />
                </div>
            ))}
        </div>
    </Surface>
);

// ---------------------------------------------------------------------------
// CARD 3 — Domain verification (file + DNS → verified)
// ---------------------------------------------------------------------------
const DomainVerify = () => (
    <Surface>
        <PreviewHead icon={ShieldCheck} label="Ownership check" />
        <div className="space-y-2">
            <div className="flex items-center justify-between rounded-xl bg-[var(--bento-row,#0E0F10)] px-3 py-2 ring-1 ring-white/[0.06]">
                <span className="font-['JetBrains_Mono'] text-[11px] text-white/60">/.well-known/onyx.txt</span>
                <Check size={13} className="text-[#73bfc4]" weight="bold" />
            </div>
            <div className="flex items-center justify-between rounded-xl bg-[var(--bento-row,#0E0F10)] px-3 py-2 ring-1 ring-white/[0.06]">
                <span className="font-['JetBrains_Mono'] text-[11px] text-white/60">TXT _onyx-verify</span>
                <Check size={13} className="text-[#73bfc4]" weight="bold" />
            </div>
            <div
                data-verified
                className="flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 mt-1"
                style={{ backgroundColor: "rgba(115,191,196,0.1)", boxShadow: "inset 0 0 0 1px rgba(115,191,196,0.3)" }}
            >
                <ShieldCheck size={15} weight="fill" className="text-[#73bfc4]" />
                <span className="font-['JetBrains_Mono'] text-[11px] font-bold tracking-wider text-[#73bfc4]">
                    DOMAIN VERIFIED
                </span>
            </div>
        </div>
    </Surface>
);

// ---------------------------------------------------------------------------
// CARD 4 — Metrics (count-up)
// ---------------------------------------------------------------------------
const METRICS = [
    { value: "8", label: "OWASP categories" },
    { value: "20", label: "payloads / endpoint" },
    { value: "<10s", label: "per-attack timeout" },
    { value: "0-100", label: "CVSS score" },
];

const MetricsTile = () => (
    <Surface>
        <PreviewHead icon={Gauge} label="By the numbers" />
        <div className="grid grid-cols-2 gap-2" data-stagger>
            {METRICS.map((m) => (
                <div
                    key={m.label}
                    data-row
                    className="rounded-xl bg-[var(--bento-row,#0E0F10)] px-3 py-3 ring-1 ring-white/[0.06]"
                >
                    <div
                        className="text-white tabular-nums leading-none"
                        style={{ fontFamily: '"Satoshi Variable", sans-serif', fontSize: "clamp(1.4rem,2.4vw,1.8rem)", letterSpacing: "-0.02em" }}
                    >
                        {m.value}
                    </div>
                    <div className="mt-1.5 text-[10.5px] uppercase tracking-[0.12em] text-white/40 font-['JetBrains_Mono']">
                        {m.label}
                    </div>
                </div>
            ))}
        </div>
    </Surface>
);

// ---------------------------------------------------------------------------
// Section
// ---------------------------------------------------------------------------
const CARDS = [
    { span: "lg:col-span-2", preview: <LiveFeed />, title: "Results while they happen", body: "Attacks run through a Redis queue and stream back over WebSockets, scored by severity as each one lands. No waiting for a batch report." },
    { span: "", preview: <SchemaParse />, title: "Schema-aware, not brute force", body: "Onyx reads your request bodies, path params, and query strings, then asks Gemini what would actually break each endpoint." },
    { span: "", preview: <DomainVerify />, title: "Permission before payloads", body: "Every target is gated behind domain ownership verification and SSRF checks. Onyx never fires at infrastructure you have not proven you own." },
    { span: "lg:col-span-2", preview: <MetricsTile />, title: "Tuned for real coverage", body: "Up to 20 schema-aware payloads per endpoint across 8 OWASP categories, each scored on a 0-100 CVSS-inspired scale." },
];

// Surface palettes. "raised" = correct lift hierarchy (page < card < panel < row).
// "flat" = card flush-black on the page, only panel/rows lift.
const VARIANTS: Record<string, React.CSSProperties> = {
    raised: { ["--bento-card" as string]: "#0E0F10", ["--bento-panel" as string]: "#121315", ["--bento-row" as string]: "#191A1C" },
    flat: { ["--bento-card" as string]: "#080808", ["--bento-panel" as string]: "#0E0F10", ["--bento-row" as string]: "#151618" },
    deep: { ["--bento-card" as string]: "#0B0C0D", ["--bento-panel" as string]: "#060708", ["--bento-row" as string]: "#101113" },
};

const FeatureBento = ({ variant = "flat" }: { variant?: keyof typeof VARIANTS }) => {
    const ref = useRef<HTMLDivElement>(null);
    const reduce = useReducedMotion();

    useGSAP(
        () => {
            const cards = gsap.utils.toArray<HTMLElement>("[data-bento-card]");
            const rows = gsap.utils.toArray<HTMLElement>("[data-row]");
            if (reduce) {
                gsap.set([...cards, ...rows], { opacity: 1, y: 0, x: 0 });
                return;
            }
            gsap.set(cards, { opacity: 0, y: 28 });
            gsap.set(rows, { opacity: 0, x: 12 });

            ScrollTrigger.batch(cards, {
                start: "top 95%",
                once: true,
                onEnter: (b) => gsap.to(b, { opacity: 1, y: 0, duration: 0.6, ease: "power3.out", stagger: 0.1 }),
            });
            // Safety net: anything already on-screen at mount reveals immediately.
            ScrollTrigger.refresh();
            ScrollTrigger.batch(rows, {
                start: "top 92%",
                once: true,
                onEnter: (b) => gsap.to(b, { opacity: 1, x: 0, duration: 0.45, ease: "power2.out", stagger: 0.07 }),
            });
        },
        { scope: ref, dependencies: [reduce] },
    );

    return (
        <section className="w-full py-24 sm:py-28 lg:py-32 px-5 sm:px-8 lg:px-12" style={VARIANTS[variant]}>
            <div ref={ref} className="max-w-[1280px] mx-auto grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
                {CARDS.map((c, i) => (
                    <div key={i} data-bento-card className={c.span}>
                        <Card>
                            {c.preview}
                            <Caption title={c.title} body={c.body} />
                        </Card>
                    </div>
                ))}
            </div>
        </section>
    );
};

export default FeatureBento;

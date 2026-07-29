// =============================================================================
// AuthenticatedScanning (#authenticated) — homepage section (T21b).
// Mirrors AboutSection/MoreFeatures: split grid, mono-eyebrow, text-[44px]
// headline, p-12 lg:p-24 rhythm, hairline borders, mono-card chips, no shadows.
// Left: statement. Right: an "auth methods" chip grid (code-generated visual).
// =============================================================================
import { motion } from "framer-motion";
import { KeyRound, RefreshCw, Lock, ShieldOff } from "lucide-react";

const enter = {
    initial: { opacity: 0, y: 24 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: "-100px" },
    transition: { duration: 0.6, ease: [0.2, 0, 0, 1] as const },
};

// Four capabilities → tiles on the right. Icons are decorative (aria-hidden).
const TILES: { icon: typeof KeyRound; title: string; note: string }[] = [
    {
        icon: KeyRound,
        title: "Static tokens & API keys",
        note: "Bearer, custom header, or cookie",
    },
    {
        icon: RefreshCw,
        title: "OAuth2 & login flows with auto-refresh",
        note: "Client-credentials or a full login request",
    },
    {
        icon: Lock,
        title: "Encrypted at rest, never logged",
        note: "AES-256-GCM; secrets stay secret",
    },
    {
        icon: ShieldOff,
        title: "Missing-auth probes",
        note: "Strips auth to catch broken access control",
    },
];

const AuthenticatedScanning = () => (
    <section
        id="authenticated"
        className="scroll-mt-24 border-b border-[#e6e6e6] grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-[#e6e6e6]"
    >
        {/* Left — statement */}
        <motion.div {...enter} className="p-12 lg:p-24 flex flex-col justify-center">
            <div className="mono-eyebrow mb-4">
                <span className="sq" /> AUTHENTICATED TESTING
            </div>
            <h2 className="text-[44px] mb-6 leading-[1.05] text-balance">
                Test what&rsquo;s behind the login.
            </h2>
            <p className="text-[#000]/70 max-w-md text-[17px] leading-7 text-pretty">
                Most real API risk lives behind auth. Onyx logs in with a bearer token,
                API key, cookie, OAuth2 client-credentials, or a full login flow — then
                attacks the endpoints that actually matter. It even strips auth on
                purpose to prove your access controls hold.
            </p>
        </motion.div>

        {/* Right — auth-method tiles */}
        <div className="p-12 lg:p-24 bg-white/50 flex items-center justify-center">
            <motion.ul {...enter} className="w-full max-w-md grid grid-cols-1 sm:grid-cols-2 gap-3">
                {TILES.map(({ icon: Icon, title, note }) => (
                    <li key={title} className="mono-card p-4 flex flex-col gap-2">
                        <Icon size={16} className="text-[#3b82f6]" aria-hidden="true" />
                        <span className="text-[13px] leading-snug text-black">{title}</span>
                        <span className="font-mono text-[10px] uppercase tracking-wide text-[#999] leading-snug">
                            {note}
                        </span>
                    </li>
                ))}
            </motion.ul>
        </div>
    </section>
);

export default AuthenticatedScanning;

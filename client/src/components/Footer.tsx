const GithubIcon = () => (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
    </svg>
);

const XIcon = () => (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
);

const Footer = () => {
    return (
        <footer className="z-10 sm:px-6 lg:px-8 [animation:fadeSlideIn_0.8s_ease-out_0.1s_both] animate-on-scroll max-w-7xl mr-auto ml-auto pt-20 pr-4 pb-16 pl-4 relative w-full border-t border-[#2A2A2A]">
            <div className="relative overflow-hidden rounded-3xl ring-1 ring-white/10 bg-neutral-950 backdrop-blur mt-6">
                {/* Soft neutral accents */}
                <div className="pointer-events-none absolute inset-0">
                    <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-white/6 blur-3xl"></div>
                    <div className="absolute -right-24 -bottom-24 h-72 w-72 rounded-full bg-white/5 blur-3xl"></div>
                    <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/40"></div>
                </div>

                {/* Content */}
                <div className="relative mx-auto flex flex-col items-center justify-center text-center pt-16 pb-16 px-8 sm:py-16 md:px-8">
                    <div className="w-full max-w-7xl">
                        {/* Footer Top */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12 pb-12 border-b border-white/10">
                            {/* Brand Column */}
                            <div className="lg:col-span-2">
                                <div className="flex flex-col items-start gap-4">
                                    <span className="font-['Inter'] font-medium text-white text-[24px] tracking-tight">
                                        Onyx
                                    </span>

                                    <p className="text-left text-sm leading-relaxed text-zinc-400 max-w-xs">
                                        AI-powered dynamic testing
                                        infrastructure designed for deep API
                                        inspection and zero-day prevention.
                                    </p>

                                    <div className="flex items-center gap-3">
                                        <a
                                            href="https://github.com/raghul017/Onyx"
                                            target="_blank"
                                            rel="noreferrer"
                                            className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/5 ring-1 ring-white/10 text-zinc-300 transition hover:bg-white/10 hover:text-white"
                                        >
                                            <GithubIcon />
                                        </a>
                                        <a
                                            href="https://x.com/RaghulAR7"
                                            target="_blank"
                                            rel="noreferrer"
                                            className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/5 ring-1 ring-white/10 text-zinc-300 transition hover:bg-white/10 hover:text-white"
                                        >
                                            <XIcon />
                                        </a>
                                    </div>
                                </div>
                            </div>

                            {/* Product */}
                            <div className="text-left">
                                <h4 className="mb-4 text-sm font-semibold tracking-tight text-white">
                                    Product
                                </h4>
                                <ul className="space-y-3">
                                    <li>
                                        <a
                                            href="#features"
                                            className="text-sm text-zinc-400 transition hover:text-white"
                                        >
                                            Features
                                        </a>
                                    </li>
                                    <li>
                                        <a
                                            href="#how-it-works"
                                            className="text-sm text-zinc-400 transition hover:text-white"
                                        >
                                            How it Works
                                        </a>
                                    </li>
                                    <li>
                                        <a
                                            href="/dashboard"
                                            className="text-sm text-zinc-400 transition hover:text-white"
                                        >
                                            Dashboard
                                        </a>
                                    </li>
                                </ul>
                            </div>

                            {/* Resources */}
                            <div className="text-left">
                                <h4 className="mb-4 text-sm font-semibold tracking-tight text-white">
                                    Resources
                                </h4>
                                <ul className="space-y-3">
                                    <li>
                                        <a
                                            href="#"
                                            className="text-sm text-zinc-400 transition hover:text-white"
                                        >
                                            Documentation
                                        </a>
                                    </li>
                                    <li>
                                        <a
                                            href="#"
                                            className="text-sm text-zinc-400 transition hover:text-white"
                                        >
                                            API Reference
                                        </a>
                                    </li>
                                    <li>
                                        <a
                                            href="https://github.com/raghul017/Onyx"
                                            target="_blank"
                                            rel="noreferrer"
                                            className="text-sm text-zinc-400 transition hover:text-white"
                                        >
                                            Source Code
                                        </a>
                                    </li>
                                </ul>
                            </div>

                            {/* Company */}
                            <div className="text-left">
                                <h4 className="mb-4 text-sm font-semibold tracking-tight text-white">
                                    Connect
                                </h4>
                                <ul className="space-y-3">
                                    <li>
                                        <a
                                            href="https://x.com/RaghulAR7"
                                            target="_blank"
                                            rel="noreferrer"
                                            className="text-sm text-zinc-400 transition hover:text-white"
                                        >
                                            Twitter
                                        </a>
                                    </li>
                                    <li>
                                        <a
                                            href="https://github.com/raghul017/Onyx"
                                            target="_blank"
                                            rel="noreferrer"
                                            className="text-sm text-zinc-400 transition hover:text-white"
                                        >
                                            GitHub
                                        </a>
                                    </li>
                                </ul>
                            </div>
                        </div>

                        {/* Footer Bottom */}
                        <div className="flex flex-col items-center justify-between gap-4 pt-8 md:flex-row">
                            <p className="text-sm text-zinc-500">
                                © 2025–2026 Onyx. Built by Raghul.
                            </p>
                            <div className="flex items-center gap-6">
                                <a
                                    href="#"
                                    className="text-sm text-zinc-500 transition hover:text-white"
                                >
                                    Privacy
                                </a>
                                <a
                                    href="#"
                                    className="text-sm text-zinc-500 transition hover:text-white"
                                >
                                    Terms
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </footer>
    );
};

export default Footer;

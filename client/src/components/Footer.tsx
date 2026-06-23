// =============================================================================
// Footer — Newsletter + columns layout (dark theme, Onyx)
// =============================================================================

const Footer = () => {
    return (
        <footer className="bg-[#0A0A0A] border-t border-[#1A1A1A] pt-20 pb-5 max-[900px]:pt-[60px]">
            <div className="max-w-[1100px] w-full mx-auto px-5">
                {/* Columns */}
                <div className="grid grid-cols-[2fr_1fr_1fr_2fr] gap-10 mb-[50px] max-[900px]:grid-cols-2 max-[480px]:grid-cols-1">
                    {/* Logo column */}
                    <div>
                        <div className="h-6 mb-[15px] flex items-center">
                            <span className="font-['Inter'] font-semibold text-white text-[20px] tracking-tight">
                                Onyx
                            </span>
                        </div>
                        <p className="text-[0.85rem] text-[#888] leading-[1.6] max-w-[220px]">
                            AI-powered API vulnerability testing that finds flaws
                            before attackers do.
                        </p>
                    </div>

                    {/* Navigation */}
                    <div>
                        <h4 className="font-semibold mb-5 text-[0.95rem] text-white">
                            Navigation
                        </h4>
                        <ul>
                            <li className="mb-3">
                                <a
                                    href="#features"
                                    className="text-[#888] no-underline text-[0.85rem] transition-colors duration-200 hover:text-white"
                                >
                                    Features
                                </a>
                            </li>
                            <li className="mb-3">
                                <a
                                    href="#how-it-works"
                                    className="text-[#888] no-underline text-[0.85rem] transition-colors duration-200 hover:text-white"
                                >
                                    How it Works
                                </a>
                            </li>
                            <li className="mb-3">
                                <a
                                    href="#pricing"
                                    className="text-[#888] no-underline text-[0.85rem] transition-colors duration-200 hover:text-white"
                                >
                                    Pricing
                                </a>
                            </li>
                            <li className="mb-3">
                                <a
                                    href="https://github.com/raghul017/Onyx"
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-[#888] no-underline text-[0.85rem] transition-colors duration-200 hover:text-white"
                                >
                                    GitHub
                                </a>
                            </li>
                        </ul>
                    </div>

                    {/* Pages */}
                    <div>
                        <h4 className="font-semibold mb-5 text-[0.95rem] text-white">
                            Pages
                        </h4>
                        <ul>
                            <li className="mb-3">
                                <a
                                    href="/dashboard"
                                    className="text-[#888] no-underline text-[0.85rem] transition-colors duration-200 hover:text-white"
                                >
                                    Dashboard
                                </a>
                            </li>
                            <li className="mb-3">
                                <a
                                    href="/billing"
                                    className="text-[#888] no-underline text-[0.85rem] transition-colors duration-200 hover:text-white"
                                >
                                    Billing
                                </a>
                            </li>
                            <li className="mb-3">
                                <a
                                    href="/signin"
                                    className="text-[#888] no-underline text-[0.85rem] transition-colors duration-200 hover:text-white"
                                >
                                    Sign In
                                </a>
                            </li>
                        </ul>
                    </div>

                    {/* Newsletter */}
                    <div>
                        <h4 className="font-semibold mb-5 text-[0.95rem] text-white">
                            Newsletter
                        </h4>
                        <p className="text-[0.85rem] text-[#888] mb-[15px]">
                            Join our newsletter and get notified.
                        </p>
                        <div className="flex gap-[10px]">
                            <input
                                type="email"
                                placeholder="Enter your email..."
                                className="flex-grow border border-[#1A1A1A] bg-black text-white outline-none transition-colors duration-200 focus:border-[#444] text-[0.9rem] placeholder:text-[#555]"
                                style={{
                                    padding: "12px 16px",
                                    borderRadius: "10px",
                                    boxShadow:
                                        "inset 0 1px 3px rgba(0,0,0,0.3)",
                                }}
                            />
                            <button
                                className="group bg-white text-black border-none font-semibold cursor-pointer transition-all duration-200 hover:-translate-y-0.5 text-[0.9rem] flex items-center justify-center"
                                style={{
                                    padding: "12px 28px",
                                    borderRadius: "10px",
                                    boxShadow: "0 12px 24px rgba(0,0,0,0.4)",
                                }}
                            >
                                <span className="relative overflow-hidden h-[20px] flex flex-col leading-[20px]">
                                    <span className="flex flex-col transition-transform duration-500 ease-[cubic-bezier(0.25,0.1,0.25,1)] group-hover:-translate-y-1/2">
                                        <span>Subscribe</span>
                                        <span>Subscribe</span>
                                    </span>
                                </span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Bottom bar */}
                <div className="border-t border-[#1A1A1A] pt-[25px] pb-[10px] flex justify-between text-[0.85rem] text-[#888] max-[480px]:flex-col max-[480px]:gap-[15px] max-[480px]:items-center">
                    <span>All rights reserved. © 2026</span>
                    <span>Built by Raghul</span>
                </div>
            </div>
        </footer>
    );
};

export default Footer;

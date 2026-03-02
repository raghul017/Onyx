const Footer = () => {
    return (
        <footer className="flex flex-col md:flex-row border-t border-[#2A2A2A] w-full">
            {/* Left Section (Branding) */}
            <div className="w-full md:w-1/2 p-8 lg:p-12 pl-8">
                <span className="font-['Inter'] font-normal text-white text-[24px] tracking-tight">
                    Onyx
                </span>
            </div>

            {/* Right Section (Link Columns) */}
            <div className="w-full md:w-1/2 grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-[#2A2A2A] sm:border-l border-[#2A2A2A]">
                {/* Column 1 (Main) */}
                <div className="p-8 lg:p-12 font-['Inter']">
                    <h4 className="text-white text-sm mb-8 font-medium">
                        Main
                    </h4>
                    <div className="flex flex-col gap-5">
                        <a
                            href="#"
                            className="text-[#A1A1AA] text-sm hover:text-white transition-colors cursor-pointer block"
                        >
                            Platform / SDK
                        </a>
                        <a
                            href="#"
                            className="text-[#A1A1AA] text-sm hover:text-white transition-colors cursor-pointer block"
                        >
                            API Library
                        </a>
                        <a
                            href="#"
                            className="text-[#A1A1AA] text-sm hover:text-white transition-colors cursor-pointer block"
                        >
                            CLI App
                        </a>
                        <a
                            href="#"
                            className="text-[#A1A1AA] text-sm hover:text-white transition-colors cursor-pointer block"
                        >
                            Blog
                        </a>
                        <a
                            href="#"
                            className="text-[#A1A1AA] text-sm hover:text-white transition-colors cursor-pointer block"
                        >
                            Docs
                        </a>
                    </div>
                </div>

                {/* Column 2 (Company) */}
                <div className="p-8 lg:p-12 font-['Inter']">
                    <h4 className="text-white text-sm mb-8 font-medium">
                        Company
                    </h4>
                    <div className="flex flex-col gap-5">
                        <a
                            href="#"
                            className="text-[#A1A1AA] text-sm hover:text-white transition-colors cursor-pointer block"
                        >
                            About us
                        </a>
                        <a
                            href="#"
                            className="text-[#A1A1AA] text-sm hover:text-white transition-colors cursor-pointer block"
                        >
                            Careers
                        </a>
                        <a
                            href="#"
                            className="text-[#A1A1AA] text-sm hover:text-white transition-colors cursor-pointer block"
                        >
                            Contact Us
                        </a>
                        <a
                            href="#"
                            className="text-[#A1A1AA] text-sm hover:text-white transition-colors cursor-pointer block"
                        >
                            Privacy Policy
                        </a>
                        <a
                            href="#"
                            className="text-[#A1A1AA] text-sm hover:text-white transition-colors cursor-pointer block"
                        >
                            Terms of Use
                        </a>
                    </div>
                </div>

                {/* Column 3 (Links) */}
                <div className="p-8 lg:p-12 font-['Inter']">
                    <h4 className="text-white text-sm mb-8 font-medium">
                        Links
                    </h4>
                    <div className="flex flex-col gap-5">
                        <a
                            href="#"
                            className="text-[#A1A1AA] text-sm hover:text-white transition-colors cursor-pointer block"
                        >
                            X (Twitter)
                        </a>
                        <a
                            href="#"
                            className="text-[#A1A1AA] text-sm hover:text-white transition-colors cursor-pointer block"
                        >
                            Github
                        </a>
                        <a
                            href="#"
                            className="text-[#A1A1AA] text-sm hover:text-white transition-colors cursor-pointer block"
                        >
                            LinkedIn
                        </a>
                        <a
                            href="#"
                            className="text-[#A1A1AA] text-sm hover:text-white transition-colors cursor-pointer block"
                        >
                            Discord
                        </a>
                    </div>
                </div>
            </div>
        </footer>
    );
};

export default Footer;

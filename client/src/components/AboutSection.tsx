// =============================================================================
// AboutSection — Axion-style intro layout, dark Onyx theme
// =============================================================================

import { useNavigate } from "react-router-dom";
import RollButton from "./RollButton";

const SMALL_IMG =
    "https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20260516_090123_74be96d4-9c1b-40cf-932a-96f4f4babed3.png&w=1280&q=85";
const LARGE_IMG =
    "https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20260516_090133_c157d30b-a99a-4477-bec1-a446149ec3f2.png&w=1280&q=85";

// Orange button with text-roll hover, using the shared RollButton
const AboutButton = () => {
    const navigate = useNavigate();
    return (
        <RollButton
            label="About our studio"
            onClick={() => navigate("/signup")}
        />
    );
};

const AboutSection = () => {
    return (
        <section className="w-full py-16 sm:py-20 lg:py-24 overflow-hidden px-5 sm:px-8 lg:px-12">
            <div className="max-w-[1280px] mx-auto">
                {/* Badge row */}
                <div className="flex items-center gap-3 mb-6 sm:mb-8">
                    <div className="flex items-center justify-center w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-white text-black text-[11px] sm:text-[12px] font-semibold">
                        01
                    </div>
                    <span className="text-[12px] sm:text-[13px] font-medium text-white/80 border border-[#2A2A2A] rounded-full px-3 sm:px-4 py-1 sm:py-1.5">
                        Introducing Onyx
                    </span>
                </div>

                {/* Heading */}
                <h2
                    className="font-medium text-white mb-10 sm:mb-12 lg:mb-16"
                    style={{
                        fontSize: "clamp(1.5rem,4vw,3.2rem)",
                        lineHeight: 1.12,
                        letterSpacing: "-0.02em",
                    }}
                >
                    Security-led engineering, delivering
                    <br className="hidden sm:block" />
                    <span className="sm:hidden"> </span>
                    confidence across every endpoint.
                </h2>

                {/* MOBILE / TABLET — stacked */}
                <div className="lg:hidden">
                    <p className="text-[15px] sm:text-[17px] leading-[1.6] font-medium text-white">
                        Through AI-generated payloads, live telemetry and
                        CVSS-scored findings, we help growing teams ship APIs
                        that hold up under real attacks.
                    </p>
                    <div className="mt-6 mb-10">
                        <AboutButton />
                    </div>
                    <div className="flex flex-col sm:flex-row gap-4 sm:gap-5">
                        <img
                            src={SMALL_IMG}
                            alt="Onyx studio"
                            className="sm:w-[45%] aspect-[438/346] rounded-xl sm:rounded-2xl object-cover"
                        />
                        <img
                            src={LARGE_IMG}
                            alt="Onyx dashboard"
                            className="sm:w-[55%] aspect-[900/600] rounded-xl sm:rounded-2xl object-cover"
                        />
                    </div>
                </div>

                {/* DESKTOP — 3-column */}
                <div className="hidden lg:grid grid-cols-[26%_1fr_48%] items-end gap-6 xl:gap-8">
                    {/* Left — small image */}
                    <img
                        src={SMALL_IMG}
                        alt="Onyx studio"
                        className="self-end w-full aspect-[438/346] rounded-2xl object-cover"
                    />

                    {/* Center — paragraph + button */}
                    <div className="self-start flex flex-col items-end text-right">
                        <p className="text-[16px] xl:text-[18px] leading-[1.65] whitespace-nowrap font-medium text-white">
                            Through AI-generated payloads, live telemetry
                            <br />
                            and CVSS-scored findings, we help growing teams
                            <br />
                            ship APIs that hold up under real attacks.
                        </p>
                        <div className="mt-8">
                            <AboutButton />
                        </div>
                    </div>

                    {/* Right — large image */}
                    <img
                        src={LARGE_IMG}
                        alt="Onyx dashboard"
                        className="self-end w-full aspect-[3/2] rounded-2xl object-cover"
                    />
                </div>
            </div>
        </section>
    );
};

export default AboutSection;

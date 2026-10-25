import { useEffect } from "react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Navbar from "../components/Navbar";
import Hero from "../components/Hero";
import PoweredBy from "../components/PoweredBy";
import FeatureShowcase from "../components/FeatureShowcase";
import HowItWorks from "../components/HowItWorks";
import AuthenticatedScanning from "../components/AuthenticatedScanning";
import OwaspCoverage from "../components/OwaspCoverage";
import CiCdSection from "../components/CiCdSection";
import DemoSection from "../components/DemoSection";
import AboutSection from "../components/AboutSection";
import MoreFeatures from "../components/MoreFeatures";
import PricingSection from "../components/PricingSection";
import FaqCta from "../components/FaqCta";
import Footer from "../components/Footer";
import { useHashScroll } from "../hooks/useHashScroll";

// ---------------------------------------------------------------------------
// Trust strip — the hero's quick stats, moved OUT of the hero into their own
// thin band directly below it (keeps the hero to headline + subtext + CTA).
// ---------------------------------------------------------------------------
const TRUST_STATS = [
    { label: "Check types", value: "12" },
    { label: "Payloads / endpoint", value: "Up to 20" },
    { label: "Spec formats", value: "OpenAPI · Swagger" },
];

const TrustStrip = () => (
    <section className="border-b border-[#e6e6e6] px-6 py-7">
        <div className="max-w-[900px] mx-auto flex flex-col sm:flex-row items-stretch justify-center divide-y sm:divide-y-0 sm:divide-x divide-[#e6e6e6]">
            {TRUST_STATS.map((stat) => (
                <div
                    key={stat.label}
                    className="flex flex-col items-center gap-1.5 px-10 py-3 sm:py-0"
                >
                    <span className="text-[20px] font-medium leading-none tabular-nums whitespace-nowrap">
                        {stat.value}
                    </span>
                    <span className="font-mono text-[11px] text-[#999] uppercase tracking-wide leading-none whitespace-nowrap">
                        {stat.label}
                    </span>
                </div>
            ))}
        </div>
    </section>
);

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
const Landing = () => {
    // Scroll to a "/#anchor" target when arriving from the nav (incl. from
    // another route, which navigates home first then lands here with the hash).
    useHashScroll();

    // Recalculate ScrollTrigger positions once fonts and lazy assets settle, so
    // scrubbed animations don't "stick" against post-load layout shifts.
    useEffect(() => {
        const refresh = () => ScrollTrigger.refresh();
        const t = window.setTimeout(refresh, 400);
        if (document.fonts?.ready) document.fonts.ready.then(refresh);
        window.addEventListener("load", refresh);
        return () => {
            window.clearTimeout(t);
            window.removeEventListener("load", refresh);
        };
    }, []);

    return (
        // overflow-x-clip contains any sideways overflow WITHOUT creating a scroll
        // container (so it doesn't break the navbar's position:sticky, unlike
        // overflow-x-hidden).
        <div className="onyx-mono relative min-h-screen bg-[#f0f0f0] overflow-x-clip">
            {/* Bordered center column — content sits in a max-w frame with hairline
                left/right borders. The page behind is a touch darker (#f0f0f0) so the
                column (#fafafa) clearly reads as a centered frame with side gutters.
                No overflow-hidden here — it would break the navbar's position:sticky. */}
            <div className="relative mx-auto w-full max-w-[1440px] border-x border-[#e6e6e6] bg-[#fafafa] min-h-screen">
                <Navbar />

                <main>
                    {/* Hero */}
                    <Hero />

                    {/* Sections below the hero */}
                    <div className="relative w-full">
                        <TrustStrip />
                        <PoweredBy />
                        <AboutSection />
                        <HowItWorks />
                        <AuthenticatedScanning />
                        <OwaspCoverage />
                        <CiCdSection />
                        <DemoSection />
                        <FeatureShowcase />
                        <MoreFeatures />
                        <PricingSection />
                        <FaqCta />
                        <Footer />
                    </div>
                </main>
            </div>
        </div>
    );
};

export default Landing;

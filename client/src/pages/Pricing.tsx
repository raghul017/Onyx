// =============================================================================
// /pricing — standalone pricing route (T21a stub).
// Reuses the real homepage PricingSection so this page is already substantive.
// Full treatment (comparison table, FAQ, richer CTA) lands in T21d.
// =============================================================================
import MarketingPage from "../components/MarketingPage";
import PricingSection from "../components/PricingSection";

const Pricing = () => (
    <MarketingPage>
        <section className="border-b border-[#e6e6e6] px-6 pt-16 pb-10 lg:pt-24">
            <div className="max-w-[1280px] mx-auto">
                <div className="mono-eyebrow mb-4">
                    <span className="sq" /> PRICING
                </div>
                <h1 className="text-[clamp(2rem,5vw,44px)] leading-tight text-balance">
                    Plans that scale with your API.
                </h1>
                <p className="text-[15px] text-[#666] mt-4 max-w-xl leading-relaxed">
                    Start free — no credit card. Upgrade for more runs, larger specs,
                    every attack type, and PDF reports.
                </p>
            </div>
        </section>

        {/* The real tiers, shared with the homepage #pricing section. */}
        <PricingSection />
    </MarketingPage>
);

export default Pricing;

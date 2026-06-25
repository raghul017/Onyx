// =============================================================================
// AboutSection — "Why Onyx". Big scroll-revealed statement (word-by-word, with
// the hero gradient flowing inside the accent clause), followed by the feature
// bento: live Onyx previews that show the product instead of describing it.
// =============================================================================

import ScrollWordReveal from "./ScrollWordReveal";
import FeatureBento from "./FeatureBento";

const STATEMENT =
    "Most API vulnerabilities ship to production because the people who would find them never get the chance. Onyx gives them the chance.";

const AboutSection = () => {
    return (
        <section className="w-full overflow-hidden">
            {/* Big scroll-revealed statement */}
            <div className="max-w-[1280px] mx-auto px-5 sm:px-8 lg:px-12 pt-24 sm:pt-32 lg:pt-40">
                <ScrollWordReveal
                    text={STATEMENT}
                    mutedFrom={18}
                    className="text-left text-pretty"
                    style={{
                        fontFamily: '"Satoshi Variable", sans-serif',
                        fontWeight: 400,
                        fontSize: "clamp(2.25rem, 5.6vw, 4.5rem)",
                        lineHeight: 1.1,
                        letterSpacing: "-0.035em",
                    }}
                />
            </div>

            {/* Feature bento — live previews (flat variant: cards = page black) */}
            <FeatureBento variant="flat" />
        </section>
    );
};

export default AboutSection;

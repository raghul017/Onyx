// =============================================================================
// PoweredBy — continuously scrolling logo tape (marquee) of the real tech stack.
// Logo-only, real Simple Icons (brand colors). The track is duplicated and
// translated -50% for a seamless loop; edges fade via a mask. Pauses on hover,
// goes static under prefers-reduced-motion. Only marquee on the page.
// =============================================================================

// Real tech actually in the stack (README.md). Brand-colored Simple Icons.
const STACK = [
    { slug: "googlegemini", alt: "Google Gemini", color: "8E75F8" },
    { slug: "openapiinitiative", alt: "OpenAPI", color: "6BA539" },
    { slug: "redis", alt: "Redis", color: "FF4438" },
    { slug: "postgresql", alt: "PostgreSQL", color: "4169E1" },
    { slug: "react", alt: "React", color: "61DAFB" },
    { slug: "vercel", alt: "Vercel", color: "FFFFFF" },
    { slug: "typescript", alt: "TypeScript", color: "3178C6" },
    { slug: "express", alt: "Express", color: "FFFFFF" },
];

const Logo = ({ slug, alt, color }: { slug: string; alt: string; color: string }) => (
    <img
        src={`https://cdn.simpleicons.org/${slug}/${color}`}
        alt={alt}
        loading="lazy"
        className="h-6 sm:h-7 w-auto shrink-0 opacity-60 hover:opacity-100 transition-opacity duration-300"
        draggable={false}
    />
);

const PoweredBy = () => {
    // One half = the full stack. The track renders TWO halves and translates
    // -50%, so when the first half scrolls out the second is already in place
    // → seamless infinite loop. Equal gap on every item (incl. across the seam).
    const half = STACK.map((t) => (
        <li key={t.slug} className="flex items-center gap-2.5 shrink-0">
            <Logo {...t} />
            <span className="text-[13px] sm:text-[14px] text-white/55 whitespace-nowrap">
                {t.alt}
            </span>
        </li>
    ));

    return (
        <section className="w-full py-12 sm:py-14 border-b border-white/5">
            <div className="max-w-[1280px] mx-auto px-5 sm:px-8 lg:px-12">
                <p className="text-center text-[12px] sm:text-[13px] tracking-wide text-white/40 mb-8">
                    Built on the tools security teams already trust
                </p>
            </div>

            {/* Edge-faded marquee viewport */}
            <div
                className="group relative overflow-hidden"
                style={{
                    maskImage:
                        "linear-gradient(to right, transparent, black 8%, black 92%, transparent)",
                    WebkitMaskImage:
                        "linear-gradient(to right, transparent, black 8%, black 92%, transparent)",
                }}
            >
                {/* gap-x on the flex ul applies uniformly, including at the seam */}
                <ul className="onyx-marquee flex w-max items-center gap-x-14 sm:gap-x-20 pr-14 sm:pr-20">
                    {half}
                    {half}
                </ul>
            </div>
        </section>
    );
};

export default PoweredBy;

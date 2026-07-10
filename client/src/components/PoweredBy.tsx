// =============================================================================
// PoweredBy — continuously scrolling logo tape (marquee) of the real tech stack.
// Light-mono variant: ink logos on #fafafa, hard-bordered top/bottom, edges fade.
// =============================================================================

// Real tech actually in the stack (README.md). Rendered in ink (#000).
const STACK = [
    { slug: "googlegemini", alt: "Google Gemini" },
    { slug: "openapiinitiative", alt: "OpenAPI" },
    { slug: "redis", alt: "Redis" },
    { slug: "postgresql", alt: "PostgreSQL" },
    { slug: "react", alt: "React" },
    { slug: "vercel", alt: "Vercel" },
    { slug: "typescript", alt: "TypeScript" },
    { slug: "express", alt: "Express" },
];

const Logo = ({ slug, alt }: { slug: string; alt: string }) => (
    <img
        src={`https://cdn.simpleicons.org/${slug}/000000`}
        alt={alt}
        loading="lazy"
        className="h-5 sm:h-6 w-auto shrink-0 opacity-50 hover:opacity-100 transition-opacity duration-300"
        draggable={false}
    />
);

const PoweredBy = () => {
    const half = STACK.map((t) => (
        <li key={t.slug} className="flex items-center gap-2.5 shrink-0">
            <Logo {...t} />
            <span className="text-[13px] uppercase tracking-wide text-[#666] whitespace-nowrap">
                {t.alt}
            </span>
        </li>
    ));

    return (
        <section className="w-full border-b border-[#e6e6e6] py-12">
            <div className="max-w-[1280px] mx-auto px-6">
                <p className="text-center text-[12px] uppercase tracking-wide text-[#999] mb-8">
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
                <ul className="onyx-marquee flex w-max items-center gap-x-14 sm:gap-x-20 pr-14 sm:pr-20">
                    {half}
                    {half}
                </ul>
            </div>
        </section>
    );
};

export default PoweredBy;

// =============================================================================
// /changelog — user-facing Changelog page (T21f).
// Renders the curated CHANGELOG from ../data/changelog.ts (NOT docs/UPDATES.md,
// which is the internal dev log). Light-mono vertical timeline: dated release
// blocks, each with a tag chip + benefit-oriented bullet items.
// =============================================================================
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import MarketingPage from "../components/MarketingPage";
import { GITHUB_URL } from "../components/nav-config";
import { CHANGELOG, type ChangeTag } from "../data/changelog";

// Tag chip colors — reuse the landing palette (blue accent + neutral hairlines).
const tagChip: Record<ChangeTag, string> = {
    New: "border-[#93c5fd] text-[#3b82f6]",
    Improved: "border-[#e6e6e6] text-[#666]",
    Fixed: "border-[#e6e6e6] text-[#999]",
};

const Changelog = () => (
    <MarketingPage>
        {/* Header */}
        <section className="border-b border-[#e6e6e6] px-6 pt-16 pb-12 lg:pt-24">
            <div className="max-w-[900px] mx-auto">
                <div className="mono-eyebrow mb-4">
                    <span className="sq" /> CHANGELOG
                </div>
                <h1 className="text-[clamp(2rem,5vw,44px)] leading-tight text-balance">
                    What&rsquo;s new in Onyx.
                </h1>
                <p className="text-[15px] text-[#666] mt-4 max-w-xl leading-relaxed">
                    Product updates in plain language — new capabilities, improvements, and
                    fixes as they ship.
                </p>
            </div>
        </section>

        {/* Timeline of release blocks */}
        <section className="px-6 py-16 lg:py-24">
            <div className="max-w-[900px] mx-auto">
                <ol className="relative border-l border-[#e6e6e6] ml-2 md:ml-3">
                    {CHANGELOG.map((entry, i) => (
                        <li key={`${entry.iso}-${i}`} className="relative pl-8 md:pl-10 pb-12 last:pb-0">
                            {/* Node on the timeline rail */}
                            <span
                                className="absolute -left-[4.5px] top-1.5 w-2 h-2 bg-[#3b82f6]"
                                aria-hidden="true"
                            />
                            {/* Date + tag */}
                            <div className="flex items-center gap-3 mb-2">
                                <time
                                    dateTime={entry.iso}
                                    className="font-mono text-[11px] uppercase tracking-wider text-[#999]"
                                >
                                    {entry.date}
                                </time>
                                <span
                                    className={`border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider leading-none ${tagChip[entry.tag]}`}
                                >
                                    {entry.tag}
                                </span>
                            </div>

                            {/* Title + items */}
                            <h2 className="text-[17px] leading-snug mb-3">{entry.title}</h2>
                            <ul className="space-y-2">
                                {entry.items.map((item) => (
                                    <li
                                        key={item}
                                        className="flex items-start gap-2.5 text-[13.5px] text-[#666] leading-relaxed text-pretty"
                                    >
                                        <span
                                            className="mt-[7px] w-1 h-1 bg-[#ccc] shrink-0"
                                            aria-hidden="true"
                                        />
                                        {item}
                                    </li>
                                ))}
                            </ul>
                        </li>
                    ))}
                </ol>

                {/* Footer links */}
                <div className="flex flex-wrap gap-4 mt-4 pt-8 border-t border-[#e6e6e6]">
                    <Link to="/docs" className="mono-btn inline-flex w-max">
                        Read the docs
                        <ArrowRight size={14} />
                    </Link>
                    <a
                        href={GITHUB_URL}
                        target="_blank"
                        rel="noreferrer"
                        className="mono-btn-ghost inline-flex w-max"
                    >
                        Follow along on GitHub
                        <ArrowRight size={14} />
                    </a>
                </div>
            </div>
        </section>
    </MarketingPage>
);

export default Changelog;

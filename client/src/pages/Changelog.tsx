// =============================================================================
// /changelog — product updates (T21a stub).
// Presentable placeholder; T21f renders curated entries from docs/UPDATES.md.
// =============================================================================
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import MarketingPage from "../components/MarketingPage";
import { GITHUB_URL } from "../components/nav-config";

const Changelog = () => (
    <MarketingPage>
        <section className="border-b border-[#e6e6e6] px-6 pt-16 pb-12 lg:pt-24">
            <div className="max-w-[1280px] mx-auto">
                <div className="mono-eyebrow mb-4">
                    <span className="sq" /> CHANGELOG
                </div>
                <h1 className="text-[clamp(2rem,5vw,44px)] leading-tight text-balance">
                    Changelog
                </h1>
                <p className="text-[15px] text-[#666] mt-4 max-w-xl leading-relaxed">
                    Product updates — new attack types, authenticated scanning, OWASP API
                    Top 10 mapping, the CLI, and the GitHub Action. A curated timeline is
                    on the way.
                </p>

                <div className="flex flex-wrap gap-4 mt-10">
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

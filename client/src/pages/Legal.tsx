// =============================================================================
// Legal pages — /privacy, /terms, /responsible-disclosure (T21a stubs).
// One presentable, titled placeholder parameterized by props. Real content
// (reviewed by a lawyer) lands in T21g.
// =============================================================================
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import MarketingPage from "../components/MarketingPage";
import { GITHUB_URL } from "../components/nav-config";

interface LegalProps {
    eyebrow: string;
    title: string;
    intro: string;
}

const LegalPage = ({ eyebrow, title, intro }: LegalProps) => (
    <MarketingPage>
        <section className="border-b border-[#e6e6e6] px-6 pt-16 pb-12 lg:pt-24">
            <div className="max-w-[760px] mx-auto">
                <div className="mono-eyebrow mb-4">
                    <span className="sq" /> {eyebrow}
                </div>
                <h1 className="text-[clamp(2rem,5vw,44px)] leading-tight text-balance">
                    {title}
                </h1>
                <p className="text-[15px] text-[#666] mt-4 leading-relaxed">{intro}</p>
                <p className="text-[13px] text-[#999] mt-6 leading-relaxed">
                    The full text is being finalized. In the meantime, reach us with any
                    question via{" "}
                    <a
                        href={`${GITHUB_URL}/issues`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[#3b82f6] hover:underline"
                    >
                        GitHub Issues
                    </a>
                    .
                </p>

                <Link to="/" className="mono-btn-ghost mt-10 inline-flex w-max">
                    Back to home
                    <ArrowRight size={14} />
                </Link>
            </div>
        </section>
    </MarketingPage>
);

export const Privacy = () => (
    <LegalPage
        eyebrow="PRIVACY"
        title="Privacy Policy"
        intro="How Onyx collects, uses, and protects your data — including scan targets, credentials, and account information."
    />
);

export const Terms = () => (
    <LegalPage
        eyebrow="TERMS"
        title="Terms of Service"
        intro="The terms that govern your use of Onyx, including acceptable use, authorization to test only APIs you own, and billing."
    />
);

export const ResponsibleDisclosure = () => (
    <LegalPage
        eyebrow="DISCLOSURE"
        title="Responsible Disclosure"
        intro="Found a vulnerability in Onyx itself? We welcome coordinated disclosure. Report it and we'll work with you on a fix and timeline."
    />
);

export default LegalPage;

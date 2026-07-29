// =============================================================================
// Legal pages — /privacy, /terms, /responsible-disclosure (T21g).
//
// DRAFTS, NOT LEGAL ADVICE. Bracketed [PLACEHOLDERS] must be filled by the owner /
// a lawyer before these are relied upon: legal entity, jurisdiction, effective
// date, and the support@/security@/legal@ mailboxes (which must be created).
//
// Data-handling statements are written to match the real code (verified):
//   • Stored: email, optional name, passwordHash (null for OAuth), Google/GitHub
//     OAuth identity, plan + Razorpay subscription id/expiry, org membership;
//     target spec URLs + endpoints; AttackLog (method/path/payload/status/latency
//     + responseSnippet, REDACTED and capped at 500 chars — worker.ts, redact.ts);
//     AuthRecipe secrets ENCRYPTED at rest (AES-256-GCM, secretEnc; meta holds
//     only non-secret descriptors + last4); ApiToken stored as SHA-256 HASH;
//     Razorpay WebhookEvent ids.  (schema.prisma)
//   • Processors: Neon (Postgres), Upstash/Redis (queue), Render (API) + Vercel
//     (web + analytics/speed-insights), Razorpay (payments), Google/GitHub (OAuth),
//     Google Gemini (payload generation).
// =============================================================================
import { type ReactNode } from "react";
import { Link } from "react-router-dom";
import MarketingPage from "../components/MarketingPage";

// ---- Prose primitives (light-mono long-form document) ----------------------
const H2 = ({ children }: { children: ReactNode }) => (
    <h2 className="text-[20px] leading-tight mt-12 mb-3 first:mt-0">{children}</h2>
);
const H3 = ({ children }: { children: ReactNode }) => (
    <h3 className="text-[15px] font-medium mt-6 mb-2">{children}</h3>
);
const P = ({ children }: { children: ReactNode }) => (
    <p className="text-[14px] text-[#444] leading-[1.75] mt-3 text-pretty">{children}</p>
);
const UL = ({ children }: { children: ReactNode }) => (
    <ul className="mt-3 space-y-2">{children}</ul>
);
const LI = ({ children }: { children: ReactNode }) => (
    <li className="flex items-start gap-2.5 text-[14px] text-[#444] leading-[1.7]">
        <span className="mt-[9px] w-1 h-1 bg-[#3b82f6] shrink-0" aria-hidden="true" />
        <span>{children}</span>
    </li>
);
// A bracketed placeholder rendered so it's visually obvious it needs filling in.
const PH = ({ children }: { children: ReactNode }) => (
    <span className="font-mono text-[12px] bg-[#eff6ff] border border-[#93c5fd] text-[#3b82f6] px-1 py-0.5">
        {children}
    </span>
);

const LegalDoc = ({
    eyebrow,
    title,
    intro,
    children,
}: {
    eyebrow: string;
    title: string;
    intro: string;
    children: ReactNode;
}) => (
    <MarketingPage>
        {/* Header */}
        <section className="border-b border-[#e6e6e6] px-6 pt-16 pb-10 lg:pt-24">
            <div className="max-w-[760px] mx-auto">
                <div className="mono-eyebrow mb-4">
                    <span className="sq" /> {eyebrow}
                </div>
                <h1 className="text-[clamp(2rem,5vw,44px)] leading-tight text-balance">{title}</h1>
                <p className="text-[15px] text-[#666] mt-4 leading-relaxed max-w-xl">{intro}</p>
                <p className="text-[12px] text-[#999] mt-6 font-mono">
                    Effective date: <PH>[Effective Date]</PH> · Operated by <PH>[Legal Entity Name]</PH>
                </p>
            </div>
        </section>

        {/* Body */}
        <section className="px-6 py-16 lg:py-24">
            <article className="max-w-[760px] mx-auto">
                <div className="border border-[#fdba74] bg-[#fff7ed] px-4 py-3 mb-10 text-[13px] text-[#9a3412] leading-relaxed">
                    <strong>Draft — not legal advice.</strong> This document is a good-faith
                    description of our practices and is being finalized. Bracketed fields
                    (e.g. <PH>[Jurisdiction]</PH>) still need to be completed.
                </div>
                {children}

                <div className="mt-14 pt-8 border-t border-[#e6e6e6]">
                    <Link to="/" className="text-[#3b82f6] text-[14px] hover:underline">
                        ← Back to home
                    </Link>
                </div>
            </article>
        </section>
    </MarketingPage>
);

// ============================================================================
// PRIVACY POLICY
// ============================================================================
export const Privacy = () => (
    <LegalDoc
        eyebrow="PRIVACY"
        title="Privacy Policy"
        intro="How Onyx collects, uses, shares, and protects your information."
    >
        <H2>1. Who we are</H2>
        <P>
            Onyx (&ldquo;Onyx&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;) is an API security
            testing platform operated by <PH>[Legal Entity Name]</PH>. This policy explains
            what data we handle and why. Questions? Contact{" "}
            <PH>privacy@[your-domain]</PH>.
        </P>

        <H2>2. Information we collect</H2>
        <H3>Account information</H3>
        <P>
            When you create an account we store your email address and, optionally, a display
            name. If you register with a password, we store only a one-way{" "}
            <em>bcrypt hash</em> of it — never the password itself. If you sign in with Google
            or GitHub, we store the identifier those providers return so we can recognize you;
            we do not receive your Google/GitHub password.
        </P>
        <H3>Scan data</H3>
        <P>
            To run a scan we store the target API specification URL and the endpoints we
            discover from it, plus the results of each attack request: HTTP method, path,
            the payload sent, response status code, and latency. We also store a short{" "}
            <em>response snippet</em> as evidence — this is <strong>redacted</strong> to mask
            secrets (bearer tokens, API keys, passwords) and <strong>capped in length</strong>{" "}
            before it is written to our database, so raw credentials are not persisted.
        </P>
        <H3>Credentials for authenticated scans</H3>
        <P>
            If you configure an authentication recipe (for scanning behind a login), the secret
            value is <strong>encrypted at rest</strong> using authenticated AES-256-GCM
            encryption. We retain only non-secret descriptors (such as the header/cookie name
            and the last four characters) for display; the full secret is never returned to the
            UI or written to logs.
        </P>
        <H3>API tokens</H3>
        <P>
            Long-lived API tokens for the CLI and CI are stored only as{" "}
            <em>SHA-256 hashes</em>. The plaintext token is shown to you once at creation and
            never stored; you can revoke a token at any time.
        </P>
        <H3>Billing information</H3>
        <P>
            Payments are processed by Razorpay. We do <strong>not</strong> store your card or
            bank details; we retain your plan, a Razorpay subscription identifier, the plan
            expiry, and the identifiers of billing webhook events we receive.
        </P>
        <H3>Usage &amp; analytics</H3>
        <P>
            Our website uses Vercel Analytics and Speed Insights to understand aggregate,
            privacy-friendly usage and performance. We do not use these to build advertising
            profiles.
        </P>

        <H2>3. How we use your information</H2>
        <UL>
            <LI>To provide the service — run scans, stream results, and generate reports.</LI>
            <LI>To authenticate you and secure your account.</LI>
            <LI>To process subscriptions and billing.</LI>
            <LI>To operate, debug, and improve the platform.</LI>
            <LI>To communicate service-related notices.</LI>
        </UL>
        <P>
            Our legal basis for processing (where applicable, e.g. GDPR) is performance of our
            contract with you, your consent, and our legitimate interest in operating and
            securing the service. <PH>[Confirm legal-basis framing for your jurisdiction.]</PH>
        </P>

        <H2>4. Third-party processors</H2>
        <P>We share data with the following providers only as needed to run Onyx:</P>
        <UL>
            <LI><strong>Neon</strong> — managed PostgreSQL database (your account and scan data).</LI>
            <LI><strong>Upstash / Redis</strong> — the job queue that schedules scan work.</LI>
            <LI><strong>Render</strong> — hosting for the API/backend.</LI>
            <LI><strong>Vercel</strong> — hosting for the web app, plus analytics and speed insights.</LI>
            <LI><strong>Razorpay</strong> — payment processing for subscriptions.</LI>
            <LI><strong>Google</strong> and <strong>GitHub</strong> — optional OAuth sign-in.</LI>
            <LI>
                <strong>Google Gemini</strong> — generates schema-aware attack payloads from
                your API specification. Endpoint descriptors from your spec are sent to Gemini
                for this purpose.
            </LI>
        </UL>
        <P>
            Each processor handles data under its own terms and security controls. We do not
            sell your personal information.
        </P>

        <H2>5. Data retention</H2>
        <P>
            We retain account data for as long as your account is active. Scan data and their
            (redacted, length-capped) response snippets are retained so you can review past
            reports; deleting a test run removes its associated attack logs. You may request
            deletion of your account and associated data (see &ldquo;Your rights&rdquo;).
            <PH>[Set concrete retention periods.]</PH>
        </P>

        <H2>6. Security</H2>
        <P>
            We apply encryption at rest for authentication secrets (AES-256-GCM), store tokens
            and passwords only as hashes, redact secrets from stored evidence, and enforce an
            SSRF guard and domain-ownership verification so scans only reach targets you own.
            See our <Link to="/security" className="text-[#3b82f6] hover:underline">Security page</Link>{" "}
            for details. No method of transmission or storage is 100% secure.
        </P>

        <H2>7. Your rights</H2>
        <P>
            Depending on your location, you may have rights to access, correct, export, or
            delete your personal data, and to object to or restrict certain processing. To
            exercise these, contact <PH>privacy@[your-domain]</PH>. We will respond within the
            timeframe required by applicable law.
        </P>

        <H2>8. Children</H2>
        <P>
            Onyx is not directed to individuals under 18, and we do not knowingly collect
            personal data from them.
        </P>

        <H2>9. International transfers</H2>
        <P>
            Our processors may store or process data in regions outside your own. Where required,
            we rely on appropriate safeguards for such transfers. <PH>[Confirm transfer mechanism.]</PH>
        </P>

        <H2>10. Changes to this policy</H2>
        <P>
            We may update this policy from time to time. Material changes will be reflected by an
            updated effective date, and where appropriate we will notify you.
        </P>

        <H2>11. Contact</H2>
        <P>
            Questions about this policy or your data: <PH>privacy@[your-domain]</PH>, operated by{" "}
            <PH>[Legal Entity Name]</PH>, <PH>[Address]</PH>.
        </P>
    </LegalDoc>
);

// ============================================================================
// TERMS OF SERVICE
// ============================================================================
export const Terms = () => (
    <LegalDoc
        eyebrow="TERMS"
        title="Terms of Service"
        intro="The terms that govern your use of Onyx. By using Onyx you agree to them."
    >
        <H2>1. Agreement</H2>
        <P>
            These Terms are a binding agreement between you and <PH>[Legal Entity Name]</PH>{" "}
            governing your access to and use of Onyx. If you use Onyx on behalf of an
            organization, you represent that you are authorized to bind it.
        </P>

        <H2>2. Acceptable use &mdash; authorization is mandatory</H2>
        <P>
            Onyx is an offensive security-testing tool. You may use it{" "}
            <strong>only</strong> against APIs, domains, and systems that{" "}
            <strong>you own or are explicitly authorized in writing to test</strong>. To help
            enforce this, Onyx requires <strong>domain-ownership verification</strong> (a probe
            file or DNS record) before it will scan a target.
        </P>
        <P>You must not, and must not attempt to:</P>
        <UL>
            <LI>Scan, probe, or attack any system you do not own or lack explicit authorization to test.</LI>
            <LI>Use Onyx to conduct denial-of-service attacks or to degrade any third party&rsquo;s service.</LI>
            <LI>Use Onyx for any unlawful purpose or to violate the rights of others.</LI>
            <LI>Circumvent the domain-verification, rate-limiting, quota, or SSRF controls.</LI>
            <LI>Resell, or provide access to, the service in violation of these Terms.</LI>
        </UL>
        <P>
            <strong>You are solely responsible for ensuring you have authorization</strong> for
            every target you test. Unauthorized testing may be illegal, and violations may
            result in immediate suspension or termination.
        </P>

        <H2>3. Accounts</H2>
        <P>
            You are responsible for your account credentials and API tokens and for all activity
            under your account. Keep them secure and notify us of any unauthorized use. You must
            provide accurate registration information and be at least 18 years old.
        </P>

        <H2>4. Plans, billing &amp; cancellation</H2>
        <P>
            Paid plans are billed through Razorpay on a recurring basis at the prices shown on
            our <Link to="/pricing" className="text-[#3b82f6] hover:underline">Pricing page</Link>{" "}
            (priced in USD, billed in INR). Plan quotas (monthly runs, endpoints per run) apply
            as described there.
        </P>
        <P>
            You can <strong>cancel anytime</strong> from the Billing page; your paid access
            continues until the end of the current billing period, after which your account
            reverts to the Free plan. <PH>[Refund policy, if any — do not assume one exists.]</PH>{" "}
            Taxes may apply depending on your location.
        </P>

        <H2>5. Service availability</H2>
        <P>
            We aim to keep Onyx available and reliable but do not guarantee uninterrupted
            service. We may modify, suspend, or discontinue features with reasonable notice
            where practicable.
        </P>

        <H2>6. Intellectual property</H2>
        <P>
            Onyx and its software, branding, and content are owned by{" "}
            <PH>[Legal Entity Name]</PH> and its licensors. You retain ownership of the specs and
            data you submit; you grant us the limited rights needed to operate the service for you.
        </P>

        <H2>7. Disclaimer of warranties</H2>
        <P>
            Onyx is provided <strong>&ldquo;as is&rdquo;</strong> and{" "}
            <strong>&ldquo;as available&rdquo;</strong>, without warranties of any kind, express
            or implied, including merchantability, fitness for a particular purpose, and
            non-infringement. Security testing is inherently probabilistic; Onyx does not
            guarantee that it will find every vulnerability or that findings are exhaustive or
            free of false positives.
        </P>

        <H2>8. Limitation of liability</H2>
        <P>
            To the maximum extent permitted by law, <PH>[Legal Entity Name]</PH> will not be
            liable for indirect, incidental, special, consequential, or punitive damages, or for
            lost profits or data. Our aggregate liability arising out of or relating to the
            service will not exceed the amount you paid us in the{" "}
            <PH>[12 months]</PH> preceding the claim.
        </P>

        <H2>9. Indemnification</H2>
        <P>
            You agree to indemnify and hold <PH>[Legal Entity Name]</PH> harmless from claims
            arising out of your use of Onyx in breach of these Terms, including any unauthorized
            testing of systems you did not have permission to test.
        </P>

        <H2>10. Termination</H2>
        <P>
            You may stop using Onyx at any time. We may suspend or terminate access for breach of
            these Terms — in particular the acceptable-use section — or as required by law.
        </P>

        <H2>11. Governing law</H2>
        <P>
            These Terms are governed by the laws of <PH>[Jurisdiction]</PH>, without regard to
            conflict-of-laws rules. <PH>[Venue / dispute-resolution clause.]</PH>
        </P>

        <H2>12. Changes</H2>
        <P>
            We may update these Terms; continued use after changes take effect constitutes
            acceptance. Material changes will be reflected by an updated effective date.
        </P>

        <H2>13. Contact</H2>
        <P>
            Questions about these Terms: <PH>legal@[your-domain]</PH>, <PH>[Legal Entity Name]</PH>.
        </P>
    </LegalDoc>
);

// ============================================================================
// RESPONSIBLE DISCLOSURE
// ============================================================================
export const ResponsibleDisclosure = () => (
    <LegalDoc
        eyebrow="DISCLOSURE"
        title="Responsible Disclosure"
        intro="Found a security issue in Onyx itself? We want to hear from you — privately."
    >
        <H2>Report privately</H2>
        <P>
            If you discover a vulnerability in Onyx, please report it{" "}
            <strong>privately</strong> to <PH>security@[your-domain]</PH> and give us a
            reasonable opportunity to fix it before any public disclosure.{" "}
            <strong>Please do not open a public GitHub issue for security reports</strong>, as
            that discloses the vulnerability to everyone before a fix is available.
        </P>

        <H2>Safe harbor</H2>
        <P>
            We will not pursue or support legal action against researchers who, in good faith:
        </P>
        <UL>
            <LI>Make a genuine effort to avoid privacy violations, data destruction, and service disruption.</LI>
            <LI>Only interact with accounts they own or have explicit permission to access.</LI>
            <LI>Give us reasonable time to remediate before disclosing publicly.</LI>
            <LI>Do not exfiltrate data beyond the minimum needed to demonstrate the issue.</LI>
        </UL>
        <P>
            Good-faith research conducted consistently with this policy is considered authorized.
            If in doubt, ask us first at <PH>security@[your-domain]</PH>.
        </P>

        <H2>In scope</H2>
        <UL>
            <LI>The Onyx web application and its API.</LI>
            <LI>Authentication, authorization, and access-control issues.</LI>
            <LI>Handling of secrets, tokens, and scan evidence.</LI>
            <LI>Bypasses of the SSRF guard or domain-ownership verification.</LI>
        </UL>

        <H2>Out of scope</H2>
        <UL>
            <LI>Findings that require access to a user&rsquo;s device or physical access.</LI>
            <LI>Social engineering, spam, or denial-of-service testing against our infrastructure.</LI>
            <LI>Reports from automated scanners without a demonstrated, exploitable impact.</LI>
            <LI>Issues in third-party services we use (report those to the respective vendor).</LI>
        </UL>

        <H2>What to include</H2>
        <UL>
            <LI>A clear description of the issue and its impact.</LI>
            <LI>Step-by-step reproduction, including any proof-of-concept.</LI>
            <LI>Affected URLs, endpoints, or components.</LI>
        </UL>

        <H2>What to expect</H2>
        <P>
            We aim to acknowledge reports promptly and to keep you updated as we investigate and
            remediate. <PH>[State your target acknowledgement/response window, e.g. 3 business days.]</PH>{" "}
            We&rsquo;re a small team and appreciate your patience and discretion.
        </P>

        <H2>Contact</H2>
        <P>
            Security reports: <PH>security@[your-domain]</PH>. For non-security questions, use the
            channels on our other pages.
        </P>
    </LegalDoc>
);

export default LegalDoc;

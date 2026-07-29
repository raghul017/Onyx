// =============================================================================
// /pricing — full standalone Pricing page (T21d).
// Reuses the shared tier cards (PricingSection) + a real quota/feature comparison
// table + a billing FAQ + CTA. All values come from ../components/plans.ts, the
// single source of truth mirrored from the server quota config and Billing page.
// Light-mono throughout; billing logic is untouched (cards link to /billing).
// =============================================================================
import { useState } from "react";
import { Link } from "react-router-dom";
import { Check, X, Minus, Plus, ArrowRight } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import MarketingPage from "../components/MarketingPage";
import PricingSection from "../components/PricingSection";
import { PLAN_COLUMNS, COMPARE_ROWS, type CellValue } from "../components/plans";

const Cell = ({ value }: { value: CellValue }) => {
    if (typeof value === "boolean") {
        return value ? (
            <Check size={15} className="text-[#3b82f6] mx-auto" aria-label="Included" />
        ) : (
            <X size={15} className="text-[#ccc] mx-auto" aria-label="Not included" />
        );
    }
    return <span className="text-[13px] text-[#333]">{value}</span>;
};

const ComparisonTable = () => (
    <section className="border-b border-[#e6e6e6] px-6 py-16 lg:py-24">
        <div className="max-w-[1280px] mx-auto">
            <div className="mono-eyebrow mb-4">
                <span className="sq" /> COMPARE PLANS
            </div>
            <h2 className="text-[clamp(1.75rem,4vw,32px)] leading-tight text-balance mb-8">
                Everything in each plan
            </h2>

            {/* Horizontal scroll on small screens; the table never overflows the page. */}
            <div className="overflow-x-auto border border-[#e6e6e6]">
                <table className="w-full min-w-[560px] border-collapse text-left">
                    <thead>
                        <tr className="border-b border-[#e6e6e6] bg-white">
                            <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-wider text-[#666] font-normal">
                                Feature
                            </th>
                            {PLAN_COLUMNS.map((col) => (
                                <th
                                    key={col}
                                    className="px-4 py-3 text-center font-mono text-[11px] uppercase tracking-wider text-[#666] font-normal w-[22%]"
                                >
                                    {col}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {COMPARE_ROWS.map((row) => (
                            <tr
                                key={row.label}
                                className="border-b border-[#e6e6e6] last:border-b-0 hover:bg-[#fafafa] transition-colors"
                            >
                                <th
                                    scope="row"
                                    className="px-4 py-3 text-[13px] text-[#333] font-normal"
                                >
                                    {row.label}
                                </th>
                                {row.values.map((v, i) => (
                                    <td key={i} className="px-4 py-3 text-center">
                                        <Cell value={v} />
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <p className="text-[12px] text-[#999] mt-3">
                Priced in USD, billed in INR · Cancel anytime.
            </p>
        </div>
    </section>
);

const FAQS: { q: string; a: React.ReactNode }[] = [
    {
        q: "What counts as a test run?",
        a: "One scan of one spec — Onyx parses your OpenAPI/Swagger spec and fires its attack payloads at the discovered endpoints. Your monthly quota counts completed runs in the current calendar month (5 on Free, 100 on Pro, 500 on Team).",
    },
    {
        q: "Can I change plans anytime?",
        a: "Yes. Upgrade or downgrade from the Billing page; changes take effect immediately and your quota reflects the new plan.",
    },
    {
        q: "Is billing in USD or INR?",
        a: "Plans are priced in USD ($9 Pro, $18 Team) and billed in INR through Razorpay (₹900 and ₹1800 respectively).",
    },
    {
        q: "What happens when I hit my quota?",
        a: "New runs are blocked for the rest of the month (the API returns a quota-exceeded response) until the next calendar month resets it, or you upgrade for a higher limit.",
    },
    {
        q: "Is there a free tier?",
        a: "Yes — Free is free forever: 5 runs/month, 10 endpoints per run, and no credit card required.",
    },
    {
        q: "How do refunds and cancellation work?",
        a: (
            <>
                You can cancel anytime from the Billing page; your plan stays active
                until the end of the current period. For refund requests or billing
                questions, see our{" "}
                <Link to="/terms" className="text-[#3b82f6] hover:underline">
                    Terms
                </Link>{" "}
                or reach out via the{" "}
                <Link to="/responsible-disclosure" className="text-[#3b82f6] hover:underline">
                    contact channels
                </Link>
                .
            </>
        ),
    },
];

const BillingFaq = () => {
    const [active, setActive] = useState<number | null>(0);
    const toggle = (i: number) => setActive((p) => (p === i ? null : i));

    return (
        <section className="border-b border-[#e6e6e6] px-6 py-16 lg:py-24">
            <div className="max-w-[1280px] mx-auto grid grid-cols-1 md:grid-cols-[0.9fr_1.4fr] gap-10">
                <div>
                    <div className="mono-eyebrow mb-4">
                        <span className="sq" /> BILLING FAQ
                    </div>
                    <h2 className="text-[clamp(1.75rem,4vw,32px)] leading-tight text-balance">
                        Questions about pricing
                    </h2>
                </div>

                <div className="flex flex-col border-t border-[#e6e6e6]">
                    {FAQS.map((item, i) => {
                        const open = active === i;
                        const panelId = `pricing-faq-panel-${i}`;
                        const buttonId = `pricing-faq-button-${i}`;
                        return (
                            <div key={i} className="border-b border-[#e6e6e6]">
                                <button
                                    id={buttonId}
                                    onClick={() => toggle(i)}
                                    aria-expanded={open}
                                    aria-controls={panelId}
                                    className="w-full flex justify-between items-center text-left text-[15px] gap-4 py-5 cursor-pointer hover:opacity-70 transition-opacity"
                                >
                                    <span>{item.q}</span>
                                    {open ? (
                                        <Minus size={18} className="shrink-0 text-[#3b82f6]" />
                                    ) : (
                                        <Plus size={18} className="shrink-0 text-[#666]" />
                                    )}
                                </button>
                                <AnimatePresence initial={false}>
                                    {open && (
                                        <motion.div
                                            id={panelId}
                                            role="region"
                                            aria-labelledby={buttonId}
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: "auto", opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            transition={{ duration: 0.25, ease: "easeInOut" }}
                                            className="overflow-hidden"
                                        >
                                            <div className="pb-5 text-[13.5px] text-[#666] leading-relaxed max-w-xl text-pretty">
                                                {item.a}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        );
                    })}
                </div>
            </div>
        </section>
    );
};

const FinalCta = () => (
    <section className="bg-black text-white px-6 py-16 lg:py-24">
        <div className="max-w-[1280px] mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
            <h2 className="text-[clamp(1.75rem,4vw,32px)] text-center md:text-left leading-[1.1] text-balance">
                Start free. Upgrade when you need more.
            </h2>
            <Link
                to="/signup"
                className="group bg-white text-black px-6 py-3 font-mono uppercase text-[13px] tracking-wide font-medium hover:bg-neutral-200 transition-colors flex items-center gap-2"
            >
                Start free scan
                <ArrowRight
                    size={14}
                    className="transition-transform duration-300 group-hover:translate-x-0.5"
                />
            </Link>
        </div>
    </section>
);

const Pricing = () => (
    <MarketingPage>
        {/* Hero */}
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

        {/* Tier cards — shared with the homepage #pricing section. */}
        <PricingSection />

        <ComparisonTable />
        <BillingFaq />
        <FinalCta />
    </MarketingPage>
);

export default Pricing;

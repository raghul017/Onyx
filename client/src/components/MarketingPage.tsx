// =============================================================================
// MarketingPage — shared shell for the public marketing routes (T21a).
// Reuses the exact landing frame (onyx-mono, #f0f0f0 backdrop, bordered #fafafa
// center column) plus the Navbar and Footer, so every stub page reads as part
// of the site rather than a bare route. Content pages fill in via children.
// =============================================================================
import { type ReactNode } from "react";
import Navbar from "./Navbar";
import Footer from "./Footer";
import { useHashScroll } from "../hooks/useHashScroll";

const MarketingPage = ({ children }: { children: ReactNode }) => {
    useHashScroll();
    return (
        <div className="onyx-mono relative min-h-screen bg-[#f0f0f0] overflow-x-clip">
            <div className="relative mx-auto w-full max-w-[1440px] border-x border-[#e6e6e6] bg-[#fafafa] min-h-screen flex flex-col">
                <Navbar />
                <main className="flex-1">{children}</main>
                <Footer />
            </div>
        </div>
    );
};

export default MarketingPage;

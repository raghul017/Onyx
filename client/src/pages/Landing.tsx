import Navbar from "../components/Navbar";
import Hero from "../components/Hero";
import FeatureShowcase from "../components/FeatureShowcase";
import SupportedTech from "../components/SupportedTech";
import Pipeline from "../components/Pipeline";
import FinalCTA from "../components/FinalCTA";
import AdvancedFeatures from "../components/AdvancedFeatures";
import Footer from "../components/Footer";
// Ah, the user deleted them all in the prompt updates (Step 119-124).
// Let's just mount Navbar and Hero for now based on the task.

const Landing = () => {
    return (
        <div className="relative min-h-screen bg-black text-white selection:bg-cyan-400 selection:text-black font-['Inter'] overflow-x-hidden">
            {/* 1. The Slanted Background Lines Layer */}
            <div
                className="fixed inset-0 pointer-events-none z-0"
                style={{
                    backgroundImage:
                        "repeating-linear-gradient(45deg, #222 0, #222 1px, transparent 1px, transparent 16px)",
                    WebkitMaskImage:
                        "linear-gradient(to bottom, black 10%, transparent 100%)",
                    maskImage:
                        "linear-gradient(to bottom, black 10%, transparent 100%)",
                }}
            />

            <Navbar />

            {/* 2. The Master Content Grid */}
            <div className="w-[90%] max-w-6xl mx-auto min-h-screen border-x border-[#333333] relative bg-black z-10 pt-16">
                <main>
                    <Hero />
                    <Pipeline />
                    <FeatureShowcase />
                    <AdvancedFeatures />
                    <SupportedTech />
                    <FinalCTA />
                    <Footer />
                </main>
            </div>
        </div>
    );
};

export default Landing;

import Navbar from "../components/Navbar";
import Hero from "../components/Hero";
import FeatureShowcase from "../components/FeatureShowcase";
import SupportedTech from "../components/SupportedTech";
import Pipeline from "../components/Pipeline";
import Footer from "../components/Footer";

const Landing = () => {
    return (
        <div className="relative min-h-screen bg-black text-white selection:bg-cyan-400 selection:text-black font-['Inter'] overflow-x-hidden">
            {/* Slanted Background Lines */}
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

            {/* Master Content Grid */}
            <div className="w-[90%] max-w-6xl mx-auto min-h-screen border-x border-[#333333] relative bg-black z-10 pt-16">
                <main>
                    <Hero />
                    <Pipeline />
                    <FeatureShowcase />
                    <SupportedTech />
                    <Footer />
                </main>
            </div>
        </div>
    );
};

export default Landing;

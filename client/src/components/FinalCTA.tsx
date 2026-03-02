import { ArrowRight } from "lucide-react";

const FinalCTA = () => {
    return (
        <section className="py-32 px-8 w-full flex flex-col items-center justify-center text-center">
            <h2 className="font-['Satoshi_Variable'] font-medium text-[48px] md:text-[64px] text-white tracking-tight leading-tight mb-6 max-w-2xl">
                Secure your infrastructure today.
            </h2>

            <p className="text-[#A1A1AA] font-['Inter'] text-lg mb-10 max-w-xl">
                Stop guessing. Start breaking.
            </p>

            <button className="bg-white text-black px-8 py-4 rounded-md font-['Inter'] font-medium hover:bg-neutral-200 transition-colors flex items-center gap-2 group">
                Launch Console
                <ArrowRight
                    size={18}
                    className="group-hover:translate-x-1 transition-transform"
                />
            </button>
        </section>
    );
};

export default FinalCTA;

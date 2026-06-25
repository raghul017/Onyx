// =============================================================================
// ScrollWordReveal — large statement text that reveals word-by-word as the user
// scrolls through it (scrubbed GSAP timeline). Words start dim/blurred and
// resolve to full white as they pass through the viewport.
//
// Pattern: scroll-linked per-word stagger (make-interfaces: split title into
// words, combine opacity + blur + translateY). GSAP best practice: useGSAP()
// for automatic cleanup, scrub timeline, refresh after fonts load. Honors
// prefers-reduced-motion (renders fully visible, no motion).
// =============================================================================

import { useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { useReducedMotion } from "framer-motion";

gsap.registerPlugin(ScrollTrigger);

interface ScrollWordRevealProps {
    text: string;
    /** Words at this index and beyond render muted (the "payoff" clause). */
    mutedFrom?: number;
    className?: string;
    style?: React.CSSProperties;
}

const ScrollWordReveal = ({
    text,
    mutedFrom,
    className = "",
    style,
}: ScrollWordRevealProps) => {
    const ref = useRef<HTMLParagraphElement>(null);
    const reduce = useReducedMotion();
    const words = text.split(" ");

    useGSAP(
        () => {
            if (!ref.current) return;
            const wordEls = ref.current.querySelectorAll<HTMLElement>("[data-word]");

            // Reduced motion: render fully visible, no scroll animation.
            if (reduce) {
                gsap.set(wordEls, { opacity: 1, filter: "none", y: 0 });
                return;
            }

            // GSAP owns the dim "from" state (set before paint, so no flash).
            gsap.set(wordEls, { opacity: 0.14, filter: "blur(6px)", y: "0.16em" });
            gsap.to(wordEls, {
                opacity: 1,
                filter: "blur(0px)",
                y: "0em",
                ease: "none",
                stagger: 0.5,
                scrollTrigger: {
                    trigger: ref.current,
                    start: "top 85%",
                    end: "bottom 60%",
                    scrub: 0.8,
                    invalidateOnRefresh: true,
                },
            });

            // Recalculate once webfonts settle (word boxes shift after Satoshi loads).
            if (document.fonts && document.fonts.ready) {
                document.fonts.ready.then(() => ScrollTrigger.refresh());
            }
        },
        { scope: ref, dependencies: [reduce] },
    );

    return (
        <p ref={ref} className={className} style={style}>
            {words.map((w, i) => {
                const accent = mutedFrom !== undefined && i >= mutedFrom;
                return (
                    <span key={`${w}-${i}`} className="inline-block whitespace-pre">
                        <span
                            data-word
                            className={`inline-block will-change-[opacity,filter,transform] ${
                                accent ? "c5-text-gradient" : "text-white"
                            }`}
                        >
                            {w}
                        </span>
                        {i < words.length - 1 ? " " : ""}
                    </span>
                );
            })}
        </p>
    );
};

export default ScrollWordReveal;

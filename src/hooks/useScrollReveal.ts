import { useEffect } from "react";

/** Elements that fade/slide up the first time they scroll into view.
 *  Landing-page only — dashboards had this too, but replaying the
 *  fade/slide/scale every time a card scrolled in and out of view read as an
 *  unwanted "scroll effect" there, so dashboard selectors were removed. */
const REVEAL_SELECTOR = [
  ".landing-section-heading",
  ".landing-about__gallery",
  ".landing-about__guidelines",
  ".landing-features > *",
  ".landing-values > *",
  ".landing-team > *",
  ".landing-resources > *",
].join(",");

const ENTER_RATIO = 0.12;

/**
 * App-wide scroll-reveal. Watches the DOM (dashboards render lazily) and gives
 * matching elements a GPU-accelerated fade/slide/scale each time they enter the viewport.
 * Styles live in styles/scroll-reveal.css.
 */
export function useScrollReveal() {
  useEffect(() => {
    if (
      typeof IntersectionObserver === "undefined" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    const seen = new WeakSet<Element>();

    // Replays every time an element enters the viewport (scrolling down or up) and
    // resets once it has fully left, so the effect is always noticeable.
    const io = new IntersectionObserver(
      (entries) => {
        let order = 0;
        for (const entry of entries) {
          const el = entry.target as HTMLElement;
          if (entry.isIntersecting && entry.intersectionRatio >= ENTER_RATIO) {
            if (!el.classList.contains("reveal-pending")) continue;
            // Arrive from below when scrolling down, from above when scrolling up.
            const cameFromTop = entry.boundingClientRect.top < window.innerHeight * 0.3;
            el.style.setProperty("--reveal-from", cameFromTop ? "-48px" : "64px");
            el.style.setProperty("--reveal-delay", `${Math.min(order++, 5) * 110}ms`);
            el.classList.remove("reveal-pending", "reveal-in");
            void el.offsetWidth; // restart the animation
            el.classList.add("reveal-in");
            // Release the element afterwards so its own hover transforms work again.
            el.addEventListener("animationend", () => el.classList.remove("reveal-in"), { once: true });
          } else if (!entry.isIntersecting) {
            el.classList.remove("reveal-in");
            el.classList.add("reveal-pending");
          }
        }
      },
      { threshold: [0, ENTER_RATIO], rootMargin: "0px 0px -8% 0px" },
    );

    const register = (root: ParentNode) => {
      root.querySelectorAll<HTMLElement>(REVEAL_SELECTOR).forEach((el) => {
        if (seen.has(el)) return;
        seen.add(el);
        el.classList.add("reveal-pending");
        io.observe(el);
      });
    };

    register(document);
    const mo = new MutationObserver((mutations) => {
      for (const m of mutations) {
        m.addedNodes.forEach((node) => {
          if (node instanceof HTMLElement) {
            if (node.matches(REVEAL_SELECTOR) && !seen.has(node)) register(node.parentNode ?? document);
            register(node);
          }
        });
      }
    });
    mo.observe(document.body, { childList: true, subtree: true });

    return () => {
      mo.disconnect();
      io.disconnect();
    };
  }, []);
}

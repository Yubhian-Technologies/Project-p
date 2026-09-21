import { useEffect } from "react";

/** Horizontal card carousels (mobile) that fade/scale cards as they slide in and out of view. */
const CAROUSEL_SELECTOR = [
  ".counsellor-overview__kpi-grid",
  ".head-analytics__kpi-grid",
  ".aha-kpis",
  ".analytics-inline__stats-grid",
  ".landing-values",
  ".features-grid",
  ".resources-grid",
].join(",");

function updateCarousel(container: HTMLElement) {
  const scrollable = container.scrollWidth > container.clientWidth + 1;
  const box = container.getBoundingClientRect();

  // Edge hints: fade the side that still has cards hidden beyond it.
  const maxScroll = container.scrollWidth - container.clientWidth;
  container.dataset.moreLeft = scrollable && container.scrollLeft > 4 ? "true" : "false";
  container.dataset.moreRight = scrollable && container.scrollLeft < maxScroll - 4 ? "true" : "false";

  Array.from(container.children).forEach((child) => {
    const el = child as HTMLElement;
    if (!scrollable) {
      el.style.removeProperty("--carousel-o");
      el.style.removeProperty("--carousel-s");
      return;
    }
    const r = el.getBoundingClientRect();
    const overlap = Math.min(r.right, box.right) - Math.max(r.left, box.left);
    const visible = Math.max(0, Math.min(1, overlap / Math.max(r.width, 1)));
    el.style.setProperty("--carousel-o", (0.25 + 0.75 * visible).toFixed(3));
    el.style.setProperty("--carousel-s", (0.86 + 0.14 * visible).toFixed(3));
  });
}

/**
 * Drives the fade/scale of carousel cards from their horizontal scroll position.
 * The visuals live in styles/scroll-reveal.css (`.carousel-item` variables).
 */
export function useCarouselFade() {
  useEffect(() => {
    const all = () => document.querySelectorAll<HTMLElement>(CAROUSEL_SELECTOR);

    let frame = 0;
    const scheduleAll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => all().forEach(updateCarousel));
    };

    const onScroll = (e: Event) => {
      const t = e.target;
      if (t instanceof HTMLElement && t.matches(CAROUSEL_SELECTOR)) {
        requestAnimationFrame(() => updateCarousel(t));
      }
    };

    // scroll events don't bubble, so listen in the capture phase.
    document.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", scheduleAll);
    const mo = new MutationObserver(scheduleAll);
    mo.observe(document.body, { childList: true, subtree: true });
    scheduleAll();

    // Static pages (e.g. the landing page) get no DOM mutations after first paint, so also
    // re-measure once fonts/images have settled and whenever a carousel is resized.
    const ro = new ResizeObserver(scheduleAll);
    all().forEach((c) => ro.observe(c));
    window.addEventListener("load", scheduleAll);
    void document.fonts?.ready.then(scheduleAll);
    const timers = [300, 1000, 2500].map((ms) => window.setTimeout(scheduleAll, ms));

    return () => {
      ro.disconnect();
      window.removeEventListener("load", scheduleAll);
      timers.forEach(window.clearTimeout);
      document.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", scheduleAll);
      mo.disconnect();
      cancelAnimationFrame(frame);
    };
  }, []);
}

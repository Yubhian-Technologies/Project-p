import { useEffect, useRef, useState } from "react";

// Drop each photo into /public and set its path here (e.g. "/about-1.jpg")
// — until then, that slide shows a placeholder so the carousel still works.
const SLIDES: { src: string | null; alt: string }[] = [
  { src: "/about-1.jpg", alt: "Vishnu Wellness Centre — campus life photo 1" },
  { src: "/about-2.jpg", alt: "Vishnu Wellness Centre — campus life photo 2" },
  { src: "/about-3.jpg", alt: "Vishnu Wellness Centre — campus life photo 3" },
  { src: null, alt: "Vishnu Wellness Centre — campus life photo 4" },
];

const AUTO_ADVANCE_MS = 5000;

export function AboutPhotoCarousel() {
  const [active, setActive] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setActive((i) => (i + 1) % SLIDES.length);
    }, AUTO_ADVANCE_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  function goTo(index: number) {
    setActive(index);
    // A manual pick restarts the auto-advance clock from here, instead of
    // jumping away again moments later.
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setActive((i) => (i + 1) % SLIDES.length);
    }, AUTO_ADVANCE_MS);
  }

  return (
    <div className="landing-about-media">
      <div className="landing-about-image-wrapper landing-about-carousel">
        {SLIDES.map((slide, i) => (
          <div
            key={i}
            className={`landing-about-carousel__slide${i === active ? " landing-about-carousel__slide--active" : ""}`}
            aria-hidden={i !== active}
          >
            {slide.src ? (
              <img src={slide.src} alt={slide.alt} className="landing-about-image" />
            ) : (
              <div className="landing-about-image-placeholder">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <circle cx="9" cy="9" r="2" />
                  <path d="m21 15-5-5L5 21" />
                </svg>
                <span>Photo coming soon</span>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="landing-about-carousel__dots" role="tablist" aria-label="Photo carousel">
        {SLIDES.map((_, i) => (
          <button
            key={i}
            type="button"
            role="tab"
            aria-selected={i === active}
            aria-label={`Show photo ${i + 1}`}
            className={`landing-about-carousel__dot${i === active ? " landing-about-carousel__dot--active" : ""}`}
            onClick={() => goTo(i)}
          />
        ))}
      </div>
    </div>
  );
}

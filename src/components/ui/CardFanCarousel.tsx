import { useState, useEffect, useRef, useCallback } from "react";
import gsap from "gsap";
import "./CardFanCarousel.css";

export interface CardItem {
  imgUrl: string;
  alt?: string;
  name?: string;
  role?: string;
  institution?: string;
  qualification?: string;
  experience?: string;
  specialties?: string[];
  summary?: string;
  email?: string;
  phone?: string;
  languages?: string;
  linkUrl?: string;
}

interface CardFanCarouselProps {
  cards: CardItem[];
}

const MAX_VISIBLE = 7;
const HALF = 3;

const FAN_POSITIONS = [
  { rot: 0, scale: 0.7756, x: -30, y: 0.0, zIndex: 1 },
  { rot: 0, scale: 0.8498, x: -22, y: 0.0, zIndex: 2 },
  { rot: 0, scale: 0.9346, x: -11, y: 0.0, zIndex: 3 },
  { rot: 0, scale: 1.0,    x:   0, y: 0.0, zIndex: 10 },
  { rot: 0, scale: 0.9346, x:  11, y: 0.0, zIndex: 3 },
  { rot: 0, scale: 0.8498, x:  22, y: 0.0, zIndex: 2 },
  { rot: 0, scale: 0.7756, x:  30, y: 0.0, zIndex: 1 },
];

function getResponsiveMultiplier(width: number) {
  if (width < 480) return 0.28;
  if (width < 640) return 0.38;
  if (width < 768) return 0.5;
  if (width < 1024) return 0.75;
  return 1.0;
}

function getHeightMultiplier(width: number) {
  let idealPx: number;
  if (width < 480) idealPx = 11.5 * 16;
  else if (width < 640) idealPx = 13.5 * 16;
  else if (width < 768) idealPx = 14.5 * 16;
  else if (width < 1024) idealPx = 17.5 * 16;
  else idealPx = 20.5 * 16;

  const available = window.innerHeight * 0.7;
  if (available >= idealPx) return 1;
  return available / idealPx;
}

function getSlotConfig(totalCards: number, slot: number) {
  if (totalCards >= MAX_VISIBLE) return FAN_POSITIONS[slot];
  const center = totalCards >> 1;
  const distance = totalCards > 1 ? (slot - center) / center : 0;
  const absDistance = Math.abs(distance);
  return {
    rot: 0,
    scale: 1.0 - 0.2244 * absDistance * absDistance,
    x: distance * 30,
    y: 0,
    zIndex: 10 - Math.abs(slot - center),
  };
}

export function CardFanCarousel({ cards }: CardFanCarouselProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isAnimating = useRef(false);
  const hasEntered = useRef(false);
  const directionRef = useRef<"left" | "right" | null>(null);
  const prevVisible = useRef<Set<number>>(new Set());
  const prevSlotMap = useRef<Map<number, number>>(new Map());

  const totalCards = cards.length;
  const canCycle = totalCards > 1;
  const [centerIndex, setCenterIndex] = useState(HALF % (totalCards || 1));
  const [hoveredCardIndex, setHoveredCardIndex] = useState<number | null>(null);
  const [isPaused, setIsPaused] = useState(false);

  const getVisibleMap = useCallback(
    (center: number) => {
      const map = new Map<number, number>();
      const slotCount = Math.min(totalCards, MAX_VISIBLE);
      const half = slotCount >> 1;
      for (let slot = 0; slot < slotCount; slot++) {
        map.set(((center + slot - half) % totalCards + totalCards) % totalCards, slot);
      }
      return map;
    },
    [totalCards],
  );

  const cycle = useCallback(
    (direction: "left" | "right") => {
      if (isAnimating.current || !canCycle) return;
      isAnimating.current = true;
      directionRef.current = direction;
      setCenterIndex((prev) =>
        direction === "right" ? (prev + 1) % totalCards : (prev - 1 + totalCards) % totalCards,
      );
    },
    [totalCards, canCycle],
  );

  // Auto-play timer to continuously move the pictures
  useEffect(() => {
    if (!canCycle || isPaused || hoveredCardIndex !== null) return;
    const interval = setInterval(() => {
      cycle("right");
    }, 3200);
    return () => clearInterval(interval);
  }, [canCycle, isPaused, hoveredCardIndex, cycle]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !totalCards) return;

    const cardElements = Array.from(container.querySelectorAll<HTMLElement>(".fan-card"));
    if (!cardElements.length) return;

    const visibleMap = getVisibleMap(centerIndex);
    const previouslyVisible = prevVisible.current;
    const direction = directionRef.current;
    const isFirstMount = !hasEntered.current;
    const multiplier = getResponsiveMultiplier(window.innerWidth);
    const hMult = getHeightMultiplier(window.innerWidth);
    const slotCount = Math.min(totalCards, MAX_VISIBLE);
    const config = (slot: number) => getSlotConfig(slotCount, slot);

    if (isFirstMount) isAnimating.current = true;

    let completedCount = 0;
    const visibleCount = visibleMap.size;
    const onCardDone = () => {
      if (++completedCount >= visibleCount) {
        isAnimating.current = false;
        if (isFirstMount) hasEntered.current = true;
      }
    };

    cardElements.forEach((card, cardIndex) => {
      const slot = visibleMap.get(cardIndex);
      const wasVisible = previouslyVisible.has(cardIndex);
      const prevSlot = prevSlotMap.current.get(cardIndex);

      if (slot !== undefined) {
        const { x, y, rot, scale, zIndex } = config(slot);
        const target = {
          x: `${x * multiplier}rem`,
          y: `${y * hMult}rem`,
          rotation: rot,
          scale,
          opacity: 1,
          zIndex,
        };

        if (isFirstMount) {
          gsap.set(card, { x: 0, y: `${12 * hMult}rem`, rotation: 0, scale: 0.5, opacity: 0 });
          gsap.to(card, { ...target, duration: 1.2, ease: "elastic.out(1.05,.78)", delay: 0.2 + slot * 0.06, onComplete: onCardDone });
        } else if (prevSlot !== undefined && direction === "right" && prevSlot === slotCount - 1 && slot === 0) {
          // Wrap around smoothly right to left
          gsap.to(card, {
            x: `${(config(slotCount - 1).x + 10) * multiplier}rem`,
            opacity: 0,
            scale: 0.5,
            duration: 0.28,
            ease: "power2.in",
            onComplete: () => {
              gsap.set(card, {
                x: `${(config(0).x - 10) * multiplier}rem`,
                rotation: config(0).rot,
                scale: 0.5,
                opacity: 0,
              });
              gsap.to(card, { ...target, duration: 0.45, ease: "power2.out", onComplete: onCardDone });
            },
          });
        } else if (prevSlot !== undefined && direction === "left" && prevSlot === 0 && slot === slotCount - 1) {
          // Wrap around smoothly left to right
          gsap.to(card, {
            x: `${(config(0).x - 10) * multiplier}rem`,
            opacity: 0,
            scale: 0.5,
            duration: 0.28,
            ease: "power2.in",
            onComplete: () => {
              gsap.set(card, {
                x: `${(config(slotCount - 1).x + 10) * multiplier}rem`,
                rotation: config(slotCount - 1).rot,
                scale: 0.5,
                opacity: 0,
              });
              gsap.to(card, { ...target, duration: 0.45, ease: "power2.out", onComplete: onCardDone });
            },
          });
        } else if (!wasVisible) {
          const enterX = direction === "right" ? 40 : -40;
          gsap.set(card, { x: `${enterX}rem`, y: `${y * hMult}rem`, rotation: direction === "right" ? 30 : -30, scale: 0.5, opacity: 0 });
          gsap.to(card, { ...target, duration: 0.6, ease: "power2.out", onComplete: onCardDone });
        } else {
          gsap.to(card, { ...target, duration: 0.65, ease: "power2.out", onComplete: onCardDone });
        }
      } else if (wasVisible) {
        const exitX = direction === "right" ? -40 : 40;
        gsap.to(card, { x: `${exitX}rem`, opacity: 0, scale: 0.5, rotation: direction === "right" ? -30 : 30, duration: 0.4, ease: "power2.in", zIndex: 0 });
      } else if (isFirstMount) {
        gsap.set(card, { opacity: 0, scale: 0.3, x: 0, y: 0, zIndex: 0 });
      }
    });

    prevVisible.current = new Set(visibleMap.keys());
    prevSlotMap.current = new Map(visibleMap);

    // Hover interactions
    const visibleEntries: { el: HTMLElement; slot: number; cardIndex: number }[] = [];
    cardElements.forEach((el, i) => {
      const slot = visibleMap.get(i);
      if (slot !== undefined) visibleEntries.push({ el, slot, cardIndex: i });
    });
    visibleEntries.sort((a, b) => a.slot - b.slot);

    let activeSlot: number | null = null;
    let leaveTimer: ReturnType<typeof setTimeout> | null = null;
    const centerSlot = visibleEntries.length >> 1;

    const updateHoverLayout = (hoveredSlot: number | null) => {
      const mult = getResponsiveMultiplier(window.innerWidth);
      const hM = getHeightMultiplier(window.innerWidth);

      visibleEntries.forEach(({ el, slot }) => {
        const base = config(slot);
        let targetX = base.x * mult;
        let targetY = base.y * hM;
        let targetRot = base.rot;
        let targetScale = base.scale;
        let delay = 0;

        if (hoveredSlot !== null) {
          const distance = Math.abs(slot - hoveredSlot);
          delay = distance * 0.02;

          if (slot === hoveredSlot) {
            targetY -= 2.5 * hM;
            targetScale *= 1.08;
          } else {
            const normalized = centerSlot > 0 ? (slot - centerSlot) / centerSlot : 0;
            const pushStrength = 8 * (1 - Math.abs(normalized)) * (1 + 0.2 * Math.max(0, 3 - distance));

            if (slot < hoveredSlot) {
              targetX -= pushStrength * mult;
            } else {
              targetX += pushStrength * mult;
            }

            if (slot === visibleEntries.length - 1 && hoveredSlot < centerSlot) targetY -= 1 * hM;
            if (slot === 0 && hoveredSlot > centerSlot) targetY -= 1 * hM;
          }
        } else {
          delay = Math.abs(slot - centerSlot) * 0.02;
        }

        gsap.to(el, {
          x: `${targetX}rem`,
          y: `${targetY}rem`,
          rotation: targetRot,
          scale: targetScale,
          duration: 0.5,
          delay,
          ease: "elastic.out(1,.75)",
          overwrite: "auto",
        });
        gsap.set(el, { zIndex: base.zIndex });
      });
    };

    const enterHandlers = visibleEntries.map(({ el, slot, cardIndex }) => {
      const handler = () => {
        if (isAnimating.current) return;
        if (leaveTimer) { clearTimeout(leaveTimer); leaveTimer = null; }
        setHoveredCardIndex(cardIndex);
        if (activeSlot !== slot) { activeSlot = slot; updateHoverLayout(slot); }
      };
      el.addEventListener("mouseenter", handler);
      return { el, handler };
    });

    const onMouseLeave = () => {
      if (isAnimating.current) return;
      if (leaveTimer) clearTimeout(leaveTimer);
      leaveTimer = setTimeout(() => {
        activeSlot = null;
        updateHoverLayout(null);
        setHoveredCardIndex(null);
      }, 60);
    };
    container.addEventListener("mouseleave", onMouseLeave);

    const onResize = () => { if (!isAnimating.current) updateHoverLayout(activeSlot); };
    window.addEventListener("resize", onResize);

    return () => {
      enterHandlers.forEach(({ el, handler }) => el.removeEventListener("mouseenter", handler));
      container.removeEventListener("mouseleave", onMouseLeave);
      window.removeEventListener("resize", onResize);
      if (leaveTimer) clearTimeout(leaveTimer);
    };
  }, [centerIndex, totalCards, getVisibleMap, canCycle]);

  if (!totalCards) return null;

  const chevron = (direction: "left" | "right") => (
    <svg className="fan-arrow-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points={direction === "left" ? "15 18 9 12 15 6" : "9 18 15 12 9 6"} />
    </svg>
  );

  const displayIndex = hoveredCardIndex !== null ? hoveredCardIndex : (centerIndex % totalCards);
  const activeCard = cards[displayIndex] || cards[0];

  return (
    <div
      className="fan-carousel-root"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className="fan-carousel-stage">
        <div ref={containerRef} className="fan-layout">
          {cards.map((card, index) => {
            const image = (
              <div className="fan-card-inner">
                <img
                  src={card.imgUrl}
                  loading="lazy"
                  alt={card.name || card.alt || `Team member ${index + 1}`}
                />
              </div>
            );
            return card.linkUrl ? (
              <a
                key={index}
                href={card.linkUrl}
                target={card.linkUrl.startsWith("http") ? "_blank" : "_self"}
                rel="noopener noreferrer"
                className={`fan-card ${hoveredCardIndex === index ? "fan-card--active" : ""}`}
                onMouseEnter={() => setHoveredCardIndex(index)}
                onClick={() => setHoveredCardIndex(index)}
              >
                {image}
              </a>
            ) : (
              <div
                key={index}
                className={`fan-card ${hoveredCardIndex === index ? "fan-card--active" : ""}`}
                onMouseEnter={() => setHoveredCardIndex(index)}
                onClick={() => setHoveredCardIndex(index)}
              >
                {image}
              </div>
            );
          })}
        </div>
      </div>

      {canCycle && (
        <div className="fan-pagination">
          <button className="fan-arrow-btn" onClick={() => cycle("left")} aria-label="Previous">
            {chevron("left")}
          </button>
          <div className="fan-dots">
            {cards.map((_, i) => (
              <span
                key={i}
                className={`fan-dot ${i === centerIndex ? "fan-dot--active" : ""}`}
                onClick={() => {
                  setCenterIndex(i);
                }}
                style={{ cursor: "pointer" }}
              />
            ))}
          </div>
          <button className="fan-arrow-btn" onClick={() => cycle("right")} aria-label="Next">
            {chevron("right")}
          </button>
        </div>
      )}

      {/* Details Box below the pagination */}
      {activeCard && (
        <div className="fan-card-details">
          <h3 className="fan-card-details__name">
            {activeCard.name || activeCard.alt || "Counsellor"}
          </h3>

          <div className="fan-card-details__meta-header">
            {activeCard.role && (
              <span className="fan-card-details__role">{activeCard.role}</span>
            )}
            {activeCard.institution && (
              <span className="fan-card-details__institution">
                <svg className="fan-meta-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                {activeCard.institution}
              </span>
            )}
          </div>

          {(activeCard.qualification || activeCard.experience) && (
            <p className="fan-card-details__qual">
              {activeCard.qualification && (
                <span className="fan-card-details__qual-item">
                  <svg className="fan-meta-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                    <path d="M6 12v5c3 3 9 3 12 0v-5" />
                  </svg>
                  {activeCard.qualification}
                </span>
              )}
              {activeCard.qualification && activeCard.experience ? " • " : ""}
              {activeCard.experience && (
                <span className="fan-card-details__qual-item">
                  <svg className="fan-meta-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                  {activeCard.experience}
                </span>
              )}
            </p>
          )}

          {activeCard.summary && (
            <blockquote className="fan-card-details__summary">
              "{activeCard.summary}"
            </blockquote>
          )}

          {activeCard.specialties && activeCard.specialties.length > 0 && (
            <div className="fan-card-details__specialties">
              {activeCard.specialties.map((spec, sIdx) => (
                <span key={sIdx} className="fan-card-details__tag">
                  {spec}
                </span>
              ))}
            </div>
          )}

          {(activeCard.languages || activeCard.phone || activeCard.email) && (
            <div className="fan-card-details__contact-row">
              {activeCard.languages && (
                <span className="fan-card-details__contact-item">
                  <svg className="fan-meta-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="2" y1="12" x2="22" y2="12" />
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                  </svg>
                  <strong>Languages:</strong> {activeCard.languages}
                </span>
              )}
              {activeCard.phone && (
                <span className="fan-card-details__contact-item">
                  <svg className="fan-meta-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                  </svg>
                  {activeCard.phone}
                </span>
              )}
              {activeCard.email && (
                <a
                  href={`mailto:${activeCard.email}`}
                  className="fan-card-details__contact-item fan-card-details__contact-link"
                >
                  <svg className="fan-meta-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                    <polyline points="22,6 12,13 2,6" />
                  </svg>
                  {activeCard.email}
                </a>
              )}
            </div>
          )}

          <p className="fan-card-details__hint">
            Hover or tap any photo to view their profile, campus institution, and credentials
          </p>
        </div>
      )}
    </div>
  );
}


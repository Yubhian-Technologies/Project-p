import React, { useState, useEffect, useCallback, useRef } from "react";
import "./PerspectiveDeckCarousel.css";

export interface DeckCardItem {
  id: string | number;
  title?: string;
  subtitle?: string;
  imageUrl?: string;
  description?: string;
  icon?: React.ReactNode;
  accentColor?: string;
  bgGradient?: string;
  borderColor?: string;
}

interface PerspectiveDeckCarouselProps {
  items: DeckCardItem[];
  autoPlay?: boolean;
  autoPlayInterval?: number;
}

export const PerspectiveDeckCarousel: React.FC<PerspectiveDeckCarouselProps> = ({
  items,
  autoPlay = false,
  autoPlayInterval = 5000,
}) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number | null>(null);

  const total = items.length;

  const handleNext = useCallback(() => {
    setActiveIndex((prev) => (prev + 1) % total);
  }, [total]);

  const handlePrev = useCallback(() => {
    setActiveIndex((prev) => (prev - 1 + total) % total);
  }, [total]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const isVisible = rect.top < window.innerHeight && rect.bottom > 0;
      if (!isVisible) return;

      if (e.key === "ArrowRight") {
        handleNext();
      } else if (e.key === "ArrowLeft") {
        handlePrev();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleNext, handlePrev]);

  // Auto-play support (if enabled)
  useEffect(() => {
    if (!autoPlay || isPaused || total <= 1) return;
    const timer = setInterval(handleNext, autoPlayInterval);
    return () => clearInterval(timer);
  }, [autoPlay, isPaused, autoPlayInterval, handleNext, total]);

  // Touch swipe support for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const deltaX = touchStartX.current - touchEndX;

    if (Math.abs(deltaX) > 40) {
      if (deltaX > 0) {
        handleNext();
      } else {
        handlePrev();
      }
    }
    touchStartX.current = null;
  };

  /**
   * Determine the visual slot for each item relative to activeIndex.
   * Slot 0: Front & center-left (prominent, face-forward, unrotated)
   * Slot 1: Mid-right trailing, rotated Y in 3D
   * Slot 2: Further right trailing, smaller, more rotation
   * Slot 3: Edge trailing card, very slim perspective
   * Slot -1 / exit: Just left of front card, fading out smoothly
   */
  const getSlotIndex = (index: number) => {
    const diff = (index - activeIndex + total) % total;
    if (diff === total - 1 && total > 2) {
      // The card that just left the front
      return -1;
    }
    return diff;
  };

  return (
    <div
      className="perspective-deck"
      ref={containerRef}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      aria-label="3D Perspective Gallery"
    >
      {/* 3D Scene Viewport */}
      <div className="perspective-deck__stage">
        {items.map((item, index) => {
          const slot = getSlotIndex(index);
          const isActive = slot === 0;

          // Determine class based on slot
          let slotClass = "perspective-deck__card--hidden";
          if (slot === 0) slotClass = "perspective-deck__card--slot-0";
          else if (slot === 1) slotClass = "perspective-deck__card--slot-1";
          else if (slot === 2) slotClass = "perspective-deck__card--slot-2";
          else if (slot === 3) slotClass = "perspective-deck__card--slot-3";
          else if (slot === -1) slotClass = "perspective-deck__card--slot-prev";

          const isTextCard = Boolean(item.description || !item.imageUrl);

          // Inline dynamic styles
          const customStyle: React.CSSProperties = {
            "--card-accent": item.accentColor || "#0D9488",
            "--card-border": item.borderColor || "#86EFAC",
            "--card-bg": item.bgGradient || "linear-gradient(145deg, #FFFFFF 0%, #F8FAFC 100%)",
          } as React.CSSProperties;

          return (
            <div
              key={item.id}
              className={`perspective-deck__card ${slotClass} ${isTextCard ? "perspective-deck__card--text" : ""}`}
              onClick={() => {
                if (slot > 0) {
                  setActiveIndex(index);
                }
              }}
              role="button"
              tabIndex={isActive ? 0 : -1}
              aria-label={item.title || `Card ${index + 1}`}
              aria-current={isActive ? "true" : undefined}
              style={customStyle}
            >
              {isTextCard ? (
                <div
                  className="perspective-deck__text-card-inner"
                  style={{ background: item.bgGradient || "linear-gradient(145deg, #FFFFFF 0%, #F8FAFC 100%)" }}
                >
                  <div className="perspective-deck__text-card-header">
                    {item.icon && <div className="perspective-deck__text-card-icon">{item.icon}</div>}
                    {item.subtitle && (
                      <span className="perspective-deck__text-card-subtitle">{item.subtitle}</span>
                    )}
                  </div>
                  {item.title && <h3 className="perspective-deck__text-card-title">{item.title}</h3>}
                  {item.description && <p className="perspective-deck__text-card-desc">{item.description}</p>}
                  <div className="perspective-deck__text-card-accent-line" />
                </div>
              ) : (
                <div className="perspective-deck__image-wrapper">
                  <img
                    src={item.imageUrl}
                    alt={item.title || "Vishnu Wellness"}
                    className="perspective-deck__image"
                    loading={index < 2 ? "eager" : "lazy"}
                    draggable={false}
                  />
                  <div className="perspective-deck__card-overlay" />

                  {/* Card Title & Subtitle Badge */}
                  {(item.title || item.subtitle) && (
                    <div className="perspective-deck__card-badge">
                      {item.subtitle && (
                        <span className="perspective-deck__badge-subtitle">
                          {item.subtitle}
                        </span>
                      )}
                      {item.title && (
                        <h4 className="perspective-deck__badge-title">
                          {item.title}
                        </h4>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Navigation Controls: [ Prev ] [ Next ] */}
      <div className="perspective-deck__controls">
        <button
          type="button"
          onClick={handlePrev}
          className="perspective-deck__btn"
          aria-label="Previous photo"
        >
          Prev
        </button>
        <button
          type="button"
          onClick={handleNext}
          className="perspective-deck__btn"
          aria-label="Next photo"
        >
          Next
        </button>
      </div>
    </div>
  );
};

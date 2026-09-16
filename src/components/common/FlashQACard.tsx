import { useEffect, useState } from "react";
import { BentoCard } from "./BentoCard";
import { useAuth } from "../../hooks/useAuth";
import { getFlashQAList, DEFAULT_FLASH_QA } from "../../services/firebase/flashQa";
import type { FlashQAItem } from "../../types/flashQa";
import "./FlashQACard.css";

function FlashIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none">
      <path
        d="M12 2C8.13 2 5 5.13 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.87-3.13-7-7-7ZM9 21c0 .55.45 1 1 1h4c.55 0 1-.45 1-1v-1H9v1Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function FlashQACard() {
  const { profile } = useAuth();
  const [items, setItems] = useState<FlashQAItem[]>(DEFAULT_FLASH_QA);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  useEffect(() => {
    let isMounted = true;
    getFlashQAList(profile?.campusId)
      .then((loaded) => {
        if (isMounted && loaded && loaded.length > 0) {
          setItems(loaded);
        }
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, [profile?.campusId]);

  const currentItem = items[currentIndex] || DEFAULT_FLASH_QA[0];
  const totalCount = items.length;

  function handleFlip() {
    setIsFlipped((prev) => !prev);
  }

  function handleNext(e?: React.MouseEvent) {
    if (e) e.stopPropagation();
    setIsFlipped(false);
    setCurrentIndex((prev) => (prev + 1) % totalCount);
  }

  function handleSelectIndex(idx: number, e: React.MouseEvent) {
    e.stopPropagation();
    setIsFlipped(false);
    setCurrentIndex(idx);
  }

  return (
    <BentoCard
      className="flash-qa-bento"
      span={4}
      icon={<FlashIcon />}
      title="Flash Q/A"
      subtitle="Tap card to flip between question & answer."
      badge={{ text: `Q${currentIndex + 1}`, variant: "primary" }}
    >
      <div className="flash-qa__wrapper">
        <div
          className="flash-qa__flip-scene"
          onClick={handleFlip}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              handleFlip();
            }
          }}
          role="button"
          tabIndex={0}
          aria-label={
            isFlipped
              ? `Answer for question ${currentIndex + 1}. Click to flip back to question.`
              : `Question ${currentIndex + 1}: ${currentItem.question}. Click to reveal answer.`
          }
        >
          <div className={`flash-qa__flip-card${isFlipped ? " is-flipped" : ""}`}>
            {/* Front: Question */}
            <div className="flash-qa__face flash-qa__face--front">
              <span className="flash-qa__tag flash-qa__tag--front">
                {currentItem.category || "Question"}
              </span>
              <div className="flash-qa__text-area">
                <p className="flash-qa__question">{currentItem.question}</p>
              </div>
              <span className="flash-qa__hint">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
                </svg>
                Tap to reveal answer
              </span>
            </div>

            {/* Back: Answer */}
            <div className="flash-qa__face flash-qa__face--back">
              <span className="flash-qa__tag flash-qa__tag--back">
                ✓ Answer
              </span>
              <div className="flash-qa__text-area">
                <p className="flash-qa__answer">{currentItem.answer}</p>
              </div>
              <span className="flash-qa__hint">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
                </svg>
                Tap to flip back
              </span>
            </div>
          </div>
        </div>

        {/* Footer Navigation */}
        <div className="flash-qa__footer">
          <div className="flash-qa__dots">
            {items.map((it, idx) => (
              <button
                key={it.id || idx}
                type="button"
                className={`flash-qa__dot${idx === currentIndex ? " flash-qa__dot--active" : ""}`}
                aria-label={`Go to flashcard ${idx + 1}`}
                onClick={(e) => handleSelectIndex(idx, e)}
              />
            ))}
          </div>

          <button
            type="button"
            className="flash-qa__next-btn"
            onClick={handleNext}
            aria-label="Next flashcard"
          >
            Next →
          </button>
        </div>
      </div>
    </BentoCard>
  );
}

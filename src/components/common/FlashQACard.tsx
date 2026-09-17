import { useEffect, useState } from "react";
import { BentoCard } from "./BentoCard";
import { ZapIcon, RefreshIcon, CheckIcon } from "./icons";
import { useAuth } from "../../hooks/useAuth";
import { getFlashQAList, DEFAULT_FLASH_QA } from "../../services/firebase/flashQa";
import type { FlashQAItem } from "../../types/flashQa";
import "./FlashQACard.css";

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
      icon={<ZapIcon />}
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
                <RefreshIcon width={12} height={12} strokeWidth={2.5} />
                Tap to reveal answer
              </span>
            </div>

            {/* Back: Answer */}
            <div className="flash-qa__face flash-qa__face--back">
              <span className="flash-qa__tag flash-qa__tag--back">
                <CheckIcon width={12} height={12} strokeWidth={2.5} />
                Answer
              </span>
              <div className="flash-qa__text-area">
                <p className="flash-qa__answer">{currentItem.answer}</p>
              </div>
              <span className="flash-qa__hint">
                <RefreshIcon width={12} height={12} strokeWidth={2.5} />
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

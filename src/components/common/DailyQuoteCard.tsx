import { useMemo } from "react";
import { BentoCard } from "./BentoCard";
import { getDailyQuote } from "../../utils/dailyQuote";
import "./DailyQuoteCard.css";

function QuoteIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none">
      <path
        d="M9.5 6C6.5 6 4 8.5 4 11.5v6h6.5v-6H7.2C7.2 9.5 8.7 8 10.5 8V6H9.5Zm9 0c-3 0-5.5 2.5-5.5 5.5v6H19.5v-6h-3.3c0-2 1.5-3.5 3.3-3.5V6h-1Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function DailyQuoteCard() {
  const quote = useMemo(() => getDailyQuote(), []);

  return (
    <BentoCard
      className="daily-quote-bento"
      span={4}
      icon={<QuoteIcon />}
      title="Daily Inspiration"
      subtitle="A new thought to carry with you today."
    >
      <div className="daily-quote__wrapper">
        <div className="daily-quote__card">
          <p className="daily-quote__text">“{quote.text}”</p>
          <p className="daily-quote__author">— {quote.author}</p>
        </div>
      </div>
    </BentoCard>
  );
}

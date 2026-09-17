import { useMemo } from "react";
import { BentoCard } from "./BentoCard";
import { QuoteIcon } from "./icons";
import { getDailyQuote } from "../../utils/dailyQuote";
import "./DailyQuoteCard.css";

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

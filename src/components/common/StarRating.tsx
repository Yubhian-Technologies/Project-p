import { useState } from "react";
import "./StarRating.css";

interface StarRatingProps {
  value: number;
  count?: number;
  onChange?: (value: number) => void;
  size?: "small" | "large";
}

export function StarRating({ value, count, onChange, size = "small" }: StarRatingProps) {
  const [hovered, setHovered] = useState<number | null>(null);
  const interactive = !!onChange;
  const displayValue = hovered ?? value;

  return (
    <span className={`star-rating star-rating--${size}`}>
      <span className="star-rating__stars" onMouseLeave={() => setHovered(null)}>
        {[1, 2, 3, 4, 5].map((star) => (
          <span
            key={star}
            className={`star-rating__star ${star <= Math.round(displayValue) ? "star-rating__star--filled" : ""} ${interactive ? "star-rating__star--interactive" : ""}`}
            onClick={interactive ? () => onChange?.(star) : undefined}
            onMouseEnter={interactive ? () => setHovered(star) : undefined}
          >
            ★
          </span>
        ))}
      </span>
      {!interactive && value > 0 && (
        <span className="star-rating__label">
          {value.toFixed(1)}/5{count !== undefined ? ` · ${count} review${count === 1 ? "" : "s"}` : ""}
        </span>
      )}
    </span>
  );
}

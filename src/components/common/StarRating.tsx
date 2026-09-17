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

  const starDimension = size === "large" ? 22 : 16;

  return (
    <span className={`star-rating star-rating--${size}`}>
      <span className="star-rating__stars" onMouseLeave={() => setHovered(null)}>
        {[1, 2, 3, 4, 5].map((star) => {
          const isFilled = star <= Math.round(displayValue);
          return (
            <button
              key={star}
              type="button"
              disabled={!interactive}
              tabIndex={interactive ? 0 : -1}
              aria-label={interactive ? `Rate ${star} star${star > 1 ? "s" : ""}` : undefined}
              className={`star-rating__star ${isFilled ? "star-rating__star--filled" : ""} ${
                interactive ? "star-rating__star--interactive" : ""
              }`}
              onClick={interactive ? () => onChange?.(star) : undefined}
              onMouseEnter={interactive ? () => setHovered(star) : undefined}
            >
              <svg
                width={starDimension}
                height={starDimension}
                viewBox="0 0 24 24"
                fill={isFilled ? "#F59E0B" : "none"}
                stroke={isFilled ? "#B45309" : "#94A3B8"}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
            </button>
          );
        })}
      </span>
      {!interactive && value > 0 && (
        <span className="star-rating__label">
          {value.toFixed(1)}/5{count !== undefined ? ` · ${count} review${count === 1 ? "" : "s"}` : ""}
        </span>
      )}
    </span>
  );
}


import React from "react";
import "./HoverRevealCards.css";

/**
 * @typedef CardItem
 * @property {string | number} id - Unique identifier for the card.
 * @property {string} title - The main title text of the card.
 * @property {string} subtitle - The subtitle or category text.
 * @property {string} imageUrl - The URL for the card's background image.
 */
export interface CardItem {
  id: string | number;
  title: string;
  subtitle: string;
  imageUrl: string;
}

/**
 * @typedef HoverRevealCardsProps
 * @property {CardItem[]} items - An array of card item objects to display.
 * @property {string} [className] - Optional additional class names for the container.
 * @property {string} [cardClassName] - Optional additional class names for individual cards.
 */
export interface HoverRevealCardsProps {
  items: CardItem[];
  className?: string;
  cardClassName?: string;
}

/**
 * A component that displays a grid of cards with a hover-reveal effect.
 * When a card is hovered or focused, it stands out while others are de-emphasized.
 */
export const HoverRevealCards: React.FC<HoverRevealCardsProps> = ({
  items,
  className = "",
  cardClassName = "",
}) => {
  return (
    <div
      role="list"
      className={`hover-reveal-grid ${className}`.trim()}
    >
      {items.map((item) => (
        <div
          key={item.id}
          role="listitem"
          aria-label={`${item.title}, ${item.subtitle}`}
          tabIndex={0}
          className={`hover-reveal-card ${cardClassName}`.trim()}
          style={{ backgroundImage: `url(${item.imageUrl})` }}
        >
          {/* Gradient overlay for text contrast */}
          <div className="hover-reveal-card__overlay" />

          {/* Card Content */}
          <div className="hover-reveal-card__content">
            <p className="hover-reveal-card__subtitle">
              {item.subtitle}
            </p>
            <h3 className="hover-reveal-card__title">{item.title}</h3>
          </div>
        </div>
      ))}
    </div>
  );
};

export default HoverRevealCards;

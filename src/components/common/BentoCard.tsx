import type { ReactNode } from "react";
import "../../styles/bento-grid.css";

export interface BentoCardProps {
  title?: string;
  subtitle?: string;
  icon?: ReactNode;
  badge?: {
    text: string;
    variant?: "primary" | "success" | "warning" | "neutral";
  };
  span?: 3 | 4 | 6 | 8 | 12;
  variant?: "default" | "hero";
  action?: {
    label: string;
    onClick?: () => void;
    variant?: "primary" | "secondary";
  };
  className?: string;
  children?: ReactNode;
}

export function BentoCard({
  title,
  subtitle,
  icon,
  badge,
  span = 4,
  variant = "default",
  action,
  className = "",
  children,
}: BentoCardProps) {
  const spanClass = `bento-card--col-${span}`;
  const variantClass = variant === "hero" ? "bento-card--hero" : "";
  const badgeVariant = badge?.variant ? `bento-badge--${badge.variant}` : "bento-badge--primary";
  const btnVariant = action?.variant ? `bento-btn--${action.variant}` : "bento-btn--primary";

  return (
    <div className={`bento-card ${spanClass} ${variantClass} ${className}`}>
      <div>
        {(title || icon || badge) && (
          <div className="bento-card__header">
            <div className="bento-card__title-group">
              {icon && <div className="bento-card__icon">{icon}</div>}
              <div>
                {title && <h3 className="bento-card__title">{title}</h3>}
                {subtitle && <p className="bento-card__subtitle">{subtitle}</p>}
              </div>
            </div>
            {badge && <span className={`bento-badge ${badgeVariant}`}>{badge.text}</span>}
          </div>
        )}
        {children}
      </div>

      {action && (
        <div className="bento-card__action" style={{ marginTop: "16px" }}>
          <button type="button" className={`bento-btn ${btnVariant}`} onClick={action.onClick}>
            {action.label}
          </button>
        </div>
      )}
    </div>
  );
}

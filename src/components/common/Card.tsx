import type { HTMLAttributes } from "react";
import "./Card.css";

export function Card({ children, className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={["md-card", className].filter(Boolean).join(" ")} {...rest}>
      {children}
    </div>
  );
}

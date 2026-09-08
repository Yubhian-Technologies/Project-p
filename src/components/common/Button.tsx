import type { ButtonHTMLAttributes } from "react";
import "./Button.css";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "filled" | "outlined";
}

export function Button({ variant = "filled", className, ...rest }: ButtonProps) {
  const classes = ["md-button", `md-button--${variant}`, className].filter(Boolean).join(" ");
  return <button className={classes} {...rest} />;
}

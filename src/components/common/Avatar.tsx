import "./Avatar.css";

interface AvatarProps {
  photoURL?: string;
  label: string;
  size?: "small" | "large" | "xl";
  shape?: "circle" | "square";
}

export function Avatar({ photoURL, label, size = "small", shape = "circle" }: AvatarProps) {
  const initial = label.trim().charAt(0).toUpperCase() || "?";
  const classes = `avatar avatar--${size} avatar--${shape}`;

  if (photoURL) {
    return <img className={classes} src={photoURL} alt={label} />;
  }

  return (
    <span className={classes} aria-label={label}>
      {initial}
    </span>
  );
}

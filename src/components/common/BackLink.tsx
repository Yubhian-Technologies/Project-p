import "./BackLink.css";

interface BackLinkProps {
  label: string;
  onClick: () => void;
}

export function BackLink({ label, onClick }: BackLinkProps) {
  return (
    <button type="button" className="back-link" onClick={onClick}>
      <span className="back-link__arrow" aria-hidden="true">
        ←
      </span>
      {label}
    </button>
  );
}

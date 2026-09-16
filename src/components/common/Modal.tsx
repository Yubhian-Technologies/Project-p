import type { ReactNode } from "react";
import "./Modal.css";

interface ModalProps {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}

export function Modal({ title, onClose, children, className }: ModalProps) {
  return (
    <div className="modal__scrim" onClick={onClose}>
      <div className={["modal__panel", className].filter(Boolean).join(" ")} onClick={(e) => e.stopPropagation()}>
        <div className="modal__header">
          <div className="modal__title">{title}</div>
          <button type="button" className="modal__close" aria-label="Close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="modal__body">{children}</div>
      </div>
    </div>
  );
}

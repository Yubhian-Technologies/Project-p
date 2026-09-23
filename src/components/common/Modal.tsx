import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import "./Modal.css";

interface ModalProps {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}

export function Modal({ title, onClose, children, className }: ModalProps) {
  // Rendered via a portal straight onto <body> so it always sits above the
  // rest of the app, including the sticky header — an ancestor of the modal
  // in the normal tree (.app-shell__body) sets its own z-index, which would
  // otherwise cap every modal underneath it no matter what z-index it has.
  return createPortal(
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
    </div>,
    document.body,
  );
}

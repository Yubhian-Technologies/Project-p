import { AnimatePresence, motion } from "framer-motion";
import type { ToastItem, ToastVariant } from "../../context/ToastContext";
import { CheckIcon, CalendarIcon, BellIcon, AlertTriangleIcon, XIcon } from "./icons";
import "./ToastStack.css";

interface ToastStackProps {
  toasts: ToastItem[];
  onDismiss: (id: number) => void;
}

const VARIANT_ICON: Record<ToastVariant, typeof CheckIcon> = {
  success: CheckIcon,
  event: CalendarIcon,
  info: BellIcon,
  error: AlertTriangleIcon,
};

export function ToastStack({ toasts, onDismiss }: ToastStackProps) {
  return (
    <div className="toast-stack" aria-live="polite">
      <AnimatePresence>
        {toasts.map((toast) => {
          const Icon = VARIANT_ICON[toast.variant];
          return (
            <motion.div
              key={toast.id}
              layout
              className={`toast-card toast-card--${toast.variant}`}
              initial={{ opacity: 0, y: -24, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -16, scale: 0.95 }}
              transition={{ type: "spring", duration: 0.45, bounce: 0.25 }}
            >
              <div className="toast-card__icon">
                <Icon />
              </div>
              <div className="toast-card__body">
                <p className="toast-card__title">{toast.title}</p>
                <p className="toast-card__message">{toast.message}</p>
              </div>
              <button
                type="button"
                className="toast-card__close"
                aria-label="Dismiss"
                onClick={() => onDismiss(toast.id)}
              >
                <XIcon />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

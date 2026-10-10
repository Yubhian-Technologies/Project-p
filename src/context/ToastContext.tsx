import { createContext, useCallback, useContext, useRef, useState } from "react";
import type { ReactNode } from "react";
import { ToastStack } from "../components/common/ToastStack";

export type ToastVariant = "success" | "info" | "event" | "error";

export interface ToastItem {
  id: number;
  title: string;
  message: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  showToast: (toast: { title: string; message: string; variant?: ToastVariant }) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const TOAST_DURATION_MS = 5000;
const MAX_VISIBLE_TOASTS = 4;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    ({ title, message, variant = "info" }: { title: string; message: string; variant?: ToastVariant }) => {
      const id = ++nextId.current;
      setToasts((prev) => [...prev, { id, title, message, variant }].slice(-MAX_VISIBLE_TOASTS));
      setTimeout(() => dismissToast(id), TOAST_DURATION_MS);
    },
    [dismissToast],
  );

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <ToastStack toasts={toasts} onDismiss={dismissToast} />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return ctx;
}

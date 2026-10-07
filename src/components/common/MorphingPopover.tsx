import { createContext, useContext, useId, useRef, useState, useEffect, useMemo, useCallback } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, MotionConfig } from "framer-motion";
import type { Transition } from "framer-motion";
import { useClickOutside } from "../../hooks/useClickOutside";
import "./MorphingPopover.css";

const TRANSITION: Transition = { type: "spring", bounce: 0.1, duration: 0.4 };

interface MorphingPopoverContextValue {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  uniqueId: string;
}

const MorphingPopoverContext = createContext<MorphingPopoverContextValue | null>(null);

function useMorphingPopoverContext(componentName: string): MorphingPopoverContextValue {
  const ctx = useContext(MorphingPopoverContext);
  if (!ctx) throw new Error(`${componentName} must be used within <MorphingPopover>`);
  return ctx;
}

interface MorphingPopoverProps {
  children: ReactNode;
}

/** A trigger that smoothly expands — morphs — into its popover content in place,
    rather than a modal fading in separately from wherever it was clicked.
    Built on framer-motion's shared layoutId animation (already a dependency via
    animated-hero.tsx), no Tailwind/shadcn/Radix involved. */
export function MorphingPopover({ children }: MorphingPopoverProps) {
  const uniqueId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const value = useMemo(() => ({ isOpen, open, close, uniqueId }), [isOpen, open, close, uniqueId]);

  return (
    <MorphingPopoverContext.Provider value={value}>
      <MotionConfig transition={TRANSITION}>{children}</MotionConfig>
    </MorphingPopoverContext.Provider>
  );
}

interface MorphingPopoverTriggerProps {
  children: ReactNode;
  className?: string;
}

export function MorphingPopoverTrigger({ children, className }: MorphingPopoverTriggerProps) {
  const ctx = useMorphingPopoverContext("MorphingPopoverTrigger");

  return (
    <motion.button
      type="button"
      layoutId={`morphing-popover-box-${ctx.uniqueId}`}
      onClick={ctx.open}
      className={className}
      aria-haspopup="dialog"
      aria-expanded={ctx.isOpen}
    >
      <motion.span layoutId={`morphing-popover-label-${ctx.uniqueId}`} layout="position">
        {children}
      </motion.span>
    </motion.button>
  );
}

interface MorphingPopoverContentProps {
  title: string;
  children: ReactNode;
  className?: string;
}

export function MorphingPopoverContent({ title, children, className }: MorphingPopoverContentProps) {
  const ctx = useMorphingPopoverContext("MorphingPopoverContent");
  const { isOpen, close } = ctx;
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, close);

  useEffect(() => {
    if (!isOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, close]);

  return createPortal(
    <AnimatePresence>
      {ctx.isOpen && (
        <motion.div
          className="morphing-popover__scrim"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={ctx.close}
        >
          <motion.div
            ref={ref}
            layoutId={`morphing-popover-box-${ctx.uniqueId}`}
            role="dialog"
            aria-modal="true"
            className={["morphing-popover__content", className].filter(Boolean).join(" ")}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="morphing-popover__header">
              <motion.h4
                layoutId={`morphing-popover-label-${ctx.uniqueId}`}
                layout="position"
                className="morphing-popover__title"
              >
                {title}
              </motion.h4>
              <button type="button" className="morphing-popover__close" aria-label="Close" onClick={ctx.close}>
                ✕
              </button>
            </div>
            <div className="morphing-popover__body">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

import { useEffect } from "react";
import type { RefObject } from "react";

type Handler = (event: MouseEvent | TouchEvent) => void;

/** Calls `handler` on a mousedown/touchstart that lands outside `ref`'s element. */
export function useClickOutside<T extends HTMLElement>(ref: RefObject<T | null>, handler: Handler): void {
  useEffect(() => {
    function listener(event: MouseEvent | TouchEvent) {
      const el = ref.current;
      const target = event.target as Node | null;
      if (!el || !target || el.contains(target)) return;
      handler(event);
    }
    document.addEventListener("mousedown", listener);
    document.addEventListener("touchstart", listener);
    return () => {
      document.removeEventListener("mousedown", listener);
      document.removeEventListener("touchstart", listener);
    };
  }, [ref, handler]);
}

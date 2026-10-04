import { Children, isValidElement, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import "./Select.css";

interface OptionElementProps {
  value: string;
  disabled?: boolean;
  children?: ReactNode;
}

interface ParsedOption {
  value: string;
  label: ReactNode;
  disabled: boolean;
}

interface SelectProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  children: ReactNode;
}

function parseOptions(children: ReactNode): ParsedOption[] {
  const options: ParsedOption[] = [];
  Children.forEach(children, (child) => {
    if (!isValidElement<OptionElementProps>(child)) return;
    options.push({
      value: child.props.value,
      label: child.props.children,
      disabled: !!child.props.disabled,
    });
  });
  return options;
}

export function Select({ id, value, onChange, disabled, children }: SelectProps) {
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const options = useMemo(() => parseOptions(children), [children]);
  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Recompute position on scroll/resize (not just at open), and update on
  // window visual viewport changes; also only close when the *window*
  // (page) scrolls/resizes — not when scrolling inside the dropdown.
  useLayoutEffect(() => {
    if (!open || !containerRef.current) return;
    function updatePosition() {
      const rect = containerRef.current!.getBoundingClientRect();
      const menuHeight = 220;
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const openUp = spaceBelow < menuHeight && spaceAbove > spaceBelow;
      const maxHeight = openUp ? Math.max(180, spaceAbove - 16) : Math.max(180, spaceBelow - 16);
      setMenuStyle({
        position: "fixed",
        ...(openUp
          ? { bottom: Math.max(8, window.innerHeight - rect.top + 8), top: "auto" }
          : { top: Math.min(window.innerHeight - 8, rect.bottom + 8), bottom: "auto" }),
        left: Math.max(8, Math.min(rect.left, window.innerWidth - Math.min(rect.width, 320) - 8)),
        width: rect.width,
        right: "auto",
        maxHeight,
      });
    }
    updatePosition();
    const onResize = () => updatePosition();
    const onScroll = () => updatePosition();
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onScroll, { capture: true, passive: true });
    window.visualViewport?.addEventListener("resize", onResize);
    window.visualViewport?.addEventListener("scroll", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onScroll, { capture: true });
      window.visualViewport?.removeEventListener("resize", onResize);
      window.visualViewport?.removeEventListener("scroll", onResize);
    };
  }, [open]);

  // Only close on *page* scroll/resize (not when scrolling inside the menu).
  // Also don't close on scroll events that originate from inside the menu.
  useEffect(() => {
    if (!open) return;
    function handleWindowResize() {
      setOpen(false);
    }
    window.addEventListener("resize", handleWindowResize);
    window.visualViewport?.addEventListener("resize", handleWindowResize);
    return () => {
      window.removeEventListener("resize", handleWindowResize);
      window.visualViewport?.removeEventListener("resize", handleWindowResize);
    };
  }, [open]);

  return (
    <div className="md-select" ref={containerRef}>
      <button
        type="button"
        id={id}
        className="md-select__control"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={selected ? "md-select__value" : "md-select__placeholder"}>
          {selected ? selected.label : "Select…"}
        </span>
        <span className="md-select__chevron" aria-hidden="true">
          ▾
        </span>
      </button>
      {open && (
        <ul className="md-select__menu" style={menuStyle} role="listbox">
          {options.map((opt) => (
            <li
              key={opt.value}
              role="option"
              aria-selected={opt.value === value}
              className={[
                "md-select__option",
                opt.value === value ? "md-select__option--selected" : "",
                opt.disabled ? "md-select__option--disabled" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => {
                if (opt.disabled) return;
                onChange(opt.value);
                setOpen(false);
              }}
            >
              {opt.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

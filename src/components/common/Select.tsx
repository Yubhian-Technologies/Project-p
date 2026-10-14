import { Children, isValidElement, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { createPortal } from "react-dom";
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

const MENU_GAP = 8;
const VIEWPORT_MARGIN = 12;
const MENU_MAX_HEIGHT = 260;

export function Select({ id, value, onChange, disabled, children }: SelectProps) {
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const options = useMemo(() => parseOptions(children), [children]);
  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (containerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // The menu is portaled to <body> with fixed positioning so a modal or card
  // with overflow clipping can never cut it off — it is placed against the
  // viewport, flipped above the control when there's more room there, and
  // sized to fit the space available.
  useLayoutEffect(() => {
    if (!open) return;
    function place() {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const naturalHeight = Math.min(MENU_MAX_HEIGHT, options.length * 40 + 14);
      const spaceBelow = window.innerHeight - rect.bottom - MENU_GAP - VIEWPORT_MARGIN;
      const spaceAbove = rect.top - MENU_GAP - VIEWPORT_MARGIN;
      const openUp = spaceBelow < naturalHeight && spaceAbove > spaceBelow;
      const maxHeight = Math.max(80, Math.min(MENU_MAX_HEIGHT, openUp ? spaceAbove : spaceBelow));
      setMenuStyle({
        left: rect.left,
        width: rect.width,
        maxHeight,
        ...(openUp
          ? { bottom: window.innerHeight - rect.top + MENU_GAP }
          : { top: rect.bottom + MENU_GAP }),
      });
    }
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, options.length]);

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
      {open &&
        createPortal(
          <ul className="md-select__menu" role="listbox" ref={menuRef} style={menuStyle}>
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
          </ul>,
          document.body,
        )}
    </div>
  );
}

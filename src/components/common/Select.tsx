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

  // Positioned fixed (via the control's live screen rect) rather than
  // absolute-under-the-control: a `position: absolute` menu gets silently
  // clipped whenever any ancestor needs `overflow-x: auto` for its own
  // layout (e.g. a horizontally-scrollable table) — CSS forces that
  // ancestor's overflow-y to clip too, cutting the dropdown off. Fixed
  // positioning escapes that entirely.
  useLayoutEffect(() => {
    if (!open || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setMenuStyle({
      position: "fixed",
      top: rect.bottom + 8,
      left: rect.left,
      width: rect.width,
      right: "auto",
    });
  }, [open]);

  // The menu's position is only computed at open time, so if the page (or a
  // scrolling ancestor) moves while it's open, close it rather than let it
  // drift away from the control it belongs to.
  useEffect(() => {
    if (!open) return;
    function handleScroll() {
      setOpen(false);
    }
    window.addEventListener("scroll", handleScroll, { capture: true, passive: true });
    window.addEventListener("resize", handleScroll);
    return () => {
      window.removeEventListener("scroll", handleScroll, { capture: true });
      window.removeEventListener("resize", handleScroll);
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

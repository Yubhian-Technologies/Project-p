import { Children, isValidElement, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
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
        <ul className="md-select__menu" role="listbox">
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

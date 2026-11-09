import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import "./MultiSelect.css";

interface MultiSelectOption {
  value: string;
  label: string;
}

interface MultiSelectProps {
  id?: string;
  options: MultiSelectOption[];
  selected: string[];
  onChange: (values: string[]) => void;
  disabled?: boolean;
  placeholder?: string;
  emptyMessage?: string;
}

export function MultiSelect({
  id,
  options,
  selected,
  onChange,
  disabled,
  placeholder = "Select…",
  emptyMessage = "No options available",
}: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const controlRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (!containerRef.current?.contains(target) && !menuRef.current?.contains(target)) {
        setOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  useLayoutEffect(() => {
    if (!open) return;

    function updateMenuPosition() {
      const control = controlRef.current;
      if (!control) return;

      const bounds = control.getBoundingClientRect();
      const margin = 8;
      const spaceBelow = window.innerHeight - bounds.bottom - margin;
      const spaceAbove = bounds.top - margin;
      const opensBelow = spaceBelow >= Math.min(240, spaceAbove) || spaceBelow >= 160;
      const availableSpace = Math.max(80, Math.min(240, opensBelow ? spaceBelow : spaceAbove));
      const width = Math.min(bounds.width, window.innerWidth - margin * 2);
      const left = Math.min(
        Math.max(margin, bounds.left),
        window.innerWidth - width - margin,
      );

      setMenuStyle({
        position: "fixed",
        left,
        width,
        maxHeight: availableSpace,
        top: opensBelow ? bounds.bottom + margin : Math.max(margin, bounds.top - availableSpace - margin),
      });
    }

    updateMenuPosition();
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);
    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [open]);

  function toggleValue(value: string) {
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);
  }

  const selectedLabels = options.filter((o) => selected.includes(o.value)).map((o) => o.label);

  return (
    <div className="md-multiselect" ref={containerRef}>
      <button
        type="button"
        id={id}
        ref={controlRef}
        className="md-multiselect__control"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={selectedLabels.length > 0 ? "md-multiselect__value" : "md-multiselect__placeholder"}>
          {selectedLabels.length > 0 ? selectedLabels.join(", ") : placeholder}
        </span>
        <span className="md-multiselect__chevron" aria-hidden="true">
          ▾
        </span>
      </button>
      {open && menuStyle && createPortal(
        <ul
          ref={menuRef}
          className="md-multiselect__menu"
          style={menuStyle}
          role="listbox"
          aria-multiselectable="true"
        >
          {options.length === 0 && <li className="md-multiselect__empty">{emptyMessage}</li>}
          {options.map((opt) => (
            <li
              key={opt.value}
              role="option"
              aria-selected={selected.includes(opt.value)}
              className="md-multiselect__option"
              onClick={() => toggleValue(opt.value)}
            >
              <input type="checkbox" checked={selected.includes(opt.value)} readOnly />
              <span>{opt.label}</span>
            </li>
          ))}
        </ul>,
        document.body,
      )}
    </div>
  );
}

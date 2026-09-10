import { useEffect, useRef, useState } from "react";
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
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function toggleValue(value: string) {
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);
  }

  const selectedLabels = options.filter((o) => selected.includes(o.value)).map((o) => o.label);

  return (
    <div className="md-multiselect" ref={containerRef}>
      <button
        type="button"
        id={id}
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
      {open && (
        <ul className="md-multiselect__menu" role="listbox" aria-multiselectable="true">
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
        </ul>
      )}
    </div>
  );
}

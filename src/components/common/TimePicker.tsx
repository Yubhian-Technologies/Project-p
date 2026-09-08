import { useEffect, useRef, useState } from "react";
import { Select } from "./Select";
import { pad, to12Hour, to24Hour } from "../../utils/timeFormat";
import "./TimePicker.css";

interface TimePickerProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

function parseTime(value: string): { hour: number; minute: number } | null {
  if (!value) return null;
  const [hour, minute] = value.split(":").map(Number);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null;
  return { hour, minute };
}

function formatDisplay(value: string): string {
  const parsed = parseTime(value);
  if (!parsed) return "";
  const { hour12, ampm } = to12Hour(parsed.hour);
  return `${hour12}:${pad(parsed.minute)} ${ampm}`;
}

export function TimePicker({ id, value, onChange, disabled }: TimePickerProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const parsed = parseTime(value);
  const { hour12, ampm } = parsed ? to12Hour(parsed.hour) : { hour12: 12, ampm: "AM" as const };
  const minute = parsed?.minute ?? 0;

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  function commit(nextHour12: number, nextMinute: number, nextAmpm: "AM" | "PM") {
    const hour24 = to24Hour(nextHour12, nextAmpm);
    onChange(`${pad(hour24)}:${pad(nextMinute)}`);
  }

  return (
    <div className="md-timepicker" ref={containerRef}>
      <button
        type="button"
        id={id}
        className="md-timepicker__control"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className={value ? "md-timepicker__value" : "md-timepicker__placeholder"}>
          {value ? formatDisplay(value) : "--:-- --"}
        </span>
        <span className="md-timepicker__icon" aria-hidden="true">
          🕐
        </span>
      </button>

      {open && (
        <div className="md-timepicker__popup" role="dialog">
          <div className="md-timepicker__row">
            <Select value={String(hour12)} onChange={(v) => commit(Number(v), minute, ampm)}>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
                <option key={h} value={String(h)}>
                  {pad(h)}
                </option>
              ))}
            </Select>
            <Select value={String(minute)} onChange={(v) => commit(hour12, Number(v), ampm)}>
              {Array.from({ length: 60 }, (_, i) => i).map((m) => (
                <option key={m} value={String(m)}>
                  {pad(m)}
                </option>
              ))}
            </Select>
            <Select value={ampm} onChange={(v) => commit(hour12, minute, v as "AM" | "PM")}>
              <option value="AM">AM</option>
              <option value="PM">PM</option>
            </Select>
          </div>

          <div className="md-timepicker__footer">
            <button type="button" className="md-timepicker__text-btn" onClick={() => onChange("")}>
              Clear
            </button>
            <button type="button" className="md-timepicker__text-btn" onClick={() => setOpen(false)}>
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

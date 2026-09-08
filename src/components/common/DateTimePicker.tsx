import { useEffect, useRef, useState } from "react";
import { Select } from "./Select";
import "./DateTimePicker.css";

interface DateTimePickerProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  min?: string;
}

interface ParsedValue {
  year: number;
  month: number; // 0-indexed
  day: number;
  hour: number; // 0-23
  minute: number;
}

const WEEKDAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTH_LABELS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function parseValue(value: string): ParsedValue | null {
  if (!value) return null;
  const [datePart, timePart] = value.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute] = (timePart ?? "00:00").split(":").map(Number);
  if (!year || !month || !day) return null;
  return { year, month: month - 1, day, hour: hour || 0, minute: minute || 0 };
}

function formatValue(v: ParsedValue): string {
  return `${v.year}-${pad(v.month + 1)}-${pad(v.day)}T${pad(v.hour)}:${pad(v.minute)}`;
}

function dayKey(year: number, month: number, day: number): number {
  return year * 10000 + month * 100 + day;
}

function formatDisplay(value: string): string {
  const parsed = parseValue(value);
  if (!parsed) return "";
  const date = new Date(parsed.year, parsed.month, parsed.day, parsed.hour, parsed.minute);
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function to12Hour(hour24: number): { hour12: number; ampm: "AM" | "PM" } {
  const ampm: "AM" | "PM" = hour24 >= 12 ? "PM" : "AM";
  let hour12 = hour24 % 12;
  if (hour12 === 0) hour12 = 12;
  return { hour12, ampm };
}

function to24Hour(hour12: number, ampm: "AM" | "PM"): number {
  let hour = hour12 % 12;
  if (ampm === "PM") hour += 12;
  return hour;
}

export function DateTimePicker({ id, value, onChange, min }: DateTimePickerProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const parsed = parseValue(value);
  const minParsed = min ? parseValue(min) : null;
  const today = new Date();

  const [viewYear, setViewYear] = useState(parsed?.year ?? today.getFullYear());
  const [viewMonth, setViewMonth] = useState(parsed?.month ?? today.getMonth());

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function commit(next: Partial<ParsedValue>) {
    const base: ParsedValue = parsed ?? {
      year: viewYear,
      month: viewMonth,
      day: today.getDate(),
      hour: 12,
      minute: 0,
    };
    onChange(formatValue({ ...base, ...next }));
  }

  function goToMonth(delta: number) {
    let m = viewMonth + delta;
    let y = viewYear;
    if (m < 0) {
      m = 11;
      y -= 1;
    } else if (m > 11) {
      m = 0;
      y += 1;
    }
    setViewMonth(m);
    setViewYear(y);
  }

  const firstOfMonth = new Date(viewYear, viewMonth, 1);
  const startWeekday = firstOfMonth.getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: { day: number; disabled: boolean }[] = [];
  for (let i = 0; i < startWeekday; i++) {
    cells.push({ day: 0, disabled: true });
  }
  const minDayKey = minParsed ? dayKey(minParsed.year, minParsed.month, minParsed.day) : null;
  for (let day = 1; day <= daysInMonth; day++) {
    const disabled = minDayKey !== null && dayKey(viewYear, viewMonth, day) < minDayKey;
    cells.push({ day, disabled });
  }

  const { hour12, ampm } = parsed ? to12Hour(parsed.hour) : { hour12: 12, ampm: "AM" as const };

  return (
    <div className="md-datetime" ref={containerRef}>
      <button
        type="button"
        id={id}
        className="md-datetime__control"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className={value ? "md-datetime__value" : "md-datetime__placeholder"}>
          {value ? formatDisplay(value) : "Select date & time…"}
        </span>
        <span className="md-datetime__icon" aria-hidden="true">
          📅
        </span>
      </button>

      {open && (
        <div className="md-datetime__popup" role="dialog">
          <div className="md-datetime__calendar-header">
            <button type="button" className="md-datetime__nav" onClick={() => goToMonth(-1)} aria-label="Previous month">
              ‹
            </button>
            <span className="md-datetime__month-label">
              {MONTH_LABELS[viewMonth]} {viewYear}
            </span>
            <button type="button" className="md-datetime__nav" onClick={() => goToMonth(1)} aria-label="Next month">
              ›
            </button>
          </div>

          <div className="md-datetime__weekdays">
            {WEEKDAY_LABELS.map((w) => (
              <span key={w}>{w}</span>
            ))}
          </div>

          <div className="md-datetime__grid">
            {cells.map((cell, index) => {
              if (cell.day === 0) return <span key={`pad-${index}`} />;
              const isSelected =
                parsed && parsed.year === viewYear && parsed.month === viewMonth && parsed.day === cell.day;
              return (
                <button
                  key={cell.day}
                  type="button"
                  disabled={cell.disabled}
                  className={[
                    "md-datetime__day",
                    isSelected ? "md-datetime__day--selected" : "",
                    cell.disabled ? "md-datetime__day--disabled" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => commit({ year: viewYear, month: viewMonth, day: cell.day })}
                >
                  {cell.day}
                </button>
              );
            })}
          </div>

          <div className="md-datetime__time-row">
            <Select
              value={String(hour12)}
              onChange={(v) => commit({ hour: to24Hour(Number(v), ampm) })}
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
                <option key={h} value={String(h)}>
                  {h}
                </option>
              ))}
            </Select>
            <Select
              value={String(parsed?.minute ?? 0)}
              onChange={(v) => commit({ minute: Number(v) })}
            >
              {Array.from({ length: 60 }, (_, i) => i).map((m) => (
                <option key={m} value={String(m)}>
                  {pad(m)}
                </option>
              ))}
            </Select>
            <Select
              value={ampm}
              onChange={(v) => commit({ hour: to24Hour(hour12, v as "AM" | "PM") })}
            >
              <option value="AM">AM</option>
              <option value="PM">PM</option>
            </Select>
          </div>

          <div className="md-datetime__footer">
            <button type="button" className="md-datetime__text-btn" onClick={() => onChange("")}>
              Clear
            </button>
            <button type="button" className="md-datetime__text-btn" onClick={() => setOpen(false)}>
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

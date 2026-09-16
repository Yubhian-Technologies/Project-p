import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Select } from "./Select";
import { pad, to12Hour, to24Hour } from "../../utils/timeFormat";
import "./DateTimePicker.css";

interface DateTimePickerProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
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

export function DateTimePicker({ id, value, onChange, min, max }: DateTimePickerProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const parsed = parseValue(value);
  const minParsed = min ? parseValue(min) : null;
  const maxParsed = max ? parseValue(max) : null;
  const today = new Date();

  const [viewYear, setViewYear] = useState(parsed?.year ?? minParsed?.year ?? today.getFullYear());
  const [viewMonth, setViewMonth] = useState(parsed?.month ?? minParsed?.month ?? today.getMonth());

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

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
  const maxDayKey = maxParsed ? dayKey(maxParsed.year, maxParsed.month, maxParsed.day) : null;
  for (let day = 1; day <= daysInMonth; day++) {
    const key = dayKey(viewYear, viewMonth, day);
    const disabled = (minDayKey !== null && key < minDayKey) || (maxDayKey !== null && key > maxDayKey);
    cells.push({ day, disabled });
  }

  const monthKey = viewYear * 12 + viewMonth;
  const prevDisabled = minParsed !== null && monthKey <= minParsed.year * 12 + minParsed.month;
  const nextDisabled = maxParsed !== null && monthKey >= maxParsed.year * 12 + maxParsed.month;

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

      {open &&
        createPortal(
          <div className="md-datetime__modal-overlay" onClick={() => setOpen(false)}>
            <div
              className="md-datetime__popup"
              role="dialog"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="md-datetime__calendar-header">
                <button
                  type="button"
                  className="md-datetime__nav"
                  disabled={prevDisabled}
                  onClick={() => goToMonth(-1)}
                  aria-label="Previous month"
                >
                  ‹
                </button>
                <span className="md-datetime__month-label">
                  {MONTH_LABELS[viewMonth]} {viewYear}
                </span>
                <button
                  type="button"
                  className="md-datetime__nav"
                  disabled={nextDisabled}
                  onClick={() => goToMonth(1)}
                  aria-label="Next month"
                >
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
          </div>,
          document.body
        )}
    </div>
  );
}

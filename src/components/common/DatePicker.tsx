import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarIcon } from "./icons";
import { pad } from "../../utils/timeFormat";
import "./DatePicker.css";

interface DatePickerProps {
  id?: string;
  /** "YYYY-MM-DD" or "" (unset). */
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  placeholder?: string;
}

interface ParsedDate {
  year: number;
  month: number; // 0-indexed
  day: number;
}

const WEEKDAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTH_LABELS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function parseDateKey(value: string): ParsedDate | null {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  return { year, month: month - 1, day };
}

function formatDateKey(d: ParsedDate): string {
  return `${d.year}-${pad(d.month + 1)}-${pad(d.day)}`;
}

function dayKey(d: ParsedDate): number {
  return d.year * 10000 + d.month * 100 + d.day;
}

function formatDisplayDate(value: string): string {
  const parsed = parseDateKey(value);
  if (!parsed) return "";
  return new Date(parsed.year, parsed.month, parsed.day).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** "Ours" — a single-date version of the app's own calendar-popup picker
    (see DateTimePicker), used anywhere a plain native date input needs the
    app's own styling. Closes via clicking the dimmed overlay behind the
    popup (with the popup itself stopping that click from bubbling) rather
    than a document-wide "click outside" listener — a mousedown-based
    outside-click listener doesn't know about content rendered into a
    portal, so it was closing the calendar the instant a day was clicked,
    before the selection could register. */
export function DatePicker({ id, value, onChange, min, max, placeholder }: DatePickerProps) {
  const [open, setOpen] = useState(false);

  const parsed = parseDateKey(value);
  const minParsed = min ? parseDateKey(min) : null;
  const maxParsed = max ? parseDateKey(max) : null;
  const today: ParsedDate = {
    year: new Date().getFullYear(),
    month: new Date().getMonth(),
    day: new Date().getDate(),
  };
  // Default the view to today's month, clamped into [min, max] if today
  // falls outside it — not to the min bound's month unconditionally, which
  // otherwise always opened on whenever the account was created instead of
  // the month someone actually wants to look at first.
  const defaultView =
    parsed ??
    (minParsed && dayKey(today) < dayKey(minParsed)
      ? minParsed
      : maxParsed && dayKey(today) > dayKey(maxParsed)
        ? maxParsed
        : today);

  const [viewYear, setViewYear] = useState(defaultView.year);
  const [viewMonth, setViewMonth] = useState(defaultView.month);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

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
  const minDayKey = minParsed ? dayKey(minParsed) : null;
  const maxDayKey = maxParsed ? dayKey(maxParsed) : null;
  const selectedKey = parsed ? dayKey(parsed) : null;

  const cells: { day: number; disabled: boolean; selected: boolean }[] = [];
  for (let i = 0; i < startWeekday; i++) {
    cells.push({ day: 0, disabled: true, selected: false });
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const key = dayKey({ year: viewYear, month: viewMonth, day });
    const disabled = (minDayKey !== null && key < minDayKey) || (maxDayKey !== null && key > maxDayKey);
    cells.push({ day, disabled, selected: selectedKey !== null && key === selectedKey });
  }

  const monthKey = viewYear * 12 + viewMonth;
  const prevDisabled = minParsed !== null && monthKey <= minParsed.year * 12 + minParsed.month;
  const nextDisabled = maxParsed !== null && monthKey >= maxParsed.year * 12 + maxParsed.month;

  return (
    <div className="md-date">
      <button
        type="button"
        id={id}
        className="md-date__control"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className={value ? "md-date__value" : "md-date__placeholder"}>
          {value ? formatDisplayDate(value) : (placeholder ?? "Select date…")}
        </span>
        <span className="md-date__icon" aria-hidden="true">
          <CalendarIcon />
        </span>
      </button>

      {open &&
        createPortal(
          <div className="md-date__modal-overlay" onClick={() => setOpen(false)}>
            <div className="md-date__popup" role="dialog" onClick={(e) => e.stopPropagation()}>
              <div className="md-date__calendar-header">
                <button
                  type="button"
                  className="md-date__nav"
                  disabled={prevDisabled}
                  onClick={() => goToMonth(-1)}
                  aria-label="Previous month"
                >
                  ‹
                </button>
                <span className="md-date__month-label">
                  {MONTH_LABELS[viewMonth]} {viewYear}
                </span>
                <button
                  type="button"
                  className="md-date__nav"
                  disabled={nextDisabled}
                  onClick={() => goToMonth(1)}
                  aria-label="Next month"
                >
                  ›
                </button>
              </div>

              <div className="md-date__weekdays">
                {WEEKDAY_LABELS.map((w) => (
                  <span key={w}>{w}</span>
                ))}
              </div>

              <div className="md-date__grid">
                {cells.map((cell, index) => {
                  if (cell.day === 0) return <span key={`pad-${index}`} />;
                  return (
                    <button
                      key={cell.day}
                      type="button"
                      disabled={cell.disabled}
                      className={[
                        "md-date__day",
                        cell.selected ? "md-date__day--selected" : "",
                        cell.disabled ? "md-date__day--disabled" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      onClick={() => {
                        onChange(formatDateKey({ year: viewYear, month: viewMonth, day: cell.day }));
                        setOpen(false);
                      }}
                    >
                      {cell.day}
                    </button>
                  );
                })}
              </div>

              <div className="md-date__footer">
                <button type="button" className="md-date__text-btn" onClick={() => onChange("")}>
                  Clear
                </button>
                <button type="button" className="md-date__text-btn" onClick={() => setOpen(false)}>
                  Done
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

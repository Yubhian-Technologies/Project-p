import { useState } from "react";
import "./JournalCalendar.css";

interface JournalCalendarProps {
  selectedDate: string; // "YYYY-MM-DD"
  onSelectDate: (date: string) => void;
  markedDates: Set<string>;
  dueReminderDates: Set<string>;
}

const WEEKDAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTH_LABELS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function isoDate(year: number, month: number, day: number): string {
  return `${year}-${pad2(month + 1)}-${pad2(day)}`;
}

export function JournalCalendar({ selectedDate, onSelectDate, markedDates, dueReminderDates }: JournalCalendarProps) {
  const [selYear, selMonth] = selectedDate.split("-").map(Number);
  const [viewYear, setViewYear] = useState(selYear);
  const [viewMonth, setViewMonth] = useState(selMonth - 1);

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
  const cells: { day: number }[] = [];
  for (let i = 0; i < startWeekday; i++) {
    cells.push({ day: 0 });
  }
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({ day });
  }

  return (
    <div className="journal-calendar">
      <div className="journal-calendar__header">
        <button type="button" className="journal-calendar__nav" onClick={() => goToMonth(-1)} aria-label="Previous month">
          ‹
        </button>
        <span className="journal-calendar__month-label">
          {MONTH_LABELS[viewMonth]} {viewYear}
        </span>
        <button type="button" className="journal-calendar__nav" onClick={() => goToMonth(1)} aria-label="Next month">
          ›
        </button>
      </div>

      <div className="journal-calendar__weekdays">
        {WEEKDAY_LABELS.map((w) => (
          <span key={w}>{w}</span>
        ))}
      </div>

      <div className="journal-calendar__grid">
        {cells.map((cell, index) => {
          if (cell.day === 0) return <span key={`pad-${index}`} />;
          const dateId = isoDate(viewYear, viewMonth, cell.day);
          const isSelected = dateId === selectedDate;
          const hasNote = markedDates.has(dateId);
          const isDueReminder = dueReminderDates.has(dateId);
          return (
            <button
              key={cell.day}
              type="button"
              className={[
                "journal-calendar__day",
                isSelected ? "journal-calendar__day--selected" : "",
                isDueReminder ? "journal-calendar__day--due" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => onSelectDate(dateId)}
            >
              {cell.day}
              {hasNote && <span className="journal-calendar__dot" aria-hidden="true" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

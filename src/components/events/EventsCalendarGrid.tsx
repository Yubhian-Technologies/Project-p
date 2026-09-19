import { useState } from "react";
import type { FormEvent } from "react";
import type { CalendarMonth } from "../../types/calendarMonth";
import type { CalendarYear } from "../../types/calendarYear";
import type { EventCategory, EventPhase, EventProgram } from "../../types/event";
import { EVENT_CATEGORIES, MONTH_LABELS, formatSessionYears, monthRowLabel } from "../../utils/academicCalendar";
import { Select } from "../common/Select";
import { Button } from "../common/Button";
import "./EventsCalendarGrid.css";

interface EventsCalendarGridProps {
  years: CalendarYear[];
  selectedYearId: string;
  onSelectYear: (yearId: string) => void;
  onAddYear?: (label: string) => void;
  onEditYear?: (yearId: string, label: string) => void;
  onDeleteYear?: (yearId: string) => void;
  months: CalendarMonth[];
  onAddMonth?: (month: number, calendarYear: number) => void;
  onEditMonth?: (monthId: string, month: number, calendarYear: number) => void;
  onDeleteMonth?: (monthId: string) => void;
  events: EventProgram[];
  readOnly?: boolean;
  onAddEvent?: (category: EventCategory, yearId: string, monthId: string) => void;
  onSelectEvent?: (event: EventProgram) => void;
}

export const PHASE_BADGE: Record<EventPhase, { label: string; variant: string }> = {
  scheduled: { label: "Scheduled", variant: "primary" },
  completed: { label: "Completed", variant: "success" },
  "not-conducted": { label: "Not conducted", variant: "neutral" },
};

export function EventsCalendarGrid({
  years,
  selectedYearId,
  onSelectYear,
  onAddYear,
  onEditYear,
  onDeleteYear,
  months,
  onAddMonth,
  onEditMonth,
  onDeleteMonth,
  events,
  readOnly,
  onAddEvent,
  onSelectEvent,
}: EventsCalendarGridProps) {
  const [addingYear, setAddingYear] = useState(false);
  const [yearLabelDraft, setYearLabelDraft] = useState("");

  const [editingYear, setEditingYear] = useState(false);
  const [yearEditDraft, setYearEditDraft] = useState("");

  const [addingMonth, setAddingMonth] = useState(false);
  const [monthDraft, setMonthDraft] = useState("0");
  const [calendarYearDraft, setCalendarYearDraft] = useState(String(new Date().getFullYear()));

  const [editingMonthId, setEditingMonthId] = useState<string | null>(null);
  const [editMonthDraft, setEditMonthDraft] = useState("0");
  const [editCalendarYearDraft, setEditCalendarYearDraft] = useState(String(new Date().getFullYear()));

  const selectedYear = years.find((y) => y.id === selectedYearId);
  const sortedMonths = [...months].sort((a, b) => a.calendarYear * 12 + a.month - (b.calendarYear * 12 + b.month));
  const usedMonthKeys = new Set(sortedMonths.map((m) => `${m.calendarYear}-${m.month}`));
  const availableMonthOptions = MONTH_LABELS.map((label, index) => ({ label, value: index })).filter(
    (opt) => !usedMonthKeys.has(`${calendarYearDraft}-${opt.value}`),
  );

  function eventsFor(category: EventCategory, monthId: string) {
    return events.filter((event) => event.category === category && event.calendarMonthId === monthId);
  }

  function editableMonthOptions(excludeMonthId: string, yearDraft: string) {
    return MONTH_LABELS.map((label, index) => ({ label, value: index })).filter((opt) => {
      const key = `${yearDraft}-${opt.value}`;
      const owner = sortedMonths.find((m) => `${m.calendarYear}-${m.month}` === key);
      return !owner || owner.id === excludeMonthId;
    });
  }

  function handleAddYear(e: FormEvent) {
    e.preventDefault();
    if (!yearLabelDraft.trim() || !onAddYear) return;
    onAddYear(yearLabelDraft.trim());
    setYearLabelDraft("");
    setAddingYear(false);
  }

  function handleStartEditYear() {
    if (!selectedYear) return;
    setYearEditDraft(selectedYear.label);
    setEditingYear(true);
  }

  function handleSaveYearEdit(e: FormEvent) {
    e.preventDefault();
    if (!yearEditDraft.trim() || !onEditYear || !selectedYearId) return;
    onEditYear(selectedYearId, yearEditDraft.trim());
    setEditingYear(false);
  }

  function handleAddMonth(e: FormEvent) {
    e.preventDefault();
    if (!onAddMonth) return;
    onAddMonth(Number(monthDraft), Number(calendarYearDraft));
    setAddingMonth(false);
  }

  function handleStartEditMonth(month: CalendarMonth) {
    setEditingMonthId(month.id);
    setEditMonthDraft(String(month.month));
    setEditCalendarYearDraft(String(month.calendarYear));
  }

  function handleSaveMonthEdit(e: FormEvent, monthId: string) {
    e.preventDefault();
    if (!onEditMonth) return;
    onEditMonth(monthId, Number(editMonthDraft), Number(editCalendarYearDraft));
    setEditingMonthId(null);
  }

  return (
    <div className="events-calendar">
      <div className="events-calendar__year-bar">
        <div className="events-calendar__field">
          <label htmlFor="events-calendar-year">Academic year</label>
          <Select id="events-calendar-year" value={selectedYearId} onChange={onSelectYear} disabled={years.length === 0}>
            <option value="" disabled>
              {years.length === 0 ? "No years added yet" : "Select a year…"}
            </option>
            {years.map((year) => (
              <option key={year.id} value={year.id}>
                {year.label}
              </option>
            ))}
          </Select>
        </div>

        {!readOnly && selectedYearId && !editingYear && (onEditYear || onDeleteYear) && (
          <div className="events-calendar__row-actions">
            {onEditYear && (
              <button type="button" className="events-calendar__icon-btn" onClick={handleStartEditYear}>
                Edit
              </button>
            )}
            {onDeleteYear && (
              <button
                type="button"
                className="events-calendar__icon-btn events-calendar__icon-btn--danger"
                onClick={() => onDeleteYear(selectedYearId)}
              >
                Delete
              </button>
            )}
          </div>
        )}

        {!readOnly && editingYear && (
          <form className="events-calendar__inline-form" onSubmit={handleSaveYearEdit}>
            <input
              type="text"
              autoFocus
              value={yearEditDraft}
              onChange={(e) => setYearEditDraft(e.target.value)}
            />
            <Button type="submit" disabled={!yearEditDraft.trim()}>
              Save
            </Button>
            <Button type="button" variant="outlined" onClick={() => setEditingYear(false)}>
              Cancel
            </Button>
          </form>
        )}

        {!readOnly && onAddYear && !addingYear && (
          <Button type="button" variant="outlined" onClick={() => setAddingYear(true)}>
            + Add year
          </Button>
        )}

        {!readOnly && onAddYear && addingYear && (
          <form className="events-calendar__inline-form" onSubmit={handleAddYear}>
            <input
              type="text"
              autoFocus
              placeholder="e.g. 2026-2027"
              value={yearLabelDraft}
              onChange={(e) => setYearLabelDraft(e.target.value)}
            />
            <Button type="submit" disabled={!yearLabelDraft.trim()}>
              Add
            </Button>
            <Button type="button" variant="outlined" onClick={() => setAddingYear(false)}>
              Cancel
            </Button>
          </form>
        )}
      </div>

      {years.length === 0 && (
        <p className="events-calendar__empty">
          {readOnly
            ? "No academic years added yet for this college."
            : "Add your first academic year to start planning this college's calendar."}
        </p>
      )}

      {years.length > 0 && !selectedYearId && <p className="events-calendar__empty">Select an academic year above.</p>}

      {selectedYearId && sortedMonths.length === 0 && (
        <p className="events-calendar__empty">
          {readOnly ? "No months added yet for this year." : "Add a month below to start planning it."}
        </p>
      )}

      {selectedYearId && sortedMonths.length > 0 && (
        <div className="events-calendar__grid">
          <div className="events-calendar__header events-calendar__header--month" />
          {EVENT_CATEGORIES.map((category) => (
            <div key={category.id} className="events-calendar__header">
              {category.label}
            </div>
          ))}

          {sortedMonths.map((month) => {
            const isEditingThisMonth = editingMonthId === month.id;
            return (
              <div className="events-calendar__row" key={month.id}>
                {isEditingThisMonth ? (
                  <form
                    className="events-calendar__month-edit-form"
                    onSubmit={(e) => handleSaveMonthEdit(e, month.id)}
                  >
                    <Select value={editMonthDraft} onChange={setEditMonthDraft}>
                      {editableMonthOptions(month.id, editCalendarYearDraft).map((opt) => (
                        <option key={opt.value} value={String(opt.value)}>
                          {opt.label}
                        </option>
                      ))}
                    </Select>
                    <input
                      type="number"
                      className="events-calendar__year-input"
                      value={editCalendarYearDraft}
                      onChange={(e) => setEditCalendarYearDraft(e.target.value)}
                    />
                    <div className="events-calendar__row-actions">
                      <Button type="submit">Save</Button>
                      <Button type="button" variant="outlined" onClick={() => setEditingMonthId(null)}>
                        Cancel
                      </Button>
                    </div>
                  </form>
                ) : (
                  <div className="events-calendar__month-label">
                    <span>{monthRowLabel(month.month, month.calendarYear)}</span>
                    {!readOnly && (onEditMonth || onDeleteMonth) && (
                      <div className="events-calendar__row-actions">
                        {onEditMonth && (
                          <button
                            type="button"
                            className="events-calendar__icon-btn"
                            onClick={() => handleStartEditMonth(month)}
                          >
                            Edit
                          </button>
                        )}
                        {onDeleteMonth && (
                          <button
                            type="button"
                            className="events-calendar__icon-btn events-calendar__icon-btn--danger"
                            onClick={() => onDeleteMonth(month.id)}
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
                {EVENT_CATEGORIES.map((category) => {
                  const cellEvents = eventsFor(category.id, month.id);
                  return (
                    <div className="events-calendar__cell" key={category.id} data-label={category.label}>
                      {cellEvents.map((event) => {
                        const badge = PHASE_BADGE[event.phase];
                        return (
                          <button
                            key={event.id}
                            type="button"
                            className="events-calendar__chip"
                            onClick={() => onSelectEvent?.(event)}
                          >
                            <div className="events-calendar__chip-top">
                              <span className="events-calendar__chip-title">{event.title}</span>
                              <span className="events-calendar__chip-view-btn">View Details →</span>
                            </div>
                            <span className="events-calendar__chip-tags">
                              <span className={`bento-badge bento-badge--${badge.variant} events-calendar__chip-badge`}>
                                {badge.label}
                              </span>
                              {event.sessionYears && event.sessionYears.length > 0 && (
                                <span className="bento-badge bento-badge--neutral events-calendar__chip-badge">
                                  {formatSessionYears(event.sessionYears)}
                                </span>
                              )}
                            </span>
                            {event.reschedule && (
                              <span className="events-calendar__chip-reschedule">
                                {event.reschedule.type === "postponed" ? "Postponed" : "Preponed"} from{" "}
                                {new Date(event.reschedule.previousDate).toLocaleDateString()}
                              </span>
                            )}
                          </button>
                        );
                      })}
                      {!readOnly && onAddEvent && (
                        <button
                          type="button"
                          className="events-calendar__add"
                          onClick={() => onAddEvent(category.id, selectedYearId, month.id)}
                        >
                          + Add
                        </button>
                      )}
                      {readOnly && cellEvents.length === 0 && <span className="events-calendar__cell-empty">—</span>}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      {!readOnly && onAddMonth && selectedYearId && (
        <div className="events-calendar__add-month">
          {!addingMonth && (
            <Button type="button" variant="outlined" onClick={() => setAddingMonth(true)}>
              + Add month
            </Button>
          )}
          {addingMonth && (
            <form className="events-calendar__inline-form" onSubmit={handleAddMonth}>
              <Select value={monthDraft} onChange={setMonthDraft}>
                {availableMonthOptions.length === 0 && (
                  <option value={monthDraft} disabled>
                    All months added for this year
                  </option>
                )}
                {availableMonthOptions.map((opt) => (
                  <option key={opt.value} value={String(opt.value)}>
                    {opt.label}
                  </option>
                ))}
              </Select>
              <input
                type="number"
                className="events-calendar__year-input"
                value={calendarYearDraft}
                onChange={(e) => setCalendarYearDraft(e.target.value)}
              />
              <Button type="submit" disabled={availableMonthOptions.length === 0}>
                Add
              </Button>
              <Button type="button" variant="outlined" onClick={() => setAddingMonth(false)}>
                Cancel
              </Button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

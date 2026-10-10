import { useState } from "react";
import type { FormEvent } from "react";
import type { CalendarMonth } from "../../types/calendarMonth";
import type { CalendarYear } from "../../types/calendarYear";
import type { EventCategory, EventProgram } from "../../types/event";
import { EVENT_CATEGORIES, MONTH_LABELS, PHASE_BADGE, formatSessionYears, monthRowLabel } from "../../utils/academicCalendar";
import { downloadXlsx } from "../../utils/excelExport";
import { formatDateDMY } from "../../utils/formatDate";
import { Select } from "../common/Select";
import { Button } from "../common/Button";
import { PencilIcon, TrashIcon, DownloadIcon, EyeIcon } from "../common/icons";
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

  // Drill-down: year -> category (Main Programs / Group Session) -> month ->
  // that month's events, instead of dumping every month and category into
  // one big grid at once.
  const [selectedCategory, setSelectedCategory] = useState<EventCategory | null>(null);
  const [selectedMonthId, setSelectedMonthId] = useState<string | null>(null);

  // Reset the drill-down whenever the year prop itself changes — done during
  // render (comparing against the year we last rendered for) rather than in
  // an effect, so the reset lands in the same pass instead of flashing the
  // old category/month for one extra render first.
  const [yearForDrillDown, setYearForDrillDown] = useState(selectedYearId);
  if (selectedYearId !== yearForDrillDown) {
    setYearForDrillDown(selectedYearId);
    setSelectedCategory(null);
    setSelectedMonthId(null);
  }

  const selectedYear = years.find((y) => y.id === selectedYearId);
  const sortedMonths = [...months].sort((a, b) => a.calendarYear * 12 + a.month - (b.calendarYear * 12 + b.month));
  const usedMonthKeys = new Set(sortedMonths.map((m) => `${m.calendarYear}-${m.month}`));
  const availableMonthOptions = MONTH_LABELS.map((label, index) => ({ label, value: index })).filter(
    (opt) => !usedMonthKeys.has(`${calendarYearDraft}-${opt.value}`),
  );
  const selectedMonth = sortedMonths.find((m) => m.id === selectedMonthId);
  const selectedCategoryLabel = EVENT_CATEGORIES.find((c) => c.id === selectedCategory)?.label;

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

  function handleDeleteYearClick() {
    if (!onDeleteYear || !selectedYear) return;
    if (!window.confirm(`Delete "${selectedYear.label}" and every month and event inside it? This cannot be undone.`)) {
      return;
    }
    onDeleteYear(selectedYearId);
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

  function handleDeleteMonthClick(month: CalendarMonth) {
    if (!onDeleteMonth) return;
    const label = monthRowLabel(month.month, month.calendarYear);
    if (!window.confirm(`Delete "${label}" and every event inside it? This cannot be undone.`)) return;
    onDeleteMonth(month.id);
  }

  function handleSaveMonthEdit(e: FormEvent, monthId: string) {
    e.preventDefault();
    if (!onEditMonth) return;
    onEditMonth(monthId, Number(editMonthDraft), Number(editCalendarYearDraft));
    setEditingMonthId(null);
  }

  async function handleExportCategory() {
    if (!selectedCategory || !selectedYear) return;
    const categoryEvents = events
      .filter((e) => e.category === selectedCategory)
      .sort((a, b) => a.eventDate - b.eventDate);
    const rows: (string | number)[][] = [
      [`Academic Year: ${selectedYear.label}`, "", "", ""],
      [`Program: ${selectedCategoryLabel ?? ""}`, "", "", ""],
      [],
      ["Month", "Program Name", "Status", "Session Taken By"],
      ...categoryEvents.map((event) => {
        const month = months.find((m) => m.id === event.calendarMonthId);
        return [
          month ? monthRowLabel(month.month, month.calendarYear) : "—",
          event.title,
          PHASE_BADGE[event.phase].label,
          event.organizerNames.length > 0 ? event.organizerNames.join(", ") : "—",
        ];
      }),
    ];
    const filename = `${selectedCategoryLabel}-${selectedYear.label}.xlsx`.replace(/\s+/g, "-");
    await downloadXlsx(filename, "Events", rows, {
      merges: [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 3 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: 3 } },
      ],
      colWidths: [16, 32, 16, 32],
    });
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
              <button
                type="button"
                className="events-calendar__icon-btn"
                aria-label="Edit academic year"
                title="Edit"
                onClick={handleStartEditYear}
              >
                <PencilIcon />
              </button>
            )}
            {onDeleteYear && (
              <button
                type="button"
                className="events-calendar__icon-btn events-calendar__icon-btn--danger"
                aria-label="Delete academic year"
                title="Delete"
                onClick={handleDeleteYearClick}
              >
                <TrashIcon />
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

      {/* Step 1: choose Main Programs or Group Session */}
      {selectedYearId && !selectedCategory && (
        <div className="events-calendar__category-step">
          <p className="events-calendar__step-label">Choose what you&apos;d like to view</p>
          <div className="events-calendar__category-grid">
            {EVENT_CATEGORIES.map((category) => {
              const count = events.filter((e) => e.category === category.id).length;
              return (
                <button
                  key={category.id}
                  type="button"
                  className="events-calendar__category-card"
                  onClick={() => setSelectedCategory(category.id)}
                >
                  <span className="events-calendar__category-card-title">{category.label}</span>
                  <span className="events-calendar__category-card-count">
                    {count} event{count === 1 ? "" : "s"}
                  </span>
                  <span className="events-calendar__category-card-arrow">View →</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Step 2: choose a month within that category */}
      {selectedYearId && selectedCategory && !selectedMonthId && (
        <div className="events-calendar__month-step">
          <button type="button" className="events-calendar__back-btn" onClick={() => setSelectedCategory(null)}>
            ← Back to categories
          </button>
          <div className="events-calendar__month-step-head">
            <p className="events-calendar__step-label">{selectedCategoryLabel} — select a month</p>
            <Button
              type="button"
              variant="outlined"
              disabled={events.filter((e) => e.category === selectedCategory).length === 0}
              onClick={handleExportCategory}
            >
              <DownloadIcon /> Export
            </Button>
          </div>

          {sortedMonths.length === 0 && (
            <p className="events-calendar__empty">
              {readOnly ? "No months added yet for this year." : "Add a month below to start planning it."}
            </p>
          )}

          {sortedMonths.length > 0 && (
            <div className="events-calendar__month-grid">
              {sortedMonths.map((month) => {
                const isEditingThisMonth = editingMonthId === month.id;
                const count = eventsFor(selectedCategory, month.id).length;
                return (
                  <div className="events-calendar__month-card" key={month.id}>
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
                      <>
                        <button
                          type="button"
                          className="events-calendar__month-card-main"
                          onClick={() => setSelectedMonthId(month.id)}
                        >
                          <span className="events-calendar__month-card-title">
                            {monthRowLabel(month.month, month.calendarYear)}
                          </span>
                          <span className="events-calendar__month-card-count">
                            {count} event{count === 1 ? "" : "s"}
                          </span>
                        </button>
                        <div className="events-calendar__row-actions events-calendar__month-card-actions">
                          <button
                            type="button"
                            className="events-calendar__icon-btn events-calendar__icon-btn--view"
                            aria-label="View this month"
                            title="View"
                            onClick={() => setSelectedMonthId(month.id)}
                          >
                            <EyeIcon /> View
                          </button>
                          {!readOnly && onEditMonth && (
                            <button
                              type="button"
                              className="events-calendar__icon-btn"
                              aria-label="Edit this month"
                              title="Edit"
                              onClick={() => handleStartEditMonth(month)}
                            >
                              <PencilIcon />
                            </button>
                          )}
                          {!readOnly && onDeleteMonth && (
                            <button
                              type="button"
                              className="events-calendar__icon-btn events-calendar__icon-btn--danger"
                              aria-label="Delete this month"
                              title="Delete"
                              onClick={() => handleDeleteMonthClick(month)}
                            >
                              <TrashIcon />
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {!readOnly && onAddMonth && (
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
      )}

      {/* Step 3: that month's events for the chosen category */}
      {selectedYearId && selectedCategory && selectedMonthId && selectedMonth && (
        <div className="events-calendar__event-step">
          <button type="button" className="events-calendar__back-btn" onClick={() => setSelectedMonthId(null)}>
            ← Back to months
          </button>
          <p className="events-calendar__step-label">
            {selectedCategoryLabel} — {monthRowLabel(selectedMonth.month, selectedMonth.calendarYear)}
          </p>

          <div className="events-calendar__event-grid">
            {eventsFor(selectedCategory, selectedMonthId).map((event) => {
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
                      {formatDateDMY(event.reschedule.previousDate)}
                    </span>
                  )}
                </button>
              );
            })}
            {!readOnly && onAddEvent && (
              <button
                type="button"
                className="events-calendar__add events-calendar__add--block"
                onClick={() => onAddEvent(selectedCategory, selectedYearId, selectedMonthId)}
              >
                + Add
              </button>
            )}
            {readOnly && eventsFor(selectedCategory, selectedMonthId).length === 0 && (
              <span className="events-calendar__cell-empty">No events yet.</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

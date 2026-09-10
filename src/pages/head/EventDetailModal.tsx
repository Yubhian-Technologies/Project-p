import { useState } from "react";
import type { FormEvent } from "react";
import type { EventCategory, EventProgram } from "../../types/event";
import type { UserProfile } from "../../types/user";
import { createEvent, deleteEvent, updateEvent } from "../../services/firebase/events";
import { uploadEventReport } from "../../services/firebase/storage";
import { Modal } from "../../components/common/Modal";
import { Button } from "../../components/common/Button";
import { Select } from "../../components/common/Select";
import { MultiSelect } from "../../components/common/MultiSelect";
import { DateTimePicker } from "../../components/common/DateTimePicker";
import { EVENT_CATEGORIES, SESSION_YEAR_OPTIONS, formatSessionYears } from "../../utils/academicCalendar";
import { PHASE_BADGE } from "../../components/events/EventsCalendarGrid";
import "./EventDetailModal.css";

type Mode = "create" | "manage" | "view";

interface EventDetailModalProps {
  mode: Mode;
  onClose: () => void;
  onSaved: () => void;
  campusId: string;
  collegeId: string;
  createdBy?: string;
  organizers?: UserProfile[];
  event?: EventProgram;
  defaultCategory?: EventCategory;
  defaultDate?: string; // "YYYY-MM-DDTHH:mm"
  calendarYearId?: string;
  calendarMonthId?: string;
}

function toDateTimeValue(timestamp: number): string {
  const d = new Date(timestamp);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function monthBounds(value: string): { min: string; max: string } | null {
  if (!value) return null;
  const [datePart] = value.split("T");
  const [year, month] = datePart.split("-").map(Number);
  if (!year || !month) return null;
  const pad = (n: number) => String(n).padStart(2, "0");
  const lastDay = new Date(year, month, 0).getDate();
  return {
    min: `${year}-${pad(month)}-01T00:00`,
    max: `${year}-${pad(month)}-${pad(lastDay)}T23:59`,
  };
}

export function EventDetailModal({
  mode,
  onClose,
  onSaved,
  campusId,
  collegeId,
  createdBy,
  organizers = [],
  event,
  defaultCategory,
  defaultDate,
  calendarYearId,
  calendarMonthId,
}: EventDetailModalProps) {
  const [title, setTitle] = useState(event?.title ?? "");
  const [description, setDescription] = useState(event?.description ?? "");
  const [category, setCategory] = useState<EventCategory>(event?.category ?? defaultCategory ?? "main-program");
  const [sessionYears, setSessionYears] = useState<string[]>(event?.sessionYears ?? []);
  const [targetGroup, setTargetGroup] = useState(event?.targetGroup ?? "");
  const [importantDay, setImportantDay] = useState(event?.importantDay ?? "");
  const [selectedOrganizerIds, setSelectedOrganizerIds] = useState<string[]>(event?.organizerIds ?? []);
  const [dateValue, setDateValue] = useState(event ? toDateTimeValue(event.eventDate) : defaultDate ?? "");
  const [attendeeCount, setAttendeeCount] = useState(String(event?.attendeeCount ?? 0));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [dateBounds] = useState(() => monthBounds(event ? toDateTimeValue(event.eventDate) : defaultDate ?? ""));

  const [actionMode, setActionMode] = useState<
    "complete" | "not-conducted" | "postponed" | "preponed" | null
  >(null);
  const [reportFile, setReportFile] = useState<File | null>(null);
  const [notConductedReason, setNotConductedReason] = useState(event?.notConductedReason ?? "");
  const [rescheduleDateValue, setRescheduleDateValue] = useState("");
  const [rescheduleNote, setRescheduleNote] = useState("");
  const [actionBusy, setActionBusy] = useState(false);
  const [error, setError] = useState("");

  const modalTitle = mode === "create" ? "+ Add Event" : mode === "view" ? "Event details" : "Manage event";

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    const requiresFullDetails = category === "group-session";
    if (requiresFullDetails && (selectedOrganizerIds.length === 0 || !dateValue)) return;

    const selectedOrganizers = organizers.filter((o) => selectedOrganizerIds.includes(o.uid));
    const eventDate = dateValue ? new Date(dateValue).getTime() : Date.now();
    // Firestore rejects `undefined` field values outright, so optional text fields
    // must be omitted entirely rather than assigned `field: value || undefined`.
    const optionalFields: { targetGroup?: string; importantDay?: string } = {};
    if (targetGroup.trim()) optionalFields.targetGroup = targetGroup.trim();
    if (importantDay.trim()) optionalFields.importantDay = importantDay.trim();

    setSaving(true);
    setError("");
    try {
      if (mode === "create") {
        if (!calendarYearId || !calendarMonthId) return;
        await createEvent({
          campusId,
          collegeId,
          calendarYearId,
          calendarMonthId,
          category,
          sessionYears,
          title: title.trim(),
          description: description.trim(),
          ...optionalFields,
          organizerIds: selectedOrganizers.map((o) => o.uid),
          organizerNames: selectedOrganizers.map((o) => o.displayName || o.email),
          eventDate,
          attendeeCount: 0,
          phase: "scheduled",
          createdBy: createdBy ?? "",
        });
      } else if (event) {
        await updateEvent(event.id, {
          title: title.trim(),
          description: description.trim(),
          category,
          sessionYears,
          ...optionalFields,
          organizerIds: selectedOrganizers.map((o) => o.uid),
          organizerNames: selectedOrganizers.map((o) => o.displayName || o.email),
          eventDate,
          attendeeCount: Number(attendeeCount) || 0,
        });
      }
      onSaved();
      onClose();
    } catch {
      setError("Couldn't save this event. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!event) return;
    setDeleting(true);
    setError("");
    try {
      await deleteEvent(event.id);
      onSaved();
      onClose();
    } catch {
      setError("Couldn't delete this event. Please try again.");
    } finally {
      setDeleting(false);
    }
  }

  async function handleConfirmComplete() {
    if (!event) return;
    setActionBusy(true);
    setError("");
    try {
      let reportUrl: string | undefined;
      let reportFileName: string | undefined;
      let reportUploadedAt: number | undefined;
      if (reportFile) {
        reportUrl = await uploadEventReport(event.id, reportFile);
        reportFileName = reportFile.name;
        reportUploadedAt = Date.now();
      }
      await updateEvent(event.id, {
        phase: "completed",
        ...(reportUrl ? { reportUrl, reportFileName, reportUploadedAt } : {}),
      });
      onSaved();
      onClose();
    } catch {
      setError("Couldn't mark this event completed. Please try again.");
    } finally {
      setActionBusy(false);
    }
  }

  async function handleUploadReportOnly() {
    if (!event || !reportFile) return;
    setActionBusy(true);
    setError("");
    try {
      const reportUrl = await uploadEventReport(event.id, reportFile);
      await updateEvent(event.id, {
        reportUrl,
        reportFileName: reportFile.name,
        reportUploadedAt: Date.now(),
      });
      onSaved();
      onClose();
    } catch {
      setError("Couldn't upload the report. Please try again.");
    } finally {
      setActionBusy(false);
    }
  }

  async function handleConfirmNotConducted() {
    if (!event || !notConductedReason.trim()) return;
    setActionBusy(true);
    setError("");
    try {
      await updateEvent(event.id, {
        phase: "not-conducted",
        notConductedReason: notConductedReason.trim(),
      });
      onSaved();
      onClose();
    } catch {
      setError("Couldn't save this. Please try again.");
    } finally {
      setActionBusy(false);
    }
  }

  async function handleConfirmReschedule(type: "postponed" | "preponed") {
    if (!event || !rescheduleDateValue) return;
    setActionBusy(true);
    setError("");
    try {
      await updateEvent(event.id, {
        eventDate: new Date(rescheduleDateValue).getTime(),
        reschedule: {
          type,
          previousDate: event.eventDate,
          ...(rescheduleNote.trim() ? { note: rescheduleNote.trim() } : {}),
        },
      });
      onSaved();
      onClose();
    } catch {
      setError("Couldn't reschedule this event. Please try again.");
    } finally {
      setActionBusy(false);
    }
  }

  const categoryLabel = EVENT_CATEGORIES.find((c) => c.id === event?.category)?.label;
  const viewBadge = event ? PHASE_BADGE[event.phase] : null;

  return (
    <Modal title={modalTitle} onClose={onClose} className="event-detail-modal">
      {mode === "view" && event ? (
        <div className="event-detail-modal__view">
          <div className="event-detail-modal__view-header">
            <h3 className="event-detail-modal__view-title">{event.title}</h3>
            {viewBadge && (
              <span className={`bento-badge bento-badge--${viewBadge.variant}`}>{viewBadge.label}</span>
            )}
          </div>

          <p className="event-detail-modal__view-description">{event.description}</p>

          <div className="event-detail-modal__view-details">
            <div className="event-detail-modal__view-row">
              <span className="event-detail-modal__view-label">Category</span>
              <span>{categoryLabel}</span>
            </div>
            {event.category === "group-session" && event.sessionYears && event.sessionYears.length > 0 && (
              <div className="event-detail-modal__view-row">
                <span className="event-detail-modal__view-label">Which years</span>
                <span>{formatSessionYears(event.sessionYears)}</span>
              </div>
            )}
            {event.category === "group-session" && event.organizerNames.length > 0 && (
              <div className="event-detail-modal__view-row">
                <span className="event-detail-modal__view-label">Organizers</span>
                <span>{event.organizerNames.join(", ")}</span>
              </div>
            )}
            {event.targetGroup && (
              <div className="event-detail-modal__view-row">
                <span className="event-detail-modal__view-label">Target group</span>
                <span>{event.targetGroup}</span>
              </div>
            )}
            {event.importantDay && (
              <div className="event-detail-modal__view-row">
                <span className="event-detail-modal__view-label">Important day</span>
                <span>{event.importantDay}</span>
              </div>
            )}
            <div className="event-detail-modal__view-row">
              <span className="event-detail-modal__view-label">Date &amp; time</span>
              <span>{new Date(event.eventDate).toLocaleString()}</span>
            </div>
          </div>

          {event.reschedule && (
            <p className="event-detail-modal__note">
              {event.reschedule.type === "postponed" ? "Postponed" : "Preponed"} from{" "}
              {new Date(event.reschedule.previousDate).toLocaleString()}
              {event.reschedule.note ? ` — ${event.reschedule.note}` : ""}
            </p>
          )}

          {event.phase === "not-conducted" && (
            <p className="event-detail-modal__note event-detail-modal__note--warning">
              Not conducted: {event.notConductedReason}
            </p>
          )}

          {event.reportUrl ? (
            <a href={event.reportUrl} target="_blank" rel="noreferrer" className="event-detail-modal__report-link">
              View report{event.reportFileName ? ` (${event.reportFileName})` : ""}
            </a>
          ) : (
            event.phase === "completed" && (
              <p className="event-detail-modal__static">Report not uploaded yet.</p>
            )
          )}
        </div>
      ) : (
        <form className="event-detail-modal__form" onSubmit={handleSave}>
          <div className="event-detail-modal__field">
            <label htmlFor="ed-title">Title</label>
            <input
              id="ed-title"
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="event-detail-modal__field">
            <label htmlFor="ed-description">Description</label>
            <textarea
              id="ed-description"
              rows={3}
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's this event or program about?"
            />
          </div>

          <div className="event-detail-modal__field">
            <label htmlFor="ed-category">Category</label>
            <Select id="ed-category" value={category} onChange={(v) => setCategory(v as EventCategory)}>
              {EVENT_CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </Select>
          </div>

          {category === "group-session" && (
            <>
              <div className="event-detail-modal__field">
                <label htmlFor="ed-session-years">Which years is this for?</label>
                <MultiSelect
                  id="ed-session-years"
                  options={SESSION_YEAR_OPTIONS}
                  selected={sessionYears}
                  onChange={setSessionYears}
                  placeholder="Select years…"
                />
              </div>

              <div className="event-detail-modal__field">
                <label htmlFor="ed-organizers">Organizers</label>
                <MultiSelect
                  id="ed-organizers"
                  options={organizers.map((o) => ({ value: o.uid, label: o.displayName || o.email }))}
                  selected={selectedOrganizerIds}
                  onChange={setSelectedOrganizerIds}
                  placeholder="Select organizers…"
                  emptyMessage="No team members on this campus"
                />
              </div>

              <div className="event-detail-modal__field">
                <label htmlFor="ed-target-group">Target group</label>
                <input
                  id="ed-target-group"
                  type="text"
                  value={targetGroup}
                  onChange={(e) => setTargetGroup(e.target.value)}
                  placeholder="e.g. 1st Year Students"
                />
              </div>

              <div className="event-detail-modal__field">
                <label htmlFor="ed-important-day">Important day / observance</label>
                <input
                  id="ed-important-day"
                  type="text"
                  value={importantDay}
                  onChange={(e) => setImportantDay(e.target.value)}
                  placeholder="e.g. World Mental Health Day"
                />
              </div>
            </>
          )}

          <div className="event-detail-modal__field">
            <label htmlFor="ed-date">Date &amp; time</label>
            <DateTimePicker
              id="ed-date"
              value={dateValue}
              onChange={setDateValue}
              min={dateBounds?.min}
              max={dateBounds?.max}
            />
          </div>

          {mode !== "create" && (
            <div className="event-detail-modal__field">
              <label htmlFor="ed-attendance">Attendees</label>
              <input
                id="ed-attendance"
                type="number"
                min={0}
                value={attendeeCount}
                onChange={(e) => setAttendeeCount(e.target.value)}
              />
            </div>
          )}

          {event?.reschedule && (
            <p className="event-detail-modal__note">
              {event.reschedule.type === "postponed" ? "Postponed" : "Preponed"} from{" "}
              {new Date(event.reschedule.previousDate).toLocaleString()}
              {event.reschedule.note ? ` — ${event.reschedule.note}` : ""}
            </p>
          )}

          {event?.phase === "not-conducted" && (
            <p className="event-detail-modal__note event-detail-modal__note--warning">
              Not conducted: {event.notConductedReason}
            </p>
          )}

          {event?.phase === "completed" && (
            <div className="event-detail-modal__field">
              <label>Report</label>
              {event.reportUrl ? (
                <a href={event.reportUrl} target="_blank" rel="noreferrer" className="event-detail-modal__report-link">
                  View report{event.reportFileName ? ` (${event.reportFileName})` : ""}
                </a>
              ) : (
                <p className="event-detail-modal__static">No report uploaded yet.</p>
              )}
            </div>
          )}

          {error && <p className="event-detail-modal__note event-detail-modal__note--warning">{error}</p>}

          <div className="event-detail-modal__actions">
            <Button
              type="submit"
              disabled={
                saving ||
                (category === "group-session" && (selectedOrganizerIds.length === 0 || !dateValue)) ||
                (mode === "create" && (!calendarYearId || !calendarMonthId))
              }
            >
              {saving ? "Saving…" : mode === "create" ? "Add event" : "Save changes"}
            </Button>
            {mode === "manage" && event && (
              <Button type="button" variant="outlined" disabled={deleting} onClick={handleDelete}>
                {deleting ? "Deleting…" : "Delete"}
              </Button>
            )}
          </div>
        </form>
      )}

      {mode === "manage" && event && (
        <div className="event-detail-modal__phase-actions">
          {event.phase === "scheduled" && (
            <>
              <div className="event-detail-modal__phase-buttons">
                <Button type="button" variant="outlined" onClick={() => setActionMode("complete")}>
                  Mark Completed
                </Button>
                <Button type="button" variant="outlined" onClick={() => setActionMode("not-conducted")}>
                  Mark Not Conducted
                </Button>
                <Button type="button" variant="outlined" onClick={() => setActionMode("postponed")}>
                  Postpone
                </Button>
                <Button type="button" variant="outlined" onClick={() => setActionMode("preponed")}>
                  Prepone
                </Button>
              </div>

              {actionMode === "complete" && (
                <div className="event-detail-modal__subpanel">
                  <label htmlFor="ed-report">Upload report (optional now, can add later)</label>
                  <input
                    id="ed-report"
                    type="file"
                    accept="application/pdf,image/*"
                    onChange={(e) => setReportFile(e.target.files?.[0] ?? null)}
                  />
                  <Button type="button" disabled={actionBusy} onClick={handleConfirmComplete}>
                    {actionBusy ? "Saving…" : "Confirm completion"}
                  </Button>
                </div>
              )}

              {actionMode === "not-conducted" && (
                <div className="event-detail-modal__subpanel">
                  <label htmlFor="ed-not-conducted-reason">Reason the event wasn't conducted</label>
                  <textarea
                    id="ed-not-conducted-reason"
                    rows={3}
                    required
                    value={notConductedReason}
                    onChange={(e) => setNotConductedReason(e.target.value)}
                  />
                  <Button
                    type="button"
                    disabled={actionBusy || !notConductedReason.trim()}
                    onClick={handleConfirmNotConducted}
                  >
                    {actionBusy ? "Saving…" : "Confirm"}
                  </Button>
                </div>
              )}

              {(actionMode === "postponed" || actionMode === "preponed") && (
                <div className="event-detail-modal__subpanel">
                  <label htmlFor="ed-reschedule-date">
                    New date &amp; time ({actionMode === "postponed" ? "postponed" : "preponed"})
                  </label>
                  <DateTimePicker id="ed-reschedule-date" value={rescheduleDateValue} onChange={setRescheduleDateValue} />
                  <label htmlFor="ed-reschedule-note">Note (optional)</label>
                  <textarea
                    id="ed-reschedule-note"
                    rows={2}
                    value={rescheduleNote}
                    onChange={(e) => setRescheduleNote(e.target.value)}
                  />
                  <Button
                    type="button"
                    disabled={actionBusy || !rescheduleDateValue}
                    onClick={() => handleConfirmReschedule(actionMode)}
                  >
                    {actionBusy ? "Saving…" : "Confirm"}
                  </Button>
                </div>
              )}
            </>
          )}

          {event.phase === "completed" && !event.reportUrl && (
            <div className="event-detail-modal__subpanel">
              <label htmlFor="ed-report-only">Upload report</label>
              <input
                id="ed-report-only"
                type="file"
                accept="application/pdf,image/*"
                onChange={(e) => setReportFile(e.target.files?.[0] ?? null)}
              />
              <Button type="button" disabled={actionBusy || !reportFile} onClick={handleUploadReportOnly}>
                {actionBusy ? "Uploading…" : "Upload report"}
              </Button>
            </div>
          )}

          {event.phase === "completed" && event.reportUrl && (
            <div className="event-detail-modal__subpanel">
              <label htmlFor="ed-report-replace">Replace report</label>
              <input
                id="ed-report-replace"
                type="file"
                accept="application/pdf,image/*"
                onChange={(e) => setReportFile(e.target.files?.[0] ?? null)}
              />
              <Button type="button" disabled={actionBusy || !reportFile} onClick={handleUploadReportOnly}>
                {actionBusy ? "Uploading…" : "Replace report"}
              </Button>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

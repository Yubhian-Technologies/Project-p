import { useEffect, useState } from "react";
import { listBookableProfiles, listScheduledBookings } from "../../services/firebase/bookings";
import {
  listAttendance,
  formatIstTime,
  formatIstDateLabel,
  formatDuration,
  isDateKeySunday,
  isMonthlyWindowOpen,
  manualMark,
} from "../../services/firebase/attendance";
import { isLeaveActiveOnDate, subscribeLeavesByApplicant } from "../../services/firebase/leaves";
import { toIsoDate } from "../../utils/dateFormat";
import { useAuth } from "../../hooks/useAuth";
import type { UserProfile } from "../../types/user";
import type { AttendanceRecord } from "../../types/attendance";
import type { Booking } from "../../types/booking";
import type { LeaveRequest } from "../../types/leave";
import { computeLiveStatus, liveStatusLabel } from "../../utils/counsellorStatus";
import { Card } from "../../components/common/Card";
import { Button } from "../../components/common/Button";
import { Modal } from "../../components/common/Modal";
import { AttendanceCheckCard } from "../../components/attendance/AttendanceCheckCard";
import { MyAttendanceLog } from "../../components/attendance/MyAttendanceLog";
import { ROLE_LABELS } from "../../config/roles";
import "./TeamAttendanceSection.css";

function formatDateLabel(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** Optional — set only when this is reached from somewhere that needs its
    own "back" affordance; omitted entirely when it's its own standalone tab
    (the Head dashboard's Attendance section). */
export function TeamAttendanceSection({ onBack }: { onBack?: () => void }) {
  const { currentUser, profile: headProfile } = useAuth();
  const [nowMs] = useState(() => Date.now());
  const [counsellors, setCounsellors] = useState<UserProfile[]>([]);
  const [scheduledBookings, setScheduledBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<UserProfile | null>(null);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState("");
  const [correction, setCorrection] = useState<{ day: string; part: "check-in" | "check-out" | "both" } | null>(null);
  const [correctionReason, setCorrectionReason] = useState("");
  const [correctionError, setCorrectionError] = useState("");
  const [savingCorrection, setSavingCorrection] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    Promise.all([listBookableProfiles(), listScheduledBookings()]).then(([profiles, live]) => {
      if (cancelled) return;
      setCounsellors(
        profiles.filter(
          (p) =>
            p.role === "counsellor" &&
            !!p.campusId &&
            p.campusId === headProfile?.campusId,
        ),
      );
      setScheduledBookings(live);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [headProfile?.campusId]);

  useEffect(() => {
    if (!selected) {
      setLeaves([]);
      return;
    }
    return subscribeLeavesByApplicant(selected.uid, setLeaves);
  }, [selected]);

  async function openCounsellor(counsellor: UserProfile) {
    setSelected(counsellor);
    setSelectedDate("");
    setRecordsLoading(true);
    setError("");
    try {
      setRecords(await listAttendance(counsellor.uid, counsellor.campusId ?? ""));
    } catch {
      setError("Couldn't load this counsellor's check-in / check-out log.");
      setRecords([]);
    } finally {
      setRecordsLoading(false);
    }
  }

  async function saveCorrection() {
    if (!correction || !selected || !currentUser || !headProfile) return;
    if (!correctionReason.trim()) {
      setCorrectionError("A reason is required — explain why you're marking this attendance manually.");
      return;
    }
    setSavingCorrection(true);
    setCorrectionError("");
    try {
      await manualMark({
        uid: selected.uid,
        campusId: selected.campusId ?? "",
        date: correction.day,
        part: correction.part,
        reason: correctionReason.trim(),
        markedByUid: currentUser.uid,
        markedByName: headProfile.displayName || headProfile.email,
      });
      setRecords(await listAttendance(selected.uid, selected.campusId ?? ""));
      setCorrection(null);
      setCorrectionReason("");
    } catch (err) {
      setCorrectionError(err instanceof Error ? err.message : "Couldn't save the correction.");
    } finally {
      setSavingCorrection(false);
    }
  }

  if (loading) return null;

  // ----- Level 1: counsellor names on this campus -----
  if (!selected) {
    return (
      <div className="team-attendance">
        <div className="team-attendance__header">
          <h3 className="team-attendance__heading">Check-in / Check-out</h3>
          {onBack && (
            <Button type="button" variant="outlined" onClick={onBack}>
              ← Back
            </Button>
          )}
        </div>
        <div className="bento-grid">
          <AttendanceCheckCard span={12} />
        </div>
        <MyAttendanceLog />

        <h3 className="team-attendance__heading">Your Team</h3>
        <p className="team-attendance__intro">
          Tap a counsellor's name, then pick a date to see their check-in / check-out for that
          day. You can mark a missed check-in or check-out as finished for them — a reason is
          required, and the mark is stored with the record for Admins to see.
        </p>
        {error && <p className="team-attendance__error">{error}</p>}
        {counsellors.length === 0 && <p>No counsellors on your campus yet.</p>}
        {counsellors.map((counsellor) => {
          const status = computeLiveStatus(counsellor, scheduledBookings);
          return (
            <Card
              key={counsellor.uid}
              className="team-attendance__row"
              onClick={() => openCounsellor(counsellor)}
            >
              <div>
                <p className="team-attendance__name">
                  {counsellor.displayName || counsellor.email}
                </p>
                <p className="team-attendance__role">{ROLE_LABELS[counsellor.role]}</p>
              </div>
              <div className="team-attendance__availability">
                <span className={`team-attendance__status team-attendance__status--${status}`}>
                  {liveStatusLabel(status)}
                </span>
                {counsellor.available === false && (
                  <span className="team-attendance__leave-tag">On Leave</span>
                )}
                <Button type="button">Attendance →</Button>
              </div>
            </Card>
          );
        })}
      </div>
    );
  }

  // ----- Level 2: on leave — the head sees Leave instead of times/hours -----
  if (selected.available === false) {
    return (
      <div className="team-attendance">
        <div className="team-attendance__header">
          <h3 className="team-attendance__heading">
            {selected.displayName || selected.email}
          </h3>
          <Button type="button" variant="outlined" onClick={() => setSelected(null)}>
            ← Back to counsellors
          </Button>
        </div>
        <div className="team-attendance__leave-panel">
          <p className="team-attendance__leave-title">On Leave</p>
          <p className="team-attendance__intro">
            {selected.displayName || selected.email} is currently on leave, so there are no
            check-in / check-out times or working hours to show.
          </p>
        </div>
      </div>
    );
  }

  // ----- Level 2: date-filtered check-in/check-out, nothing shown until a
  //       specific date is picked rather than dumping a whole month at once ----
  const recordsByDate = new Map(records.map((r) => [r.date, r]));
  const minDate = toIsoDate(new Date(selected.createdAt));
  const maxDate = toIsoDate(new Date(nowMs));
  const selectedRecord = selectedDate ? recordsByDate.get(selectedDate) : undefined;
  const monthOpen = selectedDate ? isMonthlyWindowOpen(selectedDate) : false;
  const selectedIsSunday = selectedDate ? isDateKeySunday(selectedDate) : false;
  const selectedLeave = selectedDate ? leaves.find((l) => isLeaveActiveOnDate(l, selectedDate)) : undefined;

  return (
    <div className="team-attendance">
      <div className="team-attendance__header">
        <h3 className="team-attendance__heading">{selected.displayName || selected.email}</h3>
        <Button type="button" variant="outlined" onClick={() => setSelected(null)}>
          ← Back to counsellors
        </Button>
      </div>
      <div className="team-attendance__date-field">
        <label htmlFor="team-attendance-date">Date</label>
        <input
          id="team-attendance-date"
          type="date"
          min={minDate}
          max={maxDate}
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
        />
      </div>
      {error && <p className="team-attendance__error">{error}</p>}
      {!selectedDate ? (
        <p className="team-attendance__intro">Pick a date above to see that day's check-in / check-out.</p>
      ) : recordsLoading ? (
        <p className="team-attendance__intro">Loading…</p>
      ) : (
        <>
          <p className="team-attendance__intro">
            {monthOpen
              ? "Editable up to the 25th of the month — mark a missed check-in or check-out as finished (a reason is required). After the 25th this month locks."
              : "This month is locked — it was only editable up to the 25th."}
          </p>
          <div className="team-attendance__table-wrap">
            <table className="team-attendance__table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Check In</th>
                  <th>Check Out</th>
                  <th>Hours</th>
                  <th>Status</th>
                  <th>Mark as finished</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const record = selectedRecord;
                  const checkIn = record?.checkInAt;
                  const checkOut = record?.checkOutAt;
                  const rowEditable = monthOpen;
                  const date = selectedDate;
                  return (
                    <tr>
                      <td>{formatIstDateLabel(date)}</td>
                      <td>
                        {checkIn != null ? formatIstTime(checkIn) : "—"}
                        {record?.checkInMethod === "manual" && (
                          <em> · marked by {record?.manualEntry?.markedByName}</em>
                        )}
                      </td>
                      <td>
                        {checkOut != null ? formatIstTime(checkOut) : "—"}
                        {record?.checkOutMethod === "manual" && (
                          <em> · marked by {record?.manualEntry?.markedByName}</em>
                        )}
                      </td>
                      <td>
                        {checkIn != null && checkOut != null
                          ? formatDuration(checkOut - checkIn)
                          : "—"}
                      </td>
                      <td>
                        {selectedIsSunday
                          ? "Sunday — not required"
                          : selectedLeave
                            ? "On leave"
                            : checkIn != null && checkOut != null
                              ? "Present ✓"
                              : checkIn != null
                                ? "Checked in, no check-out"
                                : "—"}
                      </td>
                      <td className="team-attendance__mark-cell">
                        {/* The Head retains the manual mark-as-finished override even on a
                            Sunday/leave day — e.g. someone genuinely came in for an emergency —
                            unlike the counsellor's own view, which has no such override at all. */}
                        {rowEditable && (checkIn == null || checkOut == null) && (
                          <span className="team-attendance__mark-actions">
                            {checkIn == null && (
                              <Button
                                type="button"
                                variant="outlined"
                                onClick={() => { setCorrection({ day: date, part: "check-in" }); setCorrectionReason(""); }}
                              >
                                Check-in
                              </Button>
                            )}
                            {checkOut == null && (
                              <Button
                                type="button"
                                variant="outlined"
                                onClick={() => { setCorrection({ day: date, part: "check-out" }); setCorrectionReason(""); }}
                              >
                                Check-out
                              </Button>
                            )}
                            {checkIn == null && checkOut == null && (
                              <Button
                                type="button"
                                variant="outlined"
                                onClick={() => { setCorrection({ day: date, part: "both" }); setCorrectionReason(""); }}
                              >
                                Both
                              </Button>
                            )}
                          </span>
                        )}
                        {record?.manualEntry && (
                          <em title={record.manualEntry.reason}>✎ {record.manualEntry.markedByName}</em>
                        )}
                      </td>
                    </tr>
                  );
                })()}
              </tbody>
            </table>
          </div>
        </>
      )}

      {correction && (
        <Modal
          title={`Mark ${correction.part} finished — ${correction.day}`}
          onClose={() => { setCorrection(null); setCorrectionReason(""); setCorrectionError(""); }}
        >
          <div className="team-attendance__correction">
            <p className="team-attendance__correction-date">
              {selected.displayName || selected.email} — {formatDateLabel(correction.day)}
            </p>
            <p className="team-attendance__correction-hint">
              You're marking {selected.displayName || selected.email}'s {correction.part} as
              finished for this day. Write the reason why — it is stored with the attendance
              record and visible to Admins.
            </p>
            <textarea
              value={correctionReason}
              rows={4}
              placeholder="Reason (required) — e.g. 'Reported in person, camera was unavailable at the block'"
              onChange={(e) => setCorrectionReason(e.target.value)}
            />
            {correctionError && <p className="team-attendance__error">{correctionError}</p>}
            <div className="team-attendance__correction-actions">
              <Button type="button" disabled={savingCorrection} onClick={saveCorrection}>
                {savingCorrection ? "Saving…" : "Save"}
              </Button>
              <Button
                type="button"
                variant="outlined"
                onClick={() => { setCorrection(null); setCorrectionReason(""); setCorrectionError(""); }}
              >
                Cancel
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

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
import { adminCanSeeStaff, allowedCampusIdsFor } from "../../utils/adminScope";
import type { UserProfile } from "../../types/user";
import type { AttendanceRecord } from "../../types/attendance";
import type { Booking } from "../../types/booking";
import type { LeaveRequest } from "../../types/leave";
import { computeLiveStatus, liveStatusLabel } from "../../utils/counsellorStatus";
import { Card } from "../common/Card";
import { Button } from "../common/Button";
import { Modal } from "../common/Modal";
import { DatePicker } from "../common/DatePicker";
import { AttendanceCheckCard } from "./AttendanceCheckCard";
import { MyAttendanceLog } from "./MyAttendanceLog";
import { CampusFilterSelect } from "./CampusFilterSelect";
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

/** Every "YYYY-MM-DD" day from start to end inclusive, built from the local
    date components (not by adding milliseconds) so it can't drift across a
    DST boundary. */
function dateKeysBetween(start: string, end: string): string[] {
  const [sy, sm, sd] = start.split("-").map(Number);
  const [ey, em, ed] = end.split("-").map(Number);
  const cursor = new Date(sy, sm - 1, sd);
  const last = new Date(ey, em - 1, ed);
  const keys: string[] = [];
  while (cursor.getTime() <= last.getTime()) {
    keys.push(
      `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`,
    );
    cursor.setDate(cursor.getDate() + 1);
  }
  return keys;
}

/** Optional — set only when this is reached from somewhere that needs its
    own "back" affordance; omitted entirely when it's its own standalone tab
    (the Head/Admin/Super Admin dashboards' Attendance section).

    Shared by Head, Admin, and Super Admin — each sees the self check-in
    card only when they're a Head (counsellors/heads camera-check-in;
    Admins don't), and the managed staff list is scoped per the dashboard's
    existing hierarchy: a Head to their own campus's counsellors, an Admin
    to counsellors AND heads within their adminAccess scope (whole campus
    for Management/global, their assigned college(s) for Principal/VP/
    Administration — see adminCanSeeStaff). */
export function TeamAttendanceSection({ onBack }: { onBack?: () => void }) {
  const { currentUser, profile } = useAuth();
  const isHeadViewer = profile?.role === "head";
  const isAdminViewer = profile?.role === "admin" || profile?.role === "super-admin";
  const [nowMs] = useState(() => Date.now());
  const [counsellors, setCounsellors] = useState<UserProfile[]>([]);
  const [scheduledBookings, setScheduledBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<UserProfile | null>(null);
  const [campusFilter, setCampusFilter] = useState("");
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");
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
            !!p.campusId &&
            (isHeadViewer
              ? p.role === "counsellor" && p.campusId === profile?.campusId
              : (p.role === "counsellor" || p.role === "head") &&
                !!profile &&
                isAdminViewer &&
                adminCanSeeStaff(profile, p)),
        ),
      );
      setScheduledBookings(live);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [profile, isHeadViewer, isAdminViewer]);

  useEffect(() => {
    if (!selected) {
      setLeaves([]);
      return;
    }
    return subscribeLeavesByApplicant(selected.uid, setLeaves);
  }, [selected]);

  async function openCounsellor(counsellor: UserProfile) {
    setSelected(counsellor);
    setRangeStart("");
    setRangeEnd("");
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
    if (!correction || !selected || !currentUser || !profile) return;
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
        markedByName: profile.displayName || profile.email,
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
        {isHeadViewer && (
          <>
            <div className="bento-grid">
              <AttendanceCheckCard span={12} />
            </div>
            <MyAttendanceLog />
          </>
        )}

        <h3 className="team-attendance__heading">{isHeadViewer ? "Your Team" : "Counsellors & Heads"}</h3>
        <p className="team-attendance__intro">
          Tap a name, then pick a date to see their check-in / check-out for that day. You can
          mark a missed check-in or check-out as finished for them — a reason is required, and
          the mark is stored with the record.
        </p>
        {isAdminViewer && profile && (
          <CampusFilterSelect
            value={campusFilter}
            onChange={setCampusFilter}
            allowedCampusIds={allowedCampusIdsFor(profile)}
          />
        )}
        {error && <p className="team-attendance__error">{error}</p>}
        {counsellors.length === 0 && <p>No counsellors or heads in your scope yet.</p>}
        {counsellors
          .filter((p) => !campusFilter || p.campusId === campusFilter)
          .map((counsellor) => {
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

  // ----- Level 2: date-RANGE-filtered check-in/check-out, nothing shown
  //       until a range is picked, one row per day in that range ----
  const recordsByDate = new Map(records.map((r) => [r.date, r]));
  const minDate = toIsoDate(new Date(selected.createdAt));
  const maxDate = toIsoDate(new Date(nowMs));
  const rangeDays = rangeStart && rangeEnd ? dateKeysBetween(rangeStart, rangeEnd) : [];

  return (
    <div className="team-attendance">
      <div className="team-attendance__header">
        <h3 className="team-attendance__heading">{selected.displayName || selected.email}</h3>
        <Button type="button" variant="outlined" onClick={() => setSelected(null)}>
          ← Back to counsellors
        </Button>
      </div>
      <div className="team-attendance__range-fields">
        {/* Both fields always show the full [account creation, today] range —
            narrowing one field's bounds to the other's current pick (e.g.
            capping "From" at whatever "To" already was) could trap the
            calendar down to a 1-2 day window depending on pick order. A
            swap on an inverted pick keeps the range valid instead. */}
        <div className="team-attendance__date-field">
          <label htmlFor="team-attendance-from">From</label>
          <DatePicker
            id="team-attendance-from"
            value={rangeStart}
            min={minDate}
            max={maxDate}
            placeholder="Start date…"
            onChange={(v) => {
              setRangeStart(v);
              if (rangeEnd && v > rangeEnd) setRangeEnd(v);
            }}
          />
        </div>
        <div className="team-attendance__date-field">
          <label htmlFor="team-attendance-to">To</label>
          <DatePicker
            id="team-attendance-to"
            value={rangeEnd}
            min={minDate}
            max={maxDate}
            placeholder="End date…"
            onChange={(v) => {
              setRangeEnd(v);
              if (rangeStart && v < rangeStart) setRangeStart(v);
            }}
          />
        </div>
        {(rangeStart || rangeEnd) && (
          <Button
            type="button"
            variant="outlined"
            onClick={() => {
              setRangeStart("");
              setRangeEnd("");
            }}
          >
            Clear
          </Button>
        )}
      </div>
      {error && <p className="team-attendance__error">{error}</p>}
      {rangeDays.length === 0 ? (
        <p className="team-attendance__intro">Pick a date range above to see those days' check-in / check-out.</p>
      ) : recordsLoading ? (
        <p className="team-attendance__intro">Loading…</p>
      ) : (
        <>
          <p className="team-attendance__intro">
            Each day is editable up to the 25th of its own month — mark a missed check-in or
            check-out as finished (a reason is required). After the 25th that month locks.
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
                {rangeDays.map((date) => {
                  const record = recordsByDate.get(date);
                  const checkIn = record?.checkInAt;
                  const checkOut = record?.checkOutAt;
                  const rowEditable = isMonthlyWindowOpen(date);
                  const isSunday = isDateKeySunday(date);
                  const onLeave = leaves.find((l) => isLeaveActiveOnDate(l, date));
                  return (
                    <tr key={date}>
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
                        {isSunday
                          ? "Sunday — not required"
                          : onLeave
                            ? "On leave"
                            : checkIn != null && checkOut != null
                              ? "Present ✓"
                              : checkIn != null
                                ? "Checked in, no check-out"
                                : "—"}
                      </td>
                      <td className="team-attendance__mark-cell">
                        {/* The Head/Admin retains the manual mark-as-finished override even on a
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
                })}
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

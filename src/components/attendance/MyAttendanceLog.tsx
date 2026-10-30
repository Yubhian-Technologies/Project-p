import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import {
  listAttendance,
  formatIstTime,
  formatIstDateLabel,
  formatDuration,
  isDateKeySunday,
} from "../../services/firebase/attendance";
import { isLeaveActiveOnDate, subscribeLeavesByApplicant } from "../../services/firebase/leaves";
import { toIsoDate } from "../../utils/dateFormat";
import type { AttendanceRecord } from "../../types/attendance";
import type { LeaveRequest } from "../../types/leave";
import "./MyAttendanceLog.css";

/** The signed-in person's own date-filtered check-in/check-out log — nothing
    shown until a specific date is picked, with Sunday/leave awareness in the
    Status column. Shared by the Counsellor's own Attendance page and the
    Head's own personal log on the Check-in / Check-out tab — a Head needs
    to see their own history exactly the way a counsellor does, not just
    today's live status. */
export function MyAttendanceLog() {
  const { currentUser, profile } = useAuth();
  const uid = currentUser?.uid;
  const campusId = profile?.campusId;
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [nowMs] = useState(() => Date.now());
  const [selectedDate, setSelectedDate] = useState("");

  useEffect(() => {
    if (!uid || !campusId) return;
    listAttendance(uid, campusId)
      .then((r) => {
        setRecords(r);
        setLoading(false);
      })
      .catch(() => {
        setError("Couldn't load your attendance log.");
        setLoading(false);
      });
  }, [uid, campusId]);

  useEffect(() => {
    if (!uid) return;
    return subscribeLeavesByApplicant(uid, setLeaves);
  }, [uid]);

  const recordsByDate = useMemo(() => new Map(records.map((r) => [r.date, r])), [records]);

  const todayKey = toIsoDate(new Date(nowMs));
  const minDate = profile ? toIsoDate(new Date(profile.createdAt)) : undefined;
  const selectedRecord = selectedDate ? recordsByDate.get(selectedDate) : undefined;
  const selectedIsSunday = selectedDate ? isDateKeySunday(selectedDate) : false;
  const selectedLeave = selectedDate ? leaves.find((l) => isLeaveActiveOnDate(l, selectedDate)) : undefined;

  return (
    <div className="my-attendance-log">
      <div className="my-attendance-log__head">
        <h3 className="my-attendance-log__heading">My check-in / check-out log</h3>
        <div className="my-attendance-log__date-field">
          <label htmlFor="my-attendance-log-date">Date</label>
          <input
            id="my-attendance-log-date"
            type="date"
            min={minDate}
            max={todayKey}
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          />
        </div>
      </div>

      {error && <p className="my-attendance-log__error">{error}</p>}

      {!selectedDate ? (
        <p className="my-attendance-log__hint">Pick a date above to see that day's check-in / check-out.</p>
      ) : loading ? (
        <p className="my-attendance-log__hint">Loading…</p>
      ) : (
        <div className="my-attendance-log__table-wrap">
          <table className="my-attendance-log__table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Check In</th>
                <th>Check Out</th>
                <th>Hours</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const checkIn = selectedRecord?.checkInAt;
                const checkOut = selectedRecord?.checkOutAt;
                return (
                  <tr>
                    <td>
                      {formatIstDateLabel(selectedDate)}
                      {selectedDate === todayKey && <em> (today)</em>}
                    </td>
                    <td>{checkIn != null ? formatIstTime(checkIn) : "—"}</td>
                    <td>{checkOut != null ? formatIstTime(checkOut) : "—"}</td>
                    <td>
                      {checkIn != null && checkOut != null ? formatDuration(checkOut - checkIn) : "—"}
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
                  </tr>
                );
              })()}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

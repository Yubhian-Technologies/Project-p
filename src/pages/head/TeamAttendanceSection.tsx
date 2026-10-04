import { useEffect, useState } from "react";
import { listBookableProfiles, listScheduledBookings } from "../../services/firebase/bookings";
import {
  listAttendance,
  istDateKey,
  formatIstTime,
  formatIstDateLabel,
  formatDuration,
} from "../../services/firebase/attendance";
import { useAuth } from "../../hooks/useAuth";
import type { UserProfile } from "../../types/user";
import type { AttendanceRecord } from "../../types/attendance";
import type { Booking } from "../../types/booking";
import { computeLiveStatus, liveStatusLabel } from "../../utils/counsellorStatus";
import { Card } from "../../components/common/Card";
import { Button } from "../../components/common/Button";
import { ROLE_LABELS } from "../../config/roles";
import "./TeamAttendanceSection.css";

/** Every IST day key from `fromMs` through `toMs`, newest first. */
function everyDayKeys(fromMs: number, toMs: number): string[] {
  const keys: string[] = [];
  let key = istDateKey(fromMs);
  const end = istDateKey(toMs);
  let guard = 0;
  while (key <= end && guard < 3700) {
    keys.push(key);
    const [year, month, day] = key.split("-").map(Number);
    key = new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
    guard += 1;
  }
  return keys.reverse();
}

export function TeamAttendanceSection({ onBack }: { onBack: () => void }) {
  const { profile: headProfile } = useAuth();
  // eslint-disable-next-line react/purity
  const now = Date.now();
  const [counsellors, setCounsellors] = useState<UserProfile[]>([]);
  const [scheduledBookings, setScheduledBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<UserProfile | null>(null);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(false);
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

  async function openCounsellor(counsellor: UserProfile) {
    setSelected(counsellor);
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

  if (loading) return null;

  // ----- Level 1: counsellor names on this campus -----
  if (!selected) {
    return (
      <div className="team-attendance">
        <div className="team-attendance__header">
          <h3 className="team-attendance__heading">Check-in / Check-out</h3>
          <Button type="button" variant="outlined" onClick={onBack}>
            ← Back to team management
          </Button>
        </div>
        <p className="team-attendance__intro">
          Tap a counsellor's name to see their daily check-in / check-out times and working
          hours, for every day from when their profile was created.
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
                <Button type="button">View log →</Button>
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

  // ----- Level 2: daily log, every day from profile creation -----
  const recordsByDate = new Map(records.map((r) => [r.date, r]));
  const days = everyDayKeys(selected.createdAt, now);

  return (
    <div className="team-attendance">
      <div className="team-attendance__header">
        <h3 className="team-attendance__heading">{selected.displayName || selected.email}</h3>
        <Button type="button" variant="outlined" onClick={() => setSelected(null)}>
          ← Back to counsellors
        </Button>
      </div>
      {error && <p className="team-attendance__error">{error}</p>}
      {recordsLoading ? (
        <p className="team-attendance__intro">Loading…</p>
      ) : (
        <div className="team-attendance__table-wrap">
          <table className="team-attendance__table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Check In</th>
                <th>Check Out</th>
                <th>Hours</th>
              </tr>
            </thead>
            <tbody>
              {days.map((date) => {
                const record = recordsByDate.get(date);
                const checkIn = record?.checkInAt;
                const checkOut = record?.checkOutAt;
                return (
                  <tr key={date}>
                    <td>{formatIstDateLabel(date)}</td>
                    <td>{checkIn != null ? formatIstTime(checkIn) : "—"}</td>
                    <td>{checkOut != null ? formatIstTime(checkOut) : "—"}</td>
                    <td>
                      {checkIn != null && checkOut != null
                        ? formatDuration(checkOut - checkIn)
                        : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

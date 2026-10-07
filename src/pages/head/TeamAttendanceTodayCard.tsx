import { useEffect, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { listBookableProfiles } from "../../services/firebase/bookings";
import {
  listAttendanceForCampusOnDate,
  istDateKey,
  formatIstTime,
  formatDuration,
} from "../../services/firebase/attendance";
import type { UserProfile } from "../../types/user";
import type { AttendanceRecord } from "../../types/attendance";
import "./TeamAttendanceTodayCard.css";

interface TeamAttendanceTodayCardProps {
  onViewAll: () => void;
}

/** At-a-glance check-in/check-out status for every counsellor on the Head's
    campus, today — the full historical log lives in TeamAttendanceSection,
    reached via "View Full Log". */
export function TeamAttendanceTodayCard({ onViewAll }: TeamAttendanceTodayCardProps) {
  const { profile } = useAuth();
  const campusId = profile?.campusId;
  const [counsellors, setCounsellors] = useState<UserProfile[]>([]);
  const [records, setRecords] = useState<Map<string, AttendanceRecord>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!campusId) {
      // eslint-disable-next-line react/set-state-in-effect -- no campus to fetch for, show the empty state instead of spinning forever
      setLoading(false);
      return;
    }
    let cancelled = false;
    const dateKey = istDateKey(Date.now());
    Promise.all([listBookableProfiles(), listAttendanceForCampusOnDate(campusId, dateKey)]).then(
      ([profiles, attendance]) => {
        if (cancelled) return;
        setCounsellors(profiles.filter((p) => p.role === "counsellor" && p.campusId === campusId));
        setRecords(new Map(attendance.map((r) => [r.uid, r])));
        setLoading(false);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [campusId]);

  if (loading) return null;

  return (
    <section className="hch-section">
      <div className="hch-section__head">
        <h3 className="hch-section__title">Today&apos;s Attendance</h3>
        <button type="button" className="hch-btn hch-btn--ghost" onClick={onViewAll}>
          View Full Log →
        </button>
      </div>

      {counsellors.length === 0 ? (
        <p className="hch-muted">No counsellors on your campus yet.</p>
      ) : (
        <div className="tact-list">
          {counsellors.map((counsellor) => {
            const record = records.get(counsellor.uid);
            const checkedIn = record?.checkInAt != null;
            const checkedOut = record?.checkOutAt != null;
            const onLeave = counsellor.available === false;

            return (
              <div key={counsellor.uid} className="tact-row">
                <div className="tact-row__who">
                  <p className="tact-row__name">{counsellor.displayName || counsellor.email}</p>
                  {onLeave ? (
                    <span className="tact-tag tact-tag--leave">On Leave</span>
                  ) : checkedIn && checkedOut ? (
                    <span className="tact-tag tact-tag--done">Checked out</span>
                  ) : checkedIn ? (
                    <span className="tact-tag tact-tag--in">Checked in</span>
                  ) : (
                    <span className="tact-tag tact-tag--out">Not checked in</span>
                  )}
                </div>
                {!onLeave && checkedIn && (
                  <div className="tact-row__times">
                    <span>In {formatIstTime(record!.checkInAt!)}</span>
                    {checkedOut && <span>Out {formatIstTime(record!.checkOutAt!)}</span>}
                    {checkedOut && <span className="tact-row__hours">{formatDuration(record!.checkOutAt! - record!.checkInAt!)}</span>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

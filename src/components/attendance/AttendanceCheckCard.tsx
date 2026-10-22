import { useEffect, useState } from "react";
import { BentoCard } from "../common/BentoCard";
import { Button } from "../common/Button";
import { useAuth } from "../../hooks/useAuth";
import {
  checkIn,
  checkOut,
  formatDuration,
  formatIstDateLabel,
  formatIstTime,
  getAttendanceRecord,
  istDateKey,
} from "../../services/firebase/attendance";
import { subscribeActiveLeavesToday, formatLeaveRange } from "../../services/firebase/leaves";
import type { AttendanceRecord } from "../../types/attendance";
import type { LeaveRequest } from "../../types/leave";
import "./AttendanceCheckCard.css";

interface AttendanceCheckCardProps {
  span?: 3 | 4 | 6 | 8 | 12;
}

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

/** Today's check-in / check-out for counsellors and heads. Shared by both
    home screens; the same records are shown on the profile page. */
export function AttendanceCheckCard({ span = 4 }: AttendanceCheckCardProps) {
  const { currentUser, profile } = useAuth();
  const uid = currentUser?.uid;
  const campusId = profile?.campusId;
  const eligible = profile?.role === "counsellor" || profile?.role === "head";
  const [activeLeave, setActiveLeave] = useState<LeaveRequest | null>(null);
  const isManuallyUnavailable = profile?.available === false;
  const onLeave = isManuallyUnavailable || Boolean(activeLeave);

  const [dateKey] = useState(() => istDateKey(Date.now()));
  const [record, setRecord] = useState<AttendanceRecord | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Subscribe to real-time active approved leaves today
  useEffect(() => {
    if (!uid || !eligible) return;
    const unsub = subscribeActiveLeavesToday((map) => {
      setActiveLeave(map[uid] || null);
    });
    return () => unsub();
  }, [uid, eligible]);

  useEffect(() => {
    if (!uid || !eligible || onLeave) return;
    let active = true;
    getAttendanceRecord(uid, dateKey)
      .then((r) => {
        if (active) setRecord(r);
      })
      .catch(() => {
        if (active) setError("Couldn't load today's attendance.");
      });
    return () => {
      active = false;
    };
  }, [uid, eligible, onLeave, dateKey]);

  if (!eligible) return null;

  async function handleCheckIn() {
    if (!uid || !campusId || onLeave) return;
    setBusy(true);
    setError(null);
    try {
      await checkIn(uid, campusId, dateKey);
      setRecord(await getAttendanceRecord(uid, dateKey));
    } catch (err) {
      setError(errorMessage(err, "Check-in failed. Please try again."));
    } finally {
      setBusy(false);
    }
  }

  async function handleCheckOut() {
    if (!uid || onLeave) return;
    setBusy(true);
    setError(null);
    try {
      await checkOut(uid, dateKey);
      setRecord(await getAttendanceRecord(uid, dateKey));
    } catch (err) {
      setError(errorMessage(err, "Check-out failed. Please try again."));
    } finally {
      setBusy(false);
    }
  }

  const checkedIn = record?.checkInAt != null;
  const checkedOut = record?.checkOutAt != null;

  return (
    <BentoCard
      span={span}
      title="Attendance"
      subtitle={formatIstDateLabel(dateKey)}
      className="attn-card"
    >
      {onLeave ? (
        <div className="attn-leave-box">
          <span className="attn-leave-badge">On Leave</span>
          <p className="attn-leave-text">
            {activeLeave
              ? `You have an approved ${activeLeave.type.toUpperCase()} leave active today (${formatLeaveRange(activeLeave)}). Attendance check-in and check-out are disabled.`
              : "You're marked unavailable today, so attendance check-in and check-out are turned off."}
          </p>
        </div>
      ) : (
        <div className="attn">
          <p className="attn-status">
            {checkedIn && checkedOut
              ? `Checked in ${formatIstTime(record!.checkInAt!)} · out ${formatIstTime(record!.checkOutAt!)}`
              : checkedIn
                ? `Checked in at ${formatIstTime(record!.checkInAt!)}`
                : "Not checked in yet"}
          </p>
          {checkedIn && checkedOut && (
            <p className="attn-muted">Worked {formatDuration(record!.checkOutAt! - record!.checkInAt!)}</p>
          )}
          <div className="attn-actions">
            {!checkedIn && (
              <Button type="button" disabled={busy || !campusId || onLeave} onClick={handleCheckIn}>
                {busy ? "Saving…" : "Check In"}
              </Button>
            )}
            {checkedIn && !checkedOut && (
              <Button type="button" disabled={busy || onLeave} onClick={handleCheckOut}>
                {busy ? "Saving…" : "Check Out"}
              </Button>
            )}
          </div>
          {error && <p className="attn-error">{error}</p>}
        </div>
      )}
    </BentoCard>
  );
}

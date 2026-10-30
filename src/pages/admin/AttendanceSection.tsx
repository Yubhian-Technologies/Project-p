import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import {
  getAttendanceRecord,
  formatIstDateLabel,
  isMonthlyWindowOpen,
  manualMark,
} from "../../services/firebase/attendance";
import { listBookableProfiles } from "../../services/firebase/bookings";
import { subscribeActiveLeavesToday } from "../../services/firebase/leaves";
import type { AttendanceRecord } from "../../types/attendance";
import type { UserProfile } from "../../types/user";
import { Card } from "../../components/common/Card";
import { Button } from "../../components/common/Button";
import { Modal } from "../../components/common/Modal";
import "./AttendanceSection.css";

type DayStatus = "present" | "missing-check-out" | "absent" | "on-leave" | "none";

function statusOf(record: AttendanceRecord | undefined, onLeave: boolean): DayStatus {
  if (onLeave) return "on-leave";
  if (!record) return "none";
  if (record.checkInAt != null && record.checkOutAt != null) return "present";
  if (record.checkInAt != null) return "missing-check-out";
  return "none";
}

const STATUS_LABELS: Record<DayStatus, string> = {
  present: "Present",
  "missing-check-out": "Checked in, no check-out",
  absent: "Absent",
  "on-leave": "On Leave",
  none: "—",
};

/**
 * Counsellor & Head attendance overview for Admins. Scope follows the same
 * rules as the rest of the dashboard: Principal / Vice-Principal /
 * Administration see only their assigned colleges; Management (and legacy
 * global admins) see every campus they manage.
 */
export function AttendanceSection() {
  const { profile } = useAuth();
  const [people, setPeople] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [leaveMap, setLeaveMap] = useState<Record<string, boolean>>({});
  const [monthOffset, setMonthOffset] = useState(0); // 0 = current month
  const [detail, setDetail] = useState<{ person: UserProfile; day: string } | null>(null);
  const [detailRecord, setDetailRecord] = useState<AttendanceRecord | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Which campuses/colleges this admin may see.
  const access = profile?.adminAccess;
  const isGlobal = !access || access.scope === "global";
  const scopedCampusIds = useMemo(() => new Set(access?.campusIds ?? []), [access]);
  const scopedCollegeIds = useMemo(() => new Set(access?.collegeIds ?? []), [access]);
  // Management and legacy global admins see whole campuses; Principal/VP and
  // Administration are narrowed to their colleges when collegeIds are set.
  const isCollegeScoped =
    (access?.designation === "principal" || access?.designation === "vice-principal" || access?.designation === "administration") &&
    scopedCollegeIds.size > 0;

  useEffect(() => {
    listBookableProfiles().then((profiles) => {
      const staff = profiles.filter(
        (p) =>
          (p.role === "counsellor" || p.role === "head") &&
          p.campusId &&
          (isGlobal || scopedCampusIds.has(p.campusId)) &&
          (!isCollegeScoped || !p.collegeId || scopedCollegeIds.has(p.collegeId)),
      );
      setPeople(staff);
      setLoading(false);
    });
  }, [isGlobal, scopedCampusIds, isCollegeScoped, scopedCollegeIds]);

  useEffect(
    () =>
      subscribeActiveLeavesToday((map) => {
        setLeaveMap(Object.fromEntries(Object.keys(map).map((uid) => [uid, true])));
      }),
    [],
  );

  const { monthLabel, dayKeys } = useMemo(() => {
    const now = new Date();
    const base = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
    const label = base.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
    const daysInMonth = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
    const keys: string[] = [];
    for (let d = 1; d <= daysInMonth; d += 1) {
      keys.push(
        `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
      );
    }
    return { monthLabel: label, dayKeys: keys };
  }, [monthOffset]);

  const [records, setRecords] = useState<Record<string, AttendanceRecord | null>>({});
  const [recordsLoading, setRecordsLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setRecordsLoading(true);
    // Attendance doc ids are uid_date, so we can read each staff member's
    // month directly without a campus-wide query.
    Promise.all(
      people.flatMap((p) =>
        dayKeys.map((day) =>
          getAttendanceRecord(p.uid, day).then((r) => [`${p.uid}_${day}`, r] as const),
        ),
      ),
    )
      .then((entries) => {
        if (cancelled) return;
        setRecords(Object.fromEntries(entries));
        setRecordsLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setError("Couldn't load attendance records.");
          setRecordsLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [people, dayKeys]);

  async function saveManualMark(part: "check-in" | "check-out" | "both") {
    if (!detail || !profile || !reason.trim()) {
      setError("A reason is required to mark attendance manually.");
      return;
    }
    setBusy(true);
    try {
      await manualMark({
        uid: detail.person.uid,
        campusId: detail.person.campusId ?? "",
        date: detail.day,
        part,
        reason: reason.trim(),
        markedByUid: profile.uid,
        markedByName: profile.displayName || profile.email,
      });
      const fresh = await getAttendanceRecord(detail.person.uid, detail.day);
      setDetailRecord(fresh);
      setRecords((prev) => ({
        ...prev,
        [`${detail.person.uid}_${detail.day}`]: fresh,
      }));
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return null;

  const windowOpen = isMonthlyWindowOpen(dayKeys[0]);

  return (
    <div className="admin-attendance">
      <div className="admin-attendance__header">
        <div>
          <h3 className="admin-attendance__heading">Counsellor & Head Attendance</h3>
          <p className="admin-attendance__intro">
            {monthLabel} — {isCollegeScoped ? "your assigned colleges" : "all campuses you manage"}.
            {!windowOpen && " This month is locked (editable only up to the 25th)."}
          </p>
        </div>
        <div className="admin-attendance__nav">
          <Button type="button" variant="outlined" onClick={() => setMonthOffset((m) => m - 1)}>
            ← Previous
          </Button>
          {monthOffset < 0 && (
            <Button type="button" variant="outlined" onClick={() => setMonthOffset(0)}>
              Current Month
            </Button>
          )}
        </div>
      </div>

      {error && <p className="admin-attendance__error">{error}</p>}
      {recordsLoading && <p>Loading attendance…</p>}

      {people.map((person) => {
        const counts = { present: 0, "missing-check-out": 0, absent: 0, "on-leave": 0 };
        dayKeys.forEach((day) => {
          const st = statusOf(records[`${person.uid}_${day}`] ?? undefined, !!leaveMap[person.uid]);
          if (st !== "none") counts[st] += 1;
        });
        return (
          <Card
            key={person.uid}
            className="admin-attendance__row"
            onClick={() => {
              const firstIncomplete = dayKeys.find(
                (day) => statusOf(records[`${person.uid}_${day}`] ?? undefined, !!leaveMap[person.uid]) !== "present",
              );
              if (firstIncomplete) {
                setDetail({ person, day: firstIncomplete });
                getAttendanceRecord(person.uid, firstIncomplete).then(setDetailRecord);
                setReason("");
                setError("");
              }
            }}
          >
            <div>
              <p className="admin-attendance__name">{person.displayName || person.email}</p>
              <p className="admin-attendance__meta">
                {person.role === "head" ? "Head" : "Counsellor"} · {monthLabel}
              </p>
            </div>
            <div className="admin-attendance__stats">
              <span className="admin-attendance__pill admin-attendance__pill--present">
                {counts.present} present
              </span>
              {counts["missing-check-out"] > 0 && (
                <span className="admin-attendance__pill admin-attendance__pill--missing">
                  {counts["missing-check-out"]} no check-out
                </span>
              )}
              {counts["on-leave"] > 0 && (
                <span className="admin-attendance__pill admin-attendance__pill--leave">
                  {counts["on-leave"]} leave
                </span>
              )}
            </div>
            <Button
              type="button"
              variant="outlined"
              onClick={(e) => {
                e.stopPropagation();
                setDetail({ person, day: dayKeys[dayKeys.length - 1] });
                getAttendanceRecord(person.uid, dayKeys[dayKeys.length - 1]).then(setDetailRecord);
                setReason("");
                setError("");
              }}
            >
              Open day
            </Button>
          </Card>
        );
      })}

      {detail && (
        <Modal title={`${detail.person.displayName || detail.person.email} — ${formatIstDateLabel(detail.day)}`} onClose={() => setDetail(null)}>
          <div className="admin-attendance__detail">
            <p>
              Status: <strong>{STATUS_LABELS[statusOf(detailRecord ?? undefined, !!leaveMap[detail.person.uid])]}</strong>
            </p>
            {detailRecord?.manualEntry && (
              <p className="admin-attendance__manual-note">
                Manually marked by {detailRecord.manualEntry.markedByName}: "
                {detailRecord.manualEntry.reason}"
              </p>
            )}
            {windowOpen && (
              <>
                <label>
                  Reason (required)
                  <textarea
                    value={reason}
                    rows={3}
                    placeholder="Why are you marking this attendance manually?"
                    onChange={(e) => setReason(e.target.value)}
                  />
                </label>
                <div className="admin-attendance__detail-actions">
                  <Button type="button" disabled={busy} onClick={() => saveManualMark("check-in")}>
                    Mark Check-in
                  </Button>
                  <Button type="button" disabled={busy} onClick={() => saveManualMark("check-out")}>
                    Mark Check-out
                  </Button>
                  <Button type="button" disabled={busy} onClick={() => saveManualMark("both")}>
                    Mark Both
                  </Button>
                </div>
              </>
            )}
            {error && <p className="admin-attendance__error">{error}</p>}
          </div>
        </Modal>
      )}
    </div>
  );
}

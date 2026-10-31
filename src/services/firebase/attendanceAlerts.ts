import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "./config";
import {
  getAttendanceRecord,
  isIstSunday,
  istDateKey,
} from "./attendance";
import { listBookableProfiles } from "./bookings";
import { createNotificationWithId } from "./notifications";

/** The Firestore document ID for a missing-attendance alert — deterministic
    per (alert type, head, person, missing part, day). Two concurrent runs of
    the dashboard check both writing this same ID merge into one document,
    which is what actually guarantees "once per person per day" even when
    the effect re-runs before the earlier run's lookup could see its write. */
function alertDocId(type: string, headUid: string, message: string): string {
  return `${type}_${headUid}_${message.slice(0, 80)}`
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .slice(0, 1400); // Firestore doc-ID limit is 1500 bytes.
}

/**
 * Notifies the campus Head about counsellors who, today, haven't checked in
 * or checked out — skipping anyone who is on an approved leave today (they
 * are not expected to check in/out).
 *
 * Called when the Head's dashboard loads; once per person per missing part
 * per day, enforced by the deterministic document ID each alert is written
 * under (see alertDocId) — re-running this, even concurrently, merges into
 * the same notification document instead of creating a duplicate.
 */
export async function notifyHeadOfMissingAttendance(headUid: string, campusId: string): Promise<void> {
  try {
    // Nobody is expected to check in/out on a Sunday — flagging the whole
    // campus as "missing check-in" every Sunday would just be noise.
    if (isIstSunday(Date.now())) return;
    const today = istDateKey(Date.now());
    const profiles = await listBookableProfiles();
    const staff = profiles.filter(
      (p) =>
        (p.role === "counsellor" || p.role === "head") &&
        p.campusId === campusId &&
        p.uid !== headUid,
    );
    if (staff.length === 0) return;

    // Approved leaves covering today, per applicant — these people are
    // excused from check-in/check-out entirely.
    const leavesSnapshot = await getDocs(
      query(collection(db, "leaves"), where("status", "==", "approved")),
    );
    const onLeaveUids = new Set(
      leavesSnapshot.docs
        .map((d) => d.data())
        .filter(
          (l) =>
            typeof l.applicantUid === "string" &&
            today >= l.startDate &&
            today <= l.endDate,
        )
        .map((l) => l.applicantUid as string),
    );

    for (const person of staff) {
      if (onLeaveUids.has(person.uid) || person.available === false) continue;
      const record = await getAttendanceRecord(person.uid, today);
      const name = person.displayName || person.email;

      if (record?.checkInAt == null) {
        const message = `${name} has not checked in today (${today}).`;
        // Deterministic doc ID: the day is inside the message, so a second
        // (even concurrent) trigger writes the same document, not a copy.
        await createNotificationWithId(alertDocId("attendance_missed_check_in", headUid, message), {
          recipientId: headUid,
          type: "attendance_missed_check_in",
          title: "Missing check-in",
          message,
        });
      } else if (record.checkOutAt == null) {
        // Only remind about a missing check-out late in the day, so people
        // still working aren't flagged in the morning.
        const nowHour = new Date().getHours();
        if (nowHour >= 18) {
          const message = `${name} checked in today but has not checked out yet (${today}).`;
          await createNotificationWithId(alertDocId("attendance_missing_check_out", headUid, message), {
            recipientId: headUid,
            type: "attendance_missing_check_out",
            title: "Missing check-out",
            message,
          });
        }
      }
    }
  } catch (error) {
    console.error("Failed to check attendance for head notification", error);
  }
}

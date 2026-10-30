import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "./config";
import {
  getAttendanceRecord,
  isIstSunday,
  istDateKey,
} from "./attendance";
import { listBookableProfiles } from "./bookings";
import { createNotification } from "./notifications";

// Must build an identical key whether reading back an existing notification
// or checking a candidate one before creating it — these two call sites
// previously used different formats (one included recipientId, the other
// didn't), so the "already notified" lookup never matched anything and a
// fresh duplicate notification was created on every single dashboard load.
function notificationKey(type: string, recipientId: string, message: string): string {
  return `${type}_${recipientId}_${message.slice(0, 80)}`;
}

/**
 * Notifies the campus Head about counsellors who, today, haven't checked in
 * or checked out — skipping anyone who is on an approved leave today (they
 * are not expected to check in/out).
 *
 * Called when the Head's dashboard loads; once per person per missing part
 * per day, enforced by the deterministic notification lookup below.
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

    // Skip the notification if the head was already told about this person
    // today for the same part — the notification itself is the record.
    const existingForToday = await getDocs(
      query(
        collection(db, "notifications"),
        where("recipientId", "==", headUid),
        where("createdAt", ">=", new Date(new Date().setHours(0, 0, 0, 0)).getTime()),
      ),
    );
    const alreadyNotified = new Set(
      existingForToday.docs.map((d) =>
        notificationKey(d.data().type, d.data().recipientId, d.data().message ?? ""),
      ),
    );

    for (const person of staff) {
      if (onLeaveUids.has(person.uid) || person.available === false) continue;
      const record = await getAttendanceRecord(person.uid, today);
      const name = person.displayName || person.email;

      if (record?.checkInAt == null) {
        const message = `${name} has not checked in today (${today}).`;
        const key = notificationKey("attendance_missed_check_in", headUid, message);
        if (!alreadyNotified.has(key)) {
          await createNotification({
            recipientId: headUid,
            type: "attendance_missed_check_in",
            title: "Missing check-in",
            message,
          });
        }
      } else if (record.checkOutAt == null) {
        // Only remind about a missing check-out late in the day, so people
        // still working aren't flagged in the morning.
        const nowHour = new Date().getHours();
        if (nowHour >= 18) {
          const message = `${name} checked in today but has not checked out yet (${today}).`;
          const key = notificationKey("attendance_missing_check_out", headUid, message);
          if (!alreadyNotified.has(key)) {
            await createNotification({
              recipientId: headUid,
              type: "attendance_missing_check_out",
              title: "Missing check-out",
              message,
            });
          }
        }
      }
    }
  } catch (error) {
    console.error("Failed to check attendance for head notification", error);
  }
}

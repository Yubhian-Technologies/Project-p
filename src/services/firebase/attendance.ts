import { collection, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from "firebase/firestore";
import { db } from "./config";
import type { AttendanceRecord } from "../../types/attendance";

const attendanceCollection = collection(db, "attendance");

/** IST (UTC+5:30) calendar-day key, YYYY-MM-DD, for a moment in time. */
export function istDateKey(ms: number): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(ms));
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

/** True when the given moment falls on a Sunday in IST — nobody is expected
    to check in/out that day, so the UI hides those options and the Head's
    missing-check-in reminder skips everyone rather than flagging the whole
    campus. Checked in IST (not the browser's local zone) for the same
    reason every other date in this file is — a counsellor and their Head
    must agree on which calendar day "today" is. */
export function isIstSunday(ms: number): boolean {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
  }).format(new Date(ms));
  return weekday === "Sun";
}

/** Same check as isIstSunday, but for an arbitrary "YYYY-MM-DD" calendar date
    rather than "now" — used when looking up a past/picked date (e.g. the
    attendance log's date filter) instead of today. A calendar date's
    weekday doesn't depend on timezone the way "now" does, since there's no
    time-of-day to convert — only the Y/M/D components matter. */
export function isDateKeySunday(dateKey: string): boolean {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day).getDay() === 0;
}

/** Time-of-day label in IST, e.g. "9:32 AM". */
export function formatIstTime(ms: number): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(ms));
}

/** Human-friendly date label for an IST day key, e.g. "Mon, 3 Oct 2026". */
export function formatIstDateLabel(dateKey: string): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

/** Duration label, e.g. "7h 30m". */
export function formatDuration(ms: number): string {
  const totalMinutes = Math.max(0, Math.round(ms / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
}

/** One record per user per day — the doc id enforces the one-pair-per-day rule. */
export function attendanceDocId(uid: string, date: string): string {
  return `${uid}_${date}`;
}

export async function getAttendanceRecord(
  uid: string,
  date: string,
): Promise<AttendanceRecord | null> {
  const snapshot = await getDoc(doc(attendanceCollection, attendanceDocId(uid, date)));
  if (!snapshot.exists()) return null;
  return { id: snapshot.id, ...snapshot.data() } as AttendanceRecord;
}

export async function checkIn(params: {
  uid: string;
  campusId: string;
  date: string;
  locationId: string;
  locationName: string;
}): Promise<void> {
  const now = Date.now();
  await setDoc(doc(attendanceCollection, attendanceDocId(params.uid, params.date)), {
    uid: params.uid,
    campusId: params.campusId,
    date: params.date,
    checkInAt: now,
    checkInMethod: "button",
    checkInLocationId: params.locationId,
    checkInLocationName: params.locationName,
    updatedAt: now,
  });
}

export async function checkOut(params: {
  uid: string;
  date: string;
  locationId: string;
  locationName: string;
}): Promise<void> {
  const now = Date.now();
  await updateDoc(doc(attendanceCollection, attendanceDocId(params.uid, params.date)), {
    checkOutAt: now,
    checkOutMethod: "button",
    checkOutLocationId: params.locationId,
    checkOutLocationName: params.locationName,
    updatedAt: now,
  });
}

/** Every attendance record for one user on one campus, oldest first. */
export async function listAttendance(uid: string, campusId: string): Promise<AttendanceRecord[]> {
  const q = query(
    attendanceCollection,
    where("uid", "==", uid),
    where("campusId", "==", campusId),
  );
  const snapshot = await getDocs(q);
  return snapshot.docs
    .map((d) => ({ id: d.id, ...d.data() }) as AttendanceRecord)
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}

/** Every attendance record for a whole campus on one day — one per person
    who has checked in or out that day; nothing for anyone who hasn't yet. */
export async function listAttendanceForCampusOnDate(
  campusId: string,
  date: string,
): Promise<AttendanceRecord[]> {
  const q = query(
    attendanceCollection,
    where("campusId", "==", campusId),
    where("date", "==", date),
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as AttendanceRecord);
}
/**
 * Head manually marks check-in / check-out / both for a counsellor (or another
 * head) on a past day. The reason is mandatory — the UI enforces it before
 * calling this.
 */
export async function manualMark(params: {
  uid: string;
  campusId: string;
  date: string;
  part: "check-in" | "check-out" | "both";
  reason: string;
  markedByUid: string;
  markedByName: string;
}): Promise<void> {
  const now = Date.now();
  const ref = doc(attendanceCollection, attendanceDocId(params.uid, params.date));
  const snapshot = await getDoc(ref);
  const existing = snapshot.exists() ? (snapshot.data() as AttendanceRecord) : null;

  if (existing) {
    const patch: Record<string, unknown> = { updatedAt: now };
    if (existing.checkInAt == null && (params.part === "check-in" || params.part === "both")) {
      patch.checkInAt = now;
      patch.checkInMethod = "manual" as const;
    }
    if (existing.checkOutAt == null && (params.part === "check-out" || params.part === "both")) {
      patch.checkOutAt = now;
      patch.checkOutMethod = "manual" as const;
    }
    patch.manualEntry = {
      part: params.part,
      reason: params.reason,
      markedByUid: params.markedByUid,
      markedByName: params.markedByName,
      markedAt: now,
    };
    await updateDoc(ref, patch);
  } else {
    // Firestore's web SDK rejects an explicit `undefined` field value — the
    // fields for whichever part ISN'T being marked (e.g. checkOutAt/
    // checkOutMethod when only "check-in" is marked) must be left out of the
    // payload entirely, not assigned undefined, or the whole write throws.
    const wantsCheckIn = params.part === "check-in" || params.part === "both";
    const wantsCheckOut = params.part === "check-out" || params.part === "both";
    await setDoc(ref, {
      uid: params.uid,
      campusId: params.campusId,
      date: params.date,
      ...(wantsCheckIn ? { checkInAt: now, checkInMethod: "manual" as const } : {}),
      ...(wantsCheckOut ? { checkOutAt: now, checkOutMethod: "manual" as const } : {}),
      manualEntry: {
        part: params.part,
        reason: params.reason,
        markedByUid: params.markedByUid,
        markedByName: params.markedByName,
        markedAt: now,
      },
      updatedAt: now,
    });
  }
}

/** Tells whether the editable window for the month containing `date` is open.
    Editable up to and including the 25th of the current month; locked after. */
export function isMonthlyWindowOpen(date: string): boolean {
  const [year, month, day] = dayNumberOf(date);
  const now = new Date();
  const currentDay = now.getDate();
  const sameMonth = now.getFullYear() === year && now.getMonth() + 1 === month;
  // Days 1–25 of the current month stay editable; after the 25th the whole
  // month locks (earlier months were locked when their own 26th arrived).
  if (sameMonth) return currentDay <= 25 || day <= 25;
  return false;
}

// -- small internal helpers ------------------------------------------------

function dayNumberOf(date: string): [number, number, number] {
  return date.split("-").map(Number) as [number, number, number];
}

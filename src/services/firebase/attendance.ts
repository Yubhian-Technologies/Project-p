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

export async function checkIn(uid: string, campusId: string, date: string): Promise<void> {
  await setDoc(doc(attendanceCollection, attendanceDocId(uid, date)), {
    uid,
    campusId,
    date,
    checkInAt: Date.now(),
    updatedAt: Date.now(),
  });
}

export async function checkOut(uid: string, date: string): Promise<void> {
  await updateDoc(doc(attendanceCollection, attendanceDocId(uid, date)), {
    checkOutAt: Date.now(),
    updatedAt: Date.now(),
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

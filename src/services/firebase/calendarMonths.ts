import { addDoc, collection, deleteDoc, doc, getDocs, query, updateDoc, where } from "firebase/firestore";
import { db } from "./config";
import type { CalendarMonth } from "../../types/calendarMonth";

const calendarMonthsCollection = collection(db, "calendarMonths");

// `campusId` is optional but required for a campus-scoped Admin: their read
// rule depends on resource.data.campusId, which Firestore can only validate
// for a list query when the query itself filters on it.
export async function listCalendarMonths(yearId: string, campusId?: string): Promise<CalendarMonth[]> {
  const q = campusId
    ? query(calendarMonthsCollection, where("yearId", "==", yearId), where("campusId", "==", campusId))
    : query(calendarMonthsCollection, where("yearId", "==", yearId));
  const snapshot = await getDocs(q);
  return snapshot.docs
    .map((d) => ({ id: d.id, ...d.data() }) as CalendarMonth)
    .sort((a, b) => a.calendarYear * 12 + a.month - (b.calendarYear * 12 + b.month));
}

export async function createCalendarMonth(
  campusId: string,
  collegeId: string,
  yearId: string,
  month: number,
  calendarYear: number,
  createdBy: string,
): Promise<string> {
  const docRef = await addDoc(calendarMonthsCollection, {
    campusId,
    collegeId,
    yearId,
    month,
    calendarYear,
    createdBy,
    createdAt: Date.now(),
  });
  return docRef.id;
}

export async function updateCalendarMonth(id: string, month: number, calendarYear: number): Promise<void> {
  await updateDoc(doc(db, "calendarMonths", id), { month, calendarYear });
}

// Cascades: deleting a month also deletes every event planned under it.
export async function deleteCalendarMonth(id: string): Promise<void> {
  const eventsSnapshot = await getDocs(query(collection(db, "events"), where("calendarMonthId", "==", id)));
  await Promise.all(eventsSnapshot.docs.map((d) => deleteDoc(d.ref)));
  await deleteDoc(doc(db, "calendarMonths", id));
}

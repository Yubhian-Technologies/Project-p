import { addDoc, collection, deleteDoc, doc, getDocs, query, updateDoc, where } from "firebase/firestore";
import { db } from "./config";
import type { CalendarYear } from "../../types/calendarYear";

const calendarYearsCollection = collection(db, "calendarYears");

export async function listCalendarYears(collegeId: string): Promise<CalendarYear[]> {
  const q = query(calendarYearsCollection, where("collegeId", "==", collegeId));
  const snapshot = await getDocs(q);
  return snapshot.docs
    .map((d) => ({ id: d.id, ...d.data() }) as CalendarYear)
    .sort((a, b) => a.createdAt - b.createdAt);
}

export async function createCalendarYear(
  campusId: string,
  collegeId: string,
  label: string,
  createdBy: string,
): Promise<string> {
  const docRef = await addDoc(calendarYearsCollection, {
    campusId,
    collegeId,
    label,
    createdBy,
    createdAt: Date.now(),
  });
  return docRef.id;
}

export async function updateCalendarYear(id: string, label: string): Promise<void> {
  await updateDoc(doc(db, "calendarYears", id), { label });
}

// Cascades: deleting a year also deletes every month written under it and every
// event planned in those months.
export async function deleteCalendarYear(id: string): Promise<void> {
  const [monthsSnapshot, eventsSnapshot] = await Promise.all([
    getDocs(query(collection(db, "calendarMonths"), where("yearId", "==", id))),
    getDocs(query(collection(db, "events"), where("calendarYearId", "==", id))),
  ]);
  await Promise.all([
    ...monthsSnapshot.docs.map((d) => deleteDoc(d.ref)),
    ...eventsSnapshot.docs.map((d) => deleteDoc(d.ref)),
  ]);
  await deleteDoc(doc(db, "calendarYears", id));
}

import { addDoc, collection, deleteDoc, doc, getDocs, query, updateDoc, where } from "firebase/firestore";
import { db } from "./config";
import type { EventProgram } from "../../types/event";

const eventsCollection = collection(db, "events");

function toEvent(id: string, data: Record<string, unknown>): EventProgram {
  return { id, ...data } as EventProgram;
}

export async function listEventsForCampus(campusId: string): Promise<EventProgram[]> {
  const q = query(eventsCollection, where("campusId", "==", campusId));
  const snapshot = await getDocs(q);
  return snapshot.docs
    .map((d) => toEvent(d.id, d.data()))
    .sort((a, b) => b.eventDate - a.eventDate);
}

export async function listEventsForCollege(collegeId: string): Promise<EventProgram[]> {
  const q = query(eventsCollection, where("collegeId", "==", collegeId));
  const snapshot = await getDocs(q);
  return snapshot.docs
    .map((d) => toEvent(d.id, d.data()))
    .sort((a, b) => b.eventDate - a.eventDate);
}

export async function createEvent(
  input: Omit<EventProgram, "id" | "createdAt" | "updatedAt">,
): Promise<string> {
  const now = Date.now();
  const docRef = await addDoc(eventsCollection, { ...input, createdAt: now, updatedAt: now });
  return docRef.id;
}

export async function updateEvent(
  id: string,
  updates: Partial<
    Pick<
      EventProgram,
      | "title"
      | "description"
      | "category"
      | "sessionYears"
      | "targetGroup"
      | "importantDay"
      | "organizerIds"
      | "organizerNames"
      | "eventDate"
      | "attendeeCount"
      | "phase"
      | "reschedule"
      | "notConductedReason"
      | "reportUrl"
      | "reportFileName"
      | "reportUploadedAt"
    >
  >,
): Promise<void> {
  await updateDoc(doc(db, "events", id), { ...updates, updatedAt: Date.now() });
}

export async function deleteEvent(id: string): Promise<void> {
  await deleteDoc(doc(db, "events", id));
}

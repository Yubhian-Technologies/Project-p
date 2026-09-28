import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, where } from "firebase/firestore";
import { db } from "./config";
import { createNotification } from "./notifications";
import type { JournalEntry, SharedJournalEntry } from "../../types/journalEntry";
import { toIsoDate } from "../../utils/dateFormat";

function entriesCollection(uid: string) {
  return collection(db, "journalEntries", uid, "entries");
}

function entryDocRef(uid: string, date: string) {
  return doc(db, "journalEntries", uid, "entries", date);
}

function toJournalEntry(id: string, data: Record<string, unknown>): JournalEntry {
  return { id, ...data } as JournalEntry;
}

export async function listJournalEntries(uid: string): Promise<JournalEntry[]> {
  const snapshot = await getDocs(entriesCollection(uid));
  return snapshot.docs.map((d) => toJournalEntry(d.id, d.data())).sort((a, b) => a.id.localeCompare(b.id));
}

export async function saveJournalEntry(
  uid: string,
  date: string,
  input: { note: string; isReminder?: boolean; reminderTime?: string },
): Promise<void> {
  const ref = entryDocRef(uid, date);
  const existing = await getDoc(ref);
  const now = Date.now();
  await setDoc(ref, {
    note: input.note,
    isReminder: input.isReminder ?? false,
    ...(input.isReminder && input.reminderTime ? { reminderTime: input.reminderTime } : {}),
    createdAt: existing.exists() ? existing.data().createdAt : now,
    updatedAt: now,
  });
}

export async function deleteJournalEntry(uid: string, date: string): Promise<void> {
  await deleteDoc(entryDocRef(uid, date));
}

const sharedEntriesCollection = collection(db, "sharedJournalEntries");

/**
 * A student's deliberate, one-off share of a single entry with one
 * same-campus counsellor — this never touches the private journalEntries
 * collection above; it just copies the current note text into its own
 * separate, narrowly-scoped collection.
 */
export async function shareJournalEntry(
  student: { uid: string; email: string; name?: string },
  counsellorId: string,
  date: string,
  note: string,
): Promise<void> {
  await addDoc(sharedEntriesCollection, {
    studentId: student.uid,
    studentEmail: student.email,
    ...(student.name ? { studentName: student.name } : {}),
    counsellorId,
    date,
    note,
    sharedAt: Date.now(),
  });
  await createNotification({
    recipientId: counsellorId,
    type: "journal_entry_shared",
    title: "Journal entry shared with you",
    message: `${student.name || student.email} shared a journal entry from ${date} with you.`,
  });
}

export async function listSharedJournalEntriesForCounsellor(
  counsellorId: string,
): Promise<SharedJournalEntry[]> {
  const q = query(sharedEntriesCollection, where("counsellorId", "==", counsellorId));
  const snapshot = await getDocs(q);
  return snapshot.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<SharedJournalEntry, "id">) }))
    .sort((a, b) => b.sharedAt - a.sharedAt);
}

/**
 * True once a reminder-flagged entry is due: any prior date is always due;
 * today's date is due once the entry's reminderTime (if set) has passed, or
 * immediately if no specific time was set.
 */
export function isReminderDue(entry: JournalEntry, now: Date = new Date()): boolean {
  if (!entry.isReminder) return false;
  const todayIso = toIsoDate(now);
  if (entry.id < todayIso) return true;
  if (entry.id > todayIso) return false;
  if (!entry.reminderTime) return true;
  const [hour, minute] = entry.reminderTime.split(":").map(Number);
  const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour || 0, minute || 0);
  return now >= target;
}

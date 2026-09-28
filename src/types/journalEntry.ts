export interface JournalEntry {
  id: string; // "YYYY-MM-DD", same as the Firestore doc id
  note: string;
  isReminder?: boolean;
  reminderTime?: string; // "HH:mm", 24-hour — time of day the reminder is due
  createdAt: number;
  updatedAt: number;
}

/**
 * A student's deliberate, one-off share of a single journal entry with one
 * same-campus counsellor — a separate collection from the fully-private
 * journalEntries above, which this never touches or exposes.
 */
export interface SharedJournalEntry {
  id: string;
  studentId: string;
  studentEmail: string;
  studentName?: string;
  counsellorId: string;
  date: string; // the original entry's "YYYY-MM-DD"
  note: string;
  sharedAt: number;
}

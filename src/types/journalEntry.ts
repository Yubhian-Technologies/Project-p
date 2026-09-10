export interface JournalEntry {
  id: string; // "YYYY-MM-DD", same as the Firestore doc id
  note: string;
  isReminder?: boolean;
  reminderTime?: string; // "HH:mm", 24-hour — time of day the reminder is due
  createdAt: number;
  updatedAt: number;
}

import { useEffect, useState } from "react";
import { useAuth } from "../../../hooks/useAuth";
import { deleteJournalEntry, isReminderDue, listJournalEntries, saveJournalEntry } from "../../../services/firebase/journal";
import type { JournalEntry } from "../../../types/journalEntry";
import { toIsoDate } from "../../../utils/dateFormat";
import { JournalCalendar } from "./JournalCalendar";
import { JournalEntryEditor } from "./JournalEntryEditor";
import { JournalReminderControls } from "./JournalReminderControls";
import "./JournalSection.css";

export function JournalSection() {
  const { currentUser } = useAuth();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(() => toIsoDate(new Date()));
  const [isReminder, setIsReminder] = useState(false);
  const [reminderTime, setReminderTime] = useState("09:00");

  async function refresh() {
    if (!currentUser) return;
    const list = await listJournalEntries(currentUser.uid);
    setEntries(list);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, [currentUser]);

  const selectedEntry = entries.find((e) => e.id === selectedDate);

  useEffect(() => {
    setIsReminder(selectedEntry?.isReminder ?? false);
    setReminderTime(selectedEntry?.reminderTime ?? "09:00");
  }, [selectedDate, selectedEntry]);

  if (loading) return null;

  const now = new Date();
  const markedDates = new Set(entries.map((e) => e.id));
  const dueReminders = entries.filter((e) => isReminderDue(e, now));
  const dueReminderDates = new Set(dueReminders.map((e) => e.id));

  return (
    <div className="journal-section">
      <p className="journal-section__intro">
        A private space to write down your thoughts and keep notes for yourself. Pick any date on the calendar to
        write or revisit a note.
      </p>

      {dueReminders.length > 0 && (
        <div className="journal-section__reminders">
          <h3 className="journal-section__reminders-title">Reminders due</h3>
          {dueReminders.map((entry) => (
            <button
              key={entry.id}
              type="button"
              className="journal-section__reminder-item"
              onClick={() => setSelectedDate(entry.id)}
            >
              <strong>{entry.id}</strong> — {entry.note.slice(0, 80)}
              {entry.note.length > 80 ? "…" : ""}
            </button>
          ))}
        </div>
      )}

      <div className="journal-section__body">
        <div className="journal-section__calendar-col">
          <JournalCalendar
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            markedDates={markedDates}
            dueReminderDates={dueReminderDates}
          />
          <JournalReminderControls
            isReminder={isReminder}
            onToggleReminder={setIsReminder}
            reminderTime={reminderTime}
            onChangeReminderTime={setReminderTime}
          />
        </div>
        <JournalEntryEditor
          date={selectedDate}
          entry={selectedEntry}
          onSave={async (note) => {
            if (!currentUser) return;
            await saveJournalEntry(currentUser.uid, selectedDate, { note, isReminder, reminderTime });
            await refresh();
          }}
          onDelete={async () => {
            if (!currentUser) return;
            await deleteJournalEntry(currentUser.uid, selectedDate);
            await refresh();
          }}
        />
      </div>
    </div>
  );
}

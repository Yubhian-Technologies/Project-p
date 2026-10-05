import { useEffect, useState } from "react";
import { useAuth } from "../../../hooks/useAuth";
import {
  deleteJournalEntry,
  isReminderDue,
  listJournalEntries,
  listSharedJournalEntriesForCounsellor,
  saveJournalEntry,
  shareJournalEntry,
} from "../../../services/firebase/journal";
import { listBookableProfiles } from "../../../services/firebase/bookings";
import { completeJournalEntry } from "../../../services/wellnessScore";
import type { JournalEntry, SharedJournalEntry } from "../../../types/journalEntry";
import type { UserProfile } from "../../../types/user";
import { toIsoDate } from "../../../utils/dateFormat";
import { Button } from "../../../components/common/Button";
import { Modal } from "../../../components/common/Modal";
import { JournalCalendar } from "./JournalCalendar";
import { JournalEntryEditor } from "./JournalEntryEditor";
import { JournalReminderControls } from "./JournalReminderControls";
import "./JournalSection.css";

export function JournalSection() {
  const { currentUser, profile } = useAuth();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(() => toIsoDate(new Date()));
  const [isReminder, setIsReminder] = useState(false);
  const [reminderTime, setReminderTime] = useState("09:00");
  const [shareCandidates, setShareCandidates] = useState<UserProfile[]>([]);
  const [sharedWithMe, setSharedWithMe] = useState<SharedJournalEntry[]>([]);
  const [viewingShared, setViewingShared] = useState<SharedJournalEntry | null>(null);

  async function refresh() {
    if (!currentUser) return;
    const list = await listJournalEntries(currentUser.uid);
    setEntries(list);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, [currentUser]);

  // Same-campus counsellors and Heads to share an entry with — only needed
  // for a student viewer, but harmless to skip fetching for the others.
  useEffect(() => {
    if (profile?.role !== "user" || !profile.campusId) return;
    listBookableProfiles()
      .then((all) =>
        setShareCandidates(
          all.filter((p) => (p.role === "counsellor" || p.role === "head") && p.campusId === profile.campusId),
        ),
      )
      .catch(() => setShareCandidates([]));
  }, [profile?.role, profile?.campusId]);

  // Entries other students have shared with this viewer (a Counsellor or Head).
  useEffect(() => {
    if ((profile?.role !== "counsellor" && profile?.role !== "head") || !currentUser) return;
    listSharedJournalEntriesForCounsellor(currentUser.uid)
      .then(setSharedWithMe)
      .catch(() => setSharedWithMe([]));
  }, [profile?.role, currentUser]);

  async function handleDismissReminder(entry: JournalEntry) {
    if (!currentUser) return;
    await saveJournalEntry(currentUser.uid, entry.id, { note: entry.note, isReminder: false });
    await refresh();
  }

  async function handleSnoozeReminder(entry: JournalEntry) {
    if (!currentUser) return;
    await saveJournalEntry(currentUser.uid, entry.id, {
      note: entry.note,
      isReminder: true,
      reminderTime: entry.reminderTime,
      snoozedUntil: Date.now() + 60 * 60 * 1000,
    });
    await refresh();
  }

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
            <div key={entry.id} className="journal-section__reminder-item">
              <button
                type="button"
                className="journal-section__reminder-text"
                onClick={() => setSelectedDate(entry.id)}
              >
                <strong>{entry.id}</strong> — {entry.note.slice(0, 80)}
                {entry.note.length > 80 ? "…" : ""}
              </button>
              <div className="journal-section__reminder-actions">
                <button
                  type="button"
                  className="journal-section__reminder-action"
                  title="Mark as done — stop reminding me about this"
                  onClick={() => handleDismissReminder(entry)}
                >
                  Mark as Done
                </button>
                <button
                  type="button"
                  className="journal-section__reminder-action"
                  title="Remind me again in an hour"
                  onClick={() => handleSnoozeReminder(entry)}
                >
                  Remind Later
                </button>
              </div>
            </div>
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
            completeJournalEntry();
            await refresh();
          }}
          onDelete={async () => {
            if (!currentUser) return;
            await deleteJournalEntry(currentUser.uid, selectedDate);
            await refresh();
          }}
          shareCandidates={profile?.role === "user" ? shareCandidates : undefined}
          onShare={
            profile?.role === "user" && currentUser
              ? (counsellorId, note) =>
                  shareJournalEntry(
                    { uid: currentUser.uid, email: currentUser.email || "", name: profile.displayName },
                    counsellorId,
                    selectedDate,
                    note,
                  )
              : undefined
          }
        />
      </div>

      {(profile?.role === "counsellor" || profile?.role === "head") && sharedWithMe.length > 0 && (
        <div className="journal-section__shared">
          <h3 className="journal-section__shared-title">Shared with you</h3>
          <p className="journal-section__shared-subtitle">
            Journal entries students on your campus have chosen to share with you.
          </p>
          {sharedWithMe.map((s) => (
            <div key={s.id} className="journal-section__shared-item">
              <div className="journal-section__shared-meta">
                <strong>{s.studentName || s.studentEmail}</strong>
                <span>{s.date}</span>
              </div>
              <Button type="button" variant="outlined" onClick={() => setViewingShared(s)}>
                View
              </Button>
            </div>
          ))}
        </div>
      )}

      {viewingShared && (
        <Modal title="Shared journal entry" onClose={() => setViewingShared(null)}>
          <div className="journal-section__shared-modal-meta">
            <span>
              <strong>{viewingShared.studentName || viewingShared.studentEmail}</strong>
            </span>
            <span>{viewingShared.date}</span>
          </div>
          <p className="journal-section__shared-note">{viewingShared.note}</p>
        </Modal>
      )}
    </div>
  );
}


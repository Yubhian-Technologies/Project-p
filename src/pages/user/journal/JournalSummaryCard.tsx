import { useEffect, useState } from "react";
import { useAuth } from "../../../hooks/useAuth";
import { listJournalEntries, isReminderDue } from "../../../services/firebase/journal";
import type { JournalEntry } from "../../../types/journalEntry";
import { BentoCard } from "../../../components/common/BentoCard";
import { BookOpenIcon } from "../../../components/common/icons";
import { toIsoDate } from "../../../utils/dateFormat";
import { formatWeekdayDateDMY } from "../../../utils/formatDate";

function entryDateLabel(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  return formatWeekdayDateDMY(new Date(year, month - 1, day).getTime());
}

interface JournalSummaryCardProps {
  onOpenDiary: () => void;
}

/** Home-page summary of "My Diary" — whether today's entry is written yet,
    plus any reminders that are currently due, with a link to the full
    section. Journal data is fully private (journalEntries rules: isSelf
    only), so this is safe to fetch the same way the diary page itself does. */
export function JournalSummaryCard({ onOpenDiary }: JournalSummaryCardProps) {
  const { currentUser } = useAuth();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      return;
    }
    listJournalEntries(currentUser.uid)
      .then(setEntries)
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, [currentUser]);

  const todayIso = toIsoDate(new Date());
  const todayEntry = entries.find((e) => e.id === todayIso);
  const dueReminders = entries.filter((e) => isReminderDue(e)).sort((a, b) => a.id.localeCompare(b.id));

  return (
    <BentoCard
      span={4}
      icon={<BookOpenIcon />}
      title="My Diary"
      subtitle="A private space for your thoughts, with reminders to check back in."
      badge={
        dueReminders.length > 0
          ? { text: `${dueReminders.length} reminder${dueReminders.length === 1 ? "" : "s"}`, variant: "warning" }
          : undefined
      }
      action={{ label: "Open My Diary →", onClick: onOpenDiary }}
    >
      {loading ? (
        <p style={{ fontSize: 13, color: "var(--neu-text-muted, #718096)" }}>Loading…</p>
      ) : (
        <div className="bento-list">
          <div className="bento-list-item" style={{ cursor: "pointer" }} onClick={onOpenDiary}>
            <span className="bento-list-item__title">Today's entry</span>
            <span>{todayEntry ? "Saved ✓" : "Not written yet"}</span>
          </div>

          {dueReminders.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--neu-text-muted, #718096)" }}>No reminders due right now.</p>
          ) : (
            dueReminders.slice(0, 3).map((entry) => (
              <div key={entry.id} className="bento-list-item" style={{ cursor: "pointer" }} onClick={onOpenDiary}>
                <span className="bento-list-item__title">Reminder — {entryDateLabel(entry.id)}</span>
                <span>{entry.reminderTime ?? "Due"}</span>
              </div>
            ))
          )}
        </div>
      )}
    </BentoCard>
  );
}

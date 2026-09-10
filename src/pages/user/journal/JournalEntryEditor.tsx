import { useEffect, useState } from "react";
import { Card } from "../../../components/common/Card";
import { Button } from "../../../components/common/Button";
import type { JournalEntry } from "../../../types/journalEntry";

interface JournalEntryEditorProps {
  date: string; // "YYYY-MM-DD"
  entry: JournalEntry | undefined;
  onSave: (note: string) => Promise<void>;
  onDelete: () => Promise<void>;
}

function formatDateHeading(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function JournalEntryEditor({ date, entry, onSave, onDelete }: JournalEntryEditorProps) {
  const [note, setNote] = useState(entry?.note ?? "");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setNote(entry?.note ?? "");
  }, [date, entry]);

  async function handleSave() {
    if (!note.trim()) return;
    setSaving(true);
    try {
      await onSave(note.trim());
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await onDelete();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Card className="journal-editor">
      <h3 className="journal-editor__heading">{formatDateHeading(date)}</h3>
      <textarea
        className="journal-editor__textarea"
        rows={6}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Write down what's on your mind today…"
      />
      <div className="journal-editor__actions">
        <Button type="button" disabled={!note.trim() || saving} onClick={handleSave}>
          {saving ? "Saving…" : "Save"}
        </Button>
        {entry && (
          <Button type="button" variant="outlined" disabled={deleting} onClick={handleDelete}>
            {deleting ? "Deleting…" : "Delete"}
          </Button>
        )}
      </div>
    </Card>
  );
}

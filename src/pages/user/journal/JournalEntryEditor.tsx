import { useEffect, useState } from "react";
import { Card } from "../../../components/common/Card";
import { Button } from "../../../components/common/Button";
import { Select } from "../../../components/common/Select";
import type { JournalEntry } from "../../../types/journalEntry";
import type { UserProfile } from "../../../types/user";
import { formatWeekdayDateDMY } from "../../../utils/formatDate";

interface JournalEntryEditorProps {
  date: string; // "YYYY-MM-DD"
  entry: JournalEntry | undefined;
  onSave: (note: string) => Promise<void>;
  onDelete: () => Promise<void>;
  /** Only passed for a student viewer — same-campus counsellors to share with. */
  shareCandidates?: UserProfile[];
  onShare?: (counsellorId: string, note: string) => Promise<void>;
}

function formatDateHeading(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  return formatWeekdayDateDMY(new Date(year, month - 1, day).getTime());
}

export function JournalEntryEditor({
  date,
  entry,
  onSave,
  onDelete,
  shareCandidates,
  onShare,
}: JournalEntryEditorProps) {
  const [note, setNote] = useState(entry?.note ?? "");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [shareCounsellorId, setShareCounsellorId] = useState("");
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState("");
  const [shared, setShared] = useState(false);

  useEffect(() => {
    setNote(entry?.note ?? "");
    setShowShare(false);
    setShareCounsellorId("");
    setShareError("");
    setShared(false);
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

  async function handleShare() {
    if (!onShare || !shareCounsellorId || !note.trim() || sharing) return;
    setSharing(true);
    setShareError("");
    try {
      await onShare(shareCounsellorId, note.trim());
      setShared(true);
      setShowShare(false);
    } catch (err) {
      setShareError(err instanceof Error ? err.message : "Couldn't share this entry. Please try again.");
    } finally {
      setSharing(false);
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
        {entry && onShare && (
          <Button type="button" variant="outlined" onClick={() => setShowShare((v) => !v)}>
            Share to Counsellor
          </Button>
        )}
      </div>

      {showShare && (
        <div className="journal-editor__share">
          <label htmlFor={`journal-share-${date}`}>Share with (your campus only)</label>
          <Select id={`journal-share-${date}`} value={shareCounsellorId} onChange={setShareCounsellorId}>
            <option value="" disabled>
              Select a counsellor…
            </option>
            {(shareCandidates ?? []).map((c) => (
              <option key={c.uid} value={c.uid}>
                {c.displayName || c.email}
              </option>
            ))}
          </Select>
          {shareError && <p className="journal-editor__share-error">{shareError}</p>}
          <div className="journal-editor__actions">
            <Button type="button" disabled={!shareCounsellorId || sharing} onClick={handleShare}>
              {sharing ? "Sharing…" : "Confirm share"}
            </Button>
            <Button type="button" variant="outlined" onClick={() => setShowShare(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {shared && <p className="journal-editor__share-success">Shared with your counsellor.</p>}
    </Card>
  );
}

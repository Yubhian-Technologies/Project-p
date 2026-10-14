import { useState } from "react";
import { Modal } from "../common/Modal";
import { Button } from "../common/Button";
import { Select } from "../common/Select";
import { DateTimePicker } from "../common/DateTimePicker";
import { StarRating } from "../common/StarRating";
import { createOfflineFollowUp, importOfflineSession } from "../../services/firebase/bookings";
import { normalizeEmail } from "../../utils/offlineSessionImport";
import type { OfflineSessionRow } from "../../utils/offlineSessionImport";
import "./ImportSessionsModal.css";
import "./AddSessionModal.css";

interface AddSessionModalProps {
  counsellor: { uid: string; email: string; campusId?: string };
  onClose: () => void;
  onAdded: () => void;
}

function toDateTimeLocalValue(epochMs: number): string {
  const d = new Date(epochMs);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Single-session counterpart to ImportSessionsModal: logs one offline session
// straight into Completed, and optionally books the follow-up.
export function AddSessionModal({ counsellor, onClose, onAdded }: AddSessionModalProps) {
  const [clientName, setClientName] = useState("");
  const [contact, setContact] = useState("");
  const [occupation, setOccupation] = useState<"student" | "professional">("student");
  const [sessionAt, setSessionAt] = useState("");
  const [duration, setDuration] = useState("90");
  const [issue, setIssue] = useState("");
  const [summary, setSummary] = useState("");
  const [userRating, setUserRating] = useState(0);
  const [counsellorRating, setCounsellorRating] = useState(0);
  const [note, setNote] = useState("");
  const [needsFollowUp, setNeedsFollowUp] = useState<"no" | "yes">("no");
  const [followUpAt, setFollowUpAt] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const nowValue = toDateTimeLocalValue(Date.now());
  const sessionTime = sessionAt ? new Date(sessionAt).getTime() : NaN;
  const followUpTime = followUpAt ? new Date(followUpAt).getTime() : NaN;
  const durationNum = Number(duration);

  const sessionInFuture = !isNaN(sessionTime) && sessionTime > Date.now();
  const followUpInPast = needsFollowUp === "yes" && !isNaN(followUpTime) && followUpTime <= Date.now();
  const canSave =
    !!clientName.trim() &&
    !isNaN(sessionTime) &&
    !sessionInFuture &&
    Number.isFinite(durationNum) &&
    durationNum > 0 &&
    (needsFollowUp === "no" || (!isNaN(followUpTime) && !followUpInPast)) &&
    !saving;

  async function handleSave() {
    setSaving(true);
    setError("");
    const row: OfflineSessionRow = {
      clientName: clientName.trim(),
      scheduledAt: sessionTime,
      durationMinutes: durationNum,
      occupation,
      whatsappNumber: contact.trim(),
      issue: issue.trim(),
      summary: summary.trim() || undefined,
      userRating: userRating || undefined,
      counsellorRating: counsellorRating || undefined,
      counsellorNote: note.trim() || undefined,
      clientEmail: normalizeEmail(contact) || undefined,
    };
    try {
      const bookingId = await importOfflineSession(counsellor, row);
      if (needsFollowUp === "yes") {
        await createOfflineFollowUp(counsellor, row, bookingId, followUpTime);
      }
      onAdded();
      onClose();
    } catch (err) {
      console.error("Failed to add session", err);
      setError("Couldn't save this session. Please try again.");
      setSaving(false);
    }
  }

  return (
    <Modal title="Add Offline Session" onClose={onClose} className="import-sessions-modal">
      <div className="add-session-modal">
        <div className="add-session-modal__field">
          <label htmlFor="add-session-name">Client name *</label>
          <input id="add-session-name" type="text" value={clientName} onChange={(e) => setClientName(e.target.value)} />
        </div>
        <div className="add-session-modal__field">
          <label htmlFor="add-session-contact">WhatsApp / phone or email</label>
          <input id="add-session-contact" type="text" value={contact} onChange={(e) => setContact(e.target.value)} />
        </div>
        <div className="add-session-modal__field">
          <label htmlFor="add-session-occupation">Occupation</label>
          <Select
            id="add-session-occupation"
            value={occupation}
            onChange={(v) => setOccupation(v as "student" | "professional")}
          >
            <option value="student">Student</option>
            <option value="professional">Working professional</option>
          </Select>
        </div>
        <div className="add-session-modal__field">
          <label htmlFor="add-session-when">Session date &amp; time *</label>
          <DateTimePicker id="add-session-when" max={nowValue} value={sessionAt} onChange={setSessionAt} />
          {sessionInFuture && <p className="add-session-modal__warning">A held session can't be in the future.</p>}
        </div>
        <div className="add-session-modal__field">
          <label htmlFor="add-session-duration">Duration (minutes)</label>
          <input
            id="add-session-duration"
            type="number"
            min={1}
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
          />
        </div>
        <div className="add-session-modal__field">
          <label htmlFor="add-session-issue">Issue / topic</label>
          <input id="add-session-issue" type="text" value={issue} onChange={(e) => setIssue(e.target.value)} />
        </div>
        <div className="add-session-modal__field">
          <label htmlFor="add-session-summary">Session summary</label>
          <textarea id="add-session-summary" rows={3} value={summary} onChange={(e) => setSummary(e.target.value)} />
        </div>
        <div className="add-session-modal__row">
          <div className="add-session-modal__field">
            <label>Client's rating of counsellor</label>
            <StarRating value={userRating} onChange={setUserRating} size="large" />
          </div>
          <div className="add-session-modal__field">
            <label>Counsellor's rating of client</label>
            <StarRating value={counsellorRating} onChange={setCounsellorRating} size="large" />
          </div>
        </div>
        <div className="add-session-modal__field">
          <label htmlFor="add-session-note">Counsellor's private note</label>
          <textarea id="add-session-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>

        <div className="add-session-modal__field">
          <label htmlFor="add-session-followup">Is a follow-up session needed?</label>
          <Select
            id="add-session-followup"
            value={needsFollowUp}
            onChange={(v) => setNeedsFollowUp(v as "no" | "yes")}
          >
            <option value="no">No</option>
            <option value="yes">Yes</option>
          </Select>
        </div>
        {needsFollowUp === "yes" && (
          <div className="add-session-modal__field">
            <label htmlFor="add-session-followup-when">Follow-up date &amp; time *</label>
            <DateTimePicker id="add-session-followup-when" min={nowValue} value={followUpAt} onChange={setFollowUpAt} />
            {followUpInPast && <p className="add-session-modal__warning">Pick a time later than now.</p>}
          </div>
        )}

        {error && <p className="add-session-modal__warning">{error}</p>}
        <div className="add-session-modal__actions">
          <Button type="button" variant="outlined" disabled={saving} onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" disabled={!canSave} onClick={handleSave}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

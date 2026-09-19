import { useState } from "react";
import type { FormEvent } from "react";
import { Modal } from "../../components/common/Modal";
import { Button } from "../../components/common/Button";
import { updateCollege } from "../../services/firebase/colleges";
import type { College } from "../../types/college";
import "./CampusDetailSection.css";

interface EditCollegeModalProps {
  college: College;
  onClose: () => void;
  onUpdated: () => Promise<void>;
}

export function EditCollegeModal({ college, onClose, onUpdated }: EditCollegeModalProps) {
  const [name, setName] = useState(college.name);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await updateCollege(college.id, name.trim());
      await onUpdated();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Edit college" onClose={onClose}>
      <form onSubmit={handleSubmit} className="campus-detail-section__form">
        <div className="campus-detail-section__field">
          <label htmlFor="edit-college-name">College name</label>
          <input
            id="edit-college-name"
            type="text"
            placeholder="College name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </div>
        <Button type="submit" disabled={saving || !name.trim()}>
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </form>
    </Modal>
  );
}

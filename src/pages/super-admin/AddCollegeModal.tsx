import { useState } from "react";
import type { FormEvent } from "react";
import { Modal } from "../../components/common/Modal";
import { Button } from "../../components/common/Button";
import { createCollege } from "../../services/firebase/colleges";
import "./CampusDetailSection.css";

interface AddCollegeModalProps {
  campusId: string;
  onClose: () => void;
  onCreated: () => Promise<void>;
}

export function AddCollegeModal({ campusId, onClose, onCreated }: AddCollegeModalProps) {
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    try {
      await createCollege(campusId, name.trim());
      await onCreated();
      onClose();
    } finally {
      setCreating(false);
    }
  }

  return (
    <Modal title="Add a college" onClose={onClose}>
      <form onSubmit={handleSubmit} className="campus-detail-section__form">
        <div className="campus-detail-section__field">
          <label htmlFor="college-name">College name</label>
          <input
            id="college-name"
            type="text"
            placeholder="College name, e.g. Test College"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </div>
        <Button type="submit" disabled={creating || !name.trim()}>
          {creating ? "Adding…" : "Add college"}
        </Button>
      </form>
    </Modal>
  );
}

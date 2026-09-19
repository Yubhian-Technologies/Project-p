import { useState } from "react";
import type { FormEvent } from "react";
import { Modal } from "../../components/common/Modal";
import { Button } from "../../components/common/Button";
import { updateCampus } from "../../services/firebase/campuses";
import type { Campus } from "../../types/campus";
import "./CampusManagementSection.css";

interface EditCampusModalProps {
  campus: Campus;
  onClose: () => void;
  onUpdated: () => Promise<void>;
}

export function EditCampusModal({ campus, onClose, onUpdated }: EditCampusModalProps) {
  const [name, setName] = useState(campus.name);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await updateCampus(campus.id, name.trim());
      await onUpdated();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Edit campus" onClose={onClose}>
      <form onSubmit={handleSubmit} className="campus-management__form">
        <input
          type="text"
          placeholder="Campus name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
        <Button type="submit" disabled={saving || !name.trim()}>
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </form>
    </Modal>
  );
}

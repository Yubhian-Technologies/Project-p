import { useState } from "react";
import type { FormEvent } from "react";
import { Modal } from "../../components/common/Modal";
import { Button } from "../../components/common/Button";
import { createCampus } from "../../services/firebase/campuses";
import "./CampusManagementSection.css";

interface AddCampusModalProps {
  onClose: () => void;
  onCreated: () => Promise<void>;
}

export function AddCampusModal({ onClose, onCreated }: AddCampusModalProps) {
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    try {
      await createCampus(name.trim());
      await onCreated();
      onClose();
    } finally {
      setCreating(false);
    }
  }

  return (
    <Modal title="Add a new campus" onClose={onClose}>
      <form onSubmit={handleSubmit} className="campus-management__form">
        <input
          type="text"
          placeholder="Campus name, e.g. Test Campus"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
        <Button type="submit" disabled={creating || !name.trim()}>
          {creating ? "Adding…" : "Add campus"}
        </Button>
      </form>
    </Modal>
  );
}

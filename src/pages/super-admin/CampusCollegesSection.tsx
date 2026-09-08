import { useState } from "react";
import type { FormEvent } from "react";
import { createCollege, deleteCollege } from "../../services/firebase/colleges";
import type { Campus } from "../../types/campus";
import type { College } from "../../types/college";
import { Card } from "../../components/common/Card";
import { Button } from "../../components/common/Button";
import "./CampusCollegesSection.css";

interface CampusCollegesSectionProps {
  campus: Campus;
  colleges: College[];
  onChange: () => Promise<void>;
}

export function CampusCollegesSection({ campus, colleges, onChange }: CampusCollegesSectionProps) {
  const [nameField, setNameField] = useState("");
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    if (!nameField.trim()) return;
    setCreating(true);
    try {
      await createCollege(campus.id, nameField.trim());
      setNameField("");
      await onChange();
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      await deleteCollege(id);
      await onChange();
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="campus-colleges-section">
      <Card className="campus-colleges-section__add-form">
        <p className="campus-colleges-section__form-title">+ Add College</p>
        <form onSubmit={handleCreate}>
          <div className="campus-colleges-section__field">
            <label htmlFor="college-name">College name</label>
            <input
              id="college-name"
              type="text"
              placeholder="College name, e.g. Test College"
              value={nameField}
              onChange={(e) => setNameField(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={creating || !nameField.trim()}>
            {creating ? "Adding…" : "Add college"}
          </Button>
        </form>
      </Card>

      {colleges.length === 0 && <p>No colleges added for this campus yet.</p>}

      {colleges.map((college) => (
        <Card key={college.id} className="campus-colleges-section__row">
          <p className="campus-colleges-section__name">{college.name}</p>
          <Button
            type="button"
            variant="outlined"
            disabled={deletingId === college.id}
            onClick={() => handleDelete(college.id)}
          >
            {deletingId === college.id ? "Deleting…" : "Delete"}
          </Button>
        </Card>
      ))}
    </div>
  );
}

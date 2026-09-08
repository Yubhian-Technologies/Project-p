import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { createCollege, deleteCollege, listColleges } from "../../services/firebase/colleges";
import type { Campus } from "../../types/campus";
import type { College } from "../../types/college";
import { Card } from "../../components/common/Card";
import { Button } from "../../components/common/Button";
import { CollapsibleAddForm } from "../../components/common/CollapsibleAddForm";
import "./CampusCollegesSection.css";

interface CampusCollegesSectionProps {
  campus: Campus;
}

export function CampusCollegesSection({ campus }: CampusCollegesSectionProps) {
  const [colleges, setColleges] = useState<College[]>([]);
  const [loading, setLoading] = useState(true);
  const [nameField, setNameField] = useState("");
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function load() {
    setColleges(await listColleges(campus.id));
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campus.id]);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    if (!nameField.trim()) return;
    setCreating(true);
    try {
      await createCollege(campus.id, nameField.trim());
      setNameField("");
      await load();
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      await deleteCollege(id);
      await load();
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) return null;

  return (
    <div className="campus-colleges-section">
      <CollapsibleAddForm label="+ Add College" title="Add a college">
        <form onSubmit={handleCreate}>
          <div className="campus-colleges-section__field">
            <label htmlFor={`college-name-${campus.id}`}>College name</label>
            <input
              id={`college-name-${campus.id}`}
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
      </CollapsibleAddForm>

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

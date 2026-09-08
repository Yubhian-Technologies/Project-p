import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { listCampuses, createCampus, deleteCampus } from "../../services/firebase/campuses";
import type { Campus } from "../../types/campus";
import { Card } from "../../components/common/Card";
import { Button } from "../../components/common/Button";
import { CampusLoginsDetail } from "./CampusLoginsDetail";
import "./CampusManagementSection.css";

export function CampusManagementSection() {
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [loading, setLoading] = useState(true);
  const [nameField, setNameField] = useState("");
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [selectedCampus, setSelectedCampus] = useState<Campus | null>(null);

  async function load() {
    setCampuses(await listCampuses());
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    if (!nameField.trim()) return;
    setCreating(true);
    try {
      await createCampus(nameField.trim());
      setNameField("");
      await load();
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      await deleteCampus(id);
      setConfirmingDeleteId(null);
      await load();
    } finally {
      setDeletingId(null);
    }
  }

  if (selectedCampus) {
    return <CampusLoginsDetail campus={selectedCampus} onBack={() => setSelectedCampus(null)} />;
  }

  if (loading) return null;

  return (
    <div className="campus-management">
      <Card className="campus-management__add-form">
        <p className="campus-management__form-title">+ Add Campus</p>
        <form onSubmit={handleCreate} className="campus-management__form">
          <input
            type="text"
            placeholder="Campus name, e.g. Test Campus"
            value={nameField}
            onChange={(e) => setNameField(e.target.value)}
          />
          <Button type="submit" disabled={creating || !nameField.trim()}>
            {creating ? "Adding…" : "Add campus"}
          </Button>
        </form>
      </Card>

      {campuses.length === 0 && <p>No campuses yet.</p>}

      {campuses.map((campus) => (
        <Card key={campus.id} className="campus-management__row" onClick={() => setSelectedCampus(campus)}>
          <div>
            <p className="campus-management__name">{campus.name}</p>
            <p className="campus-management__date">Created {new Date(campus.createdAt).toLocaleDateString()}</p>
          </div>

          <div onClick={(e) => e.stopPropagation()}>
            {confirmingDeleteId === campus.id ? (
              <div className="campus-management__confirm">
                <span>Delete this campus?</span>
                <Button type="button" disabled={deletingId === campus.id} onClick={() => handleDelete(campus.id)}>
                  {deletingId === campus.id ? "Deleting…" : "Confirm"}
                </Button>
                <Button type="button" variant="outlined" onClick={() => setConfirmingDeleteId(null)}>
                  Cancel
                </Button>
              </div>
            ) : (
              <Button type="button" variant="outlined" onClick={() => setConfirmingDeleteId(campus.id)}>
                Delete
              </Button>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}

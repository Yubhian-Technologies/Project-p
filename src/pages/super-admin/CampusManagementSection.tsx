import { useEffect, useState } from "react";
import { listCampuses, deleteCampus } from "../../services/firebase/campuses";
import type { Campus } from "../../types/campus";
import { formatDateDMY } from "../../utils/formatDate";
import { useViewMore } from "../../hooks/useViewMore";
import { Card } from "../../components/common/Card";
import { Button } from "../../components/common/Button";
import { AddCampusModal } from "./AddCampusModal";
import { EditCampusModal } from "./EditCampusModal";
import { CampusDetailSection } from "./CampusDetailSection";
import "./CampusManagementSection.css";

export function CampusManagementSection() {
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [editingCampus, setEditingCampus] = useState<Campus | null>(null);
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

  const { visible: visibleCampuses, hiddenCount, showMore } = useViewMore(campuses);

  if (selectedCampus) {
    return <CampusDetailSection campus={selectedCampus} onBack={() => setSelectedCampus(null)} />;
  }

  if (loading) return null;

  return (
    <div className="campus-management">
      <div className="campus-management__header">
        <Button type="button" onClick={() => setAddOpen(true)}>
          + Add Campus
        </Button>
      </div>

      {campuses.length === 0 && <p>No campuses yet.</p>}

      {visibleCampuses.map((campus) => (
        <Card key={campus.id} className="campus-management__row" onClick={() => setSelectedCampus(campus)}>
          <div>
            <p className="campus-management__name">{campus.name}</p>
            <p className="campus-management__date">Created {formatDateDMY(campus.createdAt)}</p>
          </div>

          <div className="campus-management__actions" onClick={(e) => e.stopPropagation()}>
            <Button
              type="button"
              variant="outlined"
              onClick={() => setSelectedCampus(campus)}
            >
              View
            </Button>
            <Button
              type="button"
              variant="outlined"
              onClick={() => setEditingCampus(campus)}
            >
              Edit
            </Button>
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

      {hiddenCount > 0 && (
        <Button type="button" variant="outlined" style={{ alignSelf: "center" }} onClick={showMore}>
          View More ({hiddenCount} more)
        </Button>
      )}

      {addOpen && <AddCampusModal onClose={() => setAddOpen(false)} onCreated={load} />}
      {editingCampus && (
        <EditCampusModal
          campus={editingCampus}
          onClose={() => setEditingCampus(null)}
          onUpdated={load}
        />
      )}
    </div>
  );
}

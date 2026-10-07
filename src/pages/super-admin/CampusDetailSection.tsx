import { useEffect, useState } from "react";
import { listColleges, deleteCollege } from "../../services/firebase/colleges";
import type { Campus } from "../../types/campus";
import type { College } from "../../types/college";
import { useViewMore } from "../../hooks/useViewMore";
import { Card } from "../../components/common/Card";
import { Button } from "../../components/common/Button";
import { BackLink } from "../../components/common/BackLink";
import { AddCollegeModal } from "./AddCollegeModal";
import { EditCollegeModal } from "./EditCollegeModal";
import "./CampusDetailSection.css";

interface CampusDetailSectionProps {
  campus: Campus;
  onBack: () => void;
}

export function CampusDetailSection({ campus, onBack }: CampusDetailSectionProps) {
  const [colleges, setColleges] = useState<College[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [editingCollege, setEditingCollege] = useState<College | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function load() {
    setColleges(await listColleges(campus.id));
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campus.id]);

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      await deleteCollege(id);
      await load();
    } finally {
      setDeletingId(null);
    }
  }

  const { visible: visibleColleges, hiddenCount, showMore } = useViewMore(colleges);

  if (loading) return null;

  return (
    <div className="campus-detail-section">
      <BackLink label="Back to Campuses" onClick={onBack} />

      <div className="campus-detail-section__header">
        <h2 className="campus-detail-section__heading">{campus.name}</h2>
        <Button type="button" onClick={() => setAddOpen(true)}>
          + Add College
        </Button>
      </div>

      {colleges.length === 0 && <p>No colleges added for this campus yet.</p>}

      {visibleColleges.map((college) => (
        <Card key={college.id} className="campus-detail-section__row">
          <p className="campus-detail-section__name">{college.name}</p>
          <div className="campus-detail-section__actions">
            <Button
              type="button"
              variant="outlined"
              onClick={() => setEditingCollege(college)}
            >
              Edit
            </Button>
            <Button
              type="button"
              variant="outlined"
              disabled={deletingId === college.id}
              onClick={() => handleDelete(college.id)}
            >
              {deletingId === college.id ? "Deleting…" : "Delete"}
            </Button>
          </div>
        </Card>
      ))}

      {hiddenCount > 0 && (
        <Button type="button" variant="outlined" style={{ alignSelf: "center" }} onClick={showMore}>
          View More ({hiddenCount} more)
        </Button>
      )}

      {addOpen && (
        <AddCollegeModal campusId={campus.id} onClose={() => setAddOpen(false)} onCreated={load} />
      )}
      {editingCollege && (
        <EditCollegeModal
          college={editingCollege}
          onClose={() => setEditingCollege(null)}
          onUpdated={load}
        />
      )}
    </div>
  );
}

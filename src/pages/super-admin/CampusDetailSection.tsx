import { useEffect, useState } from "react";
import { listColleges, deleteCollege } from "../../services/firebase/colleges";
import type { Campus } from "../../types/campus";
import type { College } from "../../types/college";
import { Card } from "../../components/common/Card";
import { Button } from "../../components/common/Button";
import { BackLink } from "../../components/common/BackLink";
import { AddCollegeModal } from "./AddCollegeModal";
import "./CampusDetailSection.css";

interface CampusDetailSectionProps {
  campus: Campus;
  onBack: () => void;
}

export function CampusDetailSection({ campus, onBack }: CampusDetailSectionProps) {
  const [colleges, setColleges] = useState<College[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
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

      {colleges.map((college) => (
        <Card key={college.id} className="campus-detail-section__row">
          <p className="campus-detail-section__name">{college.name}</p>
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

      {addOpen && (
        <AddCollegeModal campusId={campus.id} onClose={() => setAddOpen(false)} onCreated={load} />
      )}
    </div>
  );
}

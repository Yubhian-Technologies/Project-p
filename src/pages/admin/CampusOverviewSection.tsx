import { useEffect, useState } from "react";
import { listCampuses } from "../../services/firebase/campuses";
import type { Campus } from "../../types/campus";
import { Card } from "../../components/common/Card";
import { CampusStaffList } from "./CampusStaffList";
import "./CampusOverviewSection.css";

export function CampusOverviewSection() {
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCampus, setSelectedCampus] = useState<Campus | null>(null);

  useEffect(() => {
    listCampuses().then((data) => {
      setCampuses(data);
      setLoading(false);
    });
  }, []);

  if (selectedCampus) {
    return <CampusStaffList campus={selectedCampus} onBack={() => setSelectedCampus(null)} />;
  }

  if (loading) return null;

  return (
    <div className="campus-overview">
      {campuses.length === 0 && <p>No campuses have been set up yet.</p>}

      {campuses.map((campus) => (
        <Card key={campus.id} className="campus-overview__row" onClick={() => setSelectedCampus(campus)}>
          <p className="campus-overview__name">{campus.name}</p>
          <span className="campus-overview__hint">View campus →</span>
        </Card>
      ))}
    </div>
  );
}

import { useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../../services/firebase/config";
import { listColleges } from "../../services/firebase/colleges";
import type { Campus } from "../../types/campus";
import type { College } from "../../types/college";
import type { UserProfile } from "../../types/user";
import { Card } from "../../components/common/Card";
import { Button } from "../../components/common/Button";
import { Select } from "../../components/common/Select";
import { ROLE_LABELS } from "../../config/roles";
import { CampusStaffAnalytics } from "./CampusStaffAnalytics";
import "./CampusStaffList.css";

interface CampusStaffListProps {
  campus: Campus;
  onBack: () => void;
}

export function CampusStaffList({ campus, onBack }: CampusStaffListProps) {
  const [staff, setStaff] = useState<UserProfile[]>([]);
  const [colleges, setColleges] = useState<College[]>([]);
  const [collegeFilter, setCollegeFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedStaff, setSelectedStaff] = useState<UserProfile | null>(null);

  useEffect(() => {
    async function load() {
      const q = query(collection(db, "users"), where("campusId", "==", campus.id));
      const [snapshot, collegeList] = await Promise.all([getDocs(q), listColleges(campus.id)]);
      setStaff(
        snapshot.docs
          .map((d) => d.data() as UserProfile)
          .filter((p) => p.role === "counsellor" || p.role === "head"),
      );
      setColleges(collegeList);
      setLoading(false);
    }
    load();
  }, [campus.id]);

  if (selectedStaff) {
    return <CampusStaffAnalytics staff={selectedStaff} onBack={() => setSelectedStaff(null)} />;
  }

  if (loading) return null;

  const filteredStaff = collegeFilter ? staff.filter((p) => p.collegeId === collegeFilter) : staff;

  return (
    <div className="campus-staff-list">
      <Button type="button" variant="outlined" onClick={onBack}>
        ← Back to Campuses
      </Button>

      <h3 className="campus-staff-list__heading">{campus.name} — Head &amp; Counsellors</h3>

      <div className="campus-staff-list__filter">
        <label htmlFor="staff-college-filter">College</label>
        <Select id="staff-college-filter" value={collegeFilter} onChange={setCollegeFilter}>
          <option value="">All colleges</option>
          {colleges.map((college) => (
            <option key={college.id} value={college.id}>
              {college.name}
            </option>
          ))}
        </Select>
      </div>

      {filteredStaff.length === 0 && (
        <p>
          {collegeFilter
            ? "No head or counsellors assigned to this college yet."
            : "No head or counsellors assigned to this campus yet."}
        </p>
      )}

      {filteredStaff.map((person) => (
        <Card key={person.uid} className="campus-staff-list__row" onClick={() => setSelectedStaff(person)}>
          <div>
            <p className="campus-staff-list__name">{person.displayName || person.email}</p>
            <p className="campus-staff-list__role">{ROLE_LABELS[person.role]}</p>
          </div>
          <span className="campus-staff-list__hint">View analytics →</span>
        </Card>
      ))}
    </div>
  );
}

import { useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../../../services/firebase/config";
import { listCampuses } from "../../../services/firebase/campuses";
import { listColleges } from "../../../services/firebase/colleges";
import type { Campus } from "../../../types/campus";
import type { College } from "../../../types/college";
import type { UserProfile } from "../../../types/user";
import { Card } from "../../../components/common/Card";
import { Select } from "../../../components/common/Select";
import { Modal } from "../../../components/common/Modal";
import { ROLE_LABELS } from "../../../config/roles";
import { StaffAnalyticsInline } from "./StaffAnalyticsInline";
import { GroupSessionsPanel } from "./GroupSessionsPanel";
import "./AnalyticsSection.css";

type Mode = "individual" | "group";

export function AnalyticsSection() {
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [campusId, setCampusId] = useState("");
  const [mode, setMode] = useState<Mode>("individual");

  const [staff, setStaff] = useState<UserProfile[]>([]);
  const [colleges, setColleges] = useState<College[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [selectedStaffForModal, setSelectedStaffForModal] = useState<UserProfile | null>(null);

  useEffect(() => {
    listCampuses().then(setCampuses);
  }, []);

  useEffect(() => {
    setSelectedStaffForModal(null);
    if (!campusId || mode !== "individual") return;
    setLoadingStaff(true);
    async function load() {
      const q = query(collection(db, "users"), where("campusId", "==", campusId));
      const [snapshot, collegeList] = await Promise.all([getDocs(q), listColleges(campusId)]);
      setStaff(
        snapshot.docs
          .map((d) => d.data() as UserProfile)
          .filter((p) => p.role === "counsellor" || p.role === "head"),
      );
      setColleges(collegeList);
      setLoadingStaff(false);
    }
    load();
  }, [campusId, mode]);

  return (
    <div className="analytics-section">
      <div className="analytics-section__field">
        <label htmlFor="analytics-campus">Campus</label>
        <Select id="analytics-campus" value={campusId} onChange={setCampusId}>
          <option value="" disabled>
            Select a campus…
          </option>
          {campuses.map((campus) => (
            <option key={campus.id} value={campus.id}>
              {campus.name}
            </option>
          ))}
        </Select>
      </div>

      {campusId && (
        <div className="analytics-section__tabs">
          <button
            type="button"
            className={`analytics-section__tab${mode === "individual" ? " analytics-section__tab--active" : ""}`}
            onClick={() => setMode("individual")}
          >
            Individual
          </button>
          <button
            type="button"
            className={`analytics-section__tab${mode === "group" ? " analytics-section__tab--active" : ""}`}
            onClick={() => setMode("group")}
          >
            Group Sessions
          </button>
        </div>
      )}

      {!campusId && <p>Select a campus to view analytics.</p>}

      {campusId && mode === "individual" && !loadingStaff && (
        <div className="analytics-section__list">
          {staff.length === 0 && <p>No head or counsellors assigned to this campus yet.</p>}
          {staff.map((person) => {
            const college = colleges.find((c) => c.id === person.collegeId);
            return (
              <Card
                key={person.uid}
                className="analytics-section__row"
                onClick={() => setSelectedStaffForModal(person)}
              >
                <div className="analytics-section__row-content">
                  <div>
                    <p className="analytics-section__name">{person.displayName || person.email}</p>
                    <p className="analytics-section__role">{ROLE_LABELS[person.role]}</p>
                    {college && <p className="analytics-section__college">{college.name}</p>}
                  </div>
                  <button
                    type="button"
                    className="analytics-section__btn-view"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedStaffForModal(person);
                    }}
                  >
                    View Analytics →
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {selectedStaffForModal && (
        <Modal
          title={`Analytics — ${selectedStaffForModal.displayName || selectedStaffForModal.email}`}
          onClose={() => setSelectedStaffForModal(null)}
          className="analytics-modal"
        >
          <StaffAnalyticsInline staff={selectedStaffForModal} />
        </Modal>
      )}

      {campusId && mode === "group" && <GroupSessionsPanel campusId={campusId} />}
    </div>
  );
}

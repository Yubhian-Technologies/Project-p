import { useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../../../services/firebase/config";
import { useAuth } from "../../../hooks/useAuth";
import { listCampuses } from "../../../services/firebase/campuses";
import { listColleges } from "../../../services/firebase/colleges";
import type { Campus } from "../../../types/campus";
import type { College } from "../../../types/college";
import type { UserProfile } from "../../../types/user";
import { useViewMore } from "../../../hooks/useViewMore";
import { Card } from "../../../components/common/Card";
import { Select } from "../../../components/common/Select";
import { Button } from "../../../components/common/Button";
import { Modal } from "../../../components/common/Modal";
import { ROLE_LABELS } from "../../../config/roles";
import { StaffAnalyticsInline } from "./StaffAnalyticsInline";
import "./AnalyticsSection.css";

export function AnalyticsSection() {
  const { profile } = useAuth();
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [campusId, setCampusId] = useState("");

  const [staff, setStaff] = useState<UserProfile[]>([]);
  const [colleges, setColleges] = useState<College[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [selectedStaffForModal, setSelectedStaffForModal] = useState<UserProfile | null>(null);

  // A campus-restricted Admin only ever sees their own assigned campuses here.
  const scopedCampusIds =
    profile?.role === "admin" && profile.adminAccess?.scope === "campuses"
      ? profile.adminAccess.campusIds ?? []
      : null;

  // When also narrowed to specific colleges, the staff list below is further
  // narrowed to just head/counsellors assigned to one of those colleges.
  const scopedCollegeIds =
    scopedCampusIds && profile?.role === "admin" && profile.adminAccess?.collegeIds?.length
      ? profile.adminAccess.collegeIds
      : null;

  useEffect(() => {
    listCampuses().then((c) => setCampuses(scopedCampusIds ? c.filter((campus) => scopedCampusIds.includes(campus.id)) : c));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setSelectedStaffForModal(null);
    if (!campusId) return;
    setLoadingStaff(true);
    async function load() {
      const q = query(collection(db, "users"), where("campusId", "==", campusId));
      const [snapshot, collegeList] = await Promise.all([getDocs(q), listColleges(campusId)]);
      setStaff(
        snapshot.docs
          .map((d) => d.data() as UserProfile)
          .filter((p) => p.role === "counsellor" || p.role === "head")
          .filter((p) => !scopedCollegeIds || (p.collegeId && scopedCollegeIds.includes(p.collegeId))),
      );
      setColleges(collegeList);
      setLoadingStaff(false);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campusId]);

  const { visible: visibleStaff, hiddenCount, showMore } = useViewMore(staff, 7);

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

      {!campusId && <p>Select a campus to view analytics.</p>}

      {campusId && !loadingStaff && (
        <div className="analytics-section__list">
          {staff.length === 0 && <p>No head or counsellors assigned to this campus yet.</p>}
          {visibleStaff.map((person) => {
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
          {hiddenCount > 0 && (
            <Button type="button" variant="outlined" style={{ alignSelf: "center" }} onClick={showMore}>
              View More ({hiddenCount} more)
            </Button>
          )}
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
    </div>
  );
}

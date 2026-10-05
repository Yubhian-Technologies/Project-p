import { useEffect, useState } from "react";
import { listCampuses } from "../../services/firebase/campuses";
import { listColleges } from "../../services/firebase/colleges";
import { listCampusLogins } from "../../services/firebase/firestore";
import { deleteCampusLogin, functionsErrorMessage } from "../../services/firebase/functions";
import type { Campus } from "../../types/campus";
import type { College } from "../../types/college";
import type { UserProfile } from "../../types/user";
import { Card } from "../../components/common/Card";
import { Button } from "../../components/common/Button";
import { Select } from "../../components/common/Select";
import { ROLE_LABELS } from "../../config/roles";
import { AddLoginModal } from "./AddLoginModal";
import { EditLoginModal } from "./EditLoginModal";
import "./LoginsManagementSection.css";

export function LoginsManagementSection() {
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [colleges, setColleges] = useState<College[]>([]);
  const [logins, setLogins] = useState<UserProfile[]>([]);
  const [campusId, setCampusId] = useState("");
  const [collegeId, setCollegeId] = useState("");
  const [loadingCampuses, setLoadingCampuses] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [editingLogin, setEditingLogin] = useState<UserProfile | null>(null);
  const [deletingUid, setDeletingUid] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    listCampuses().then((c) => {
      setCampuses(c);
      setLoadingCampuses(false);
    });
  }, []);

  async function loadForCampus(id: string) {
    const [c, l] = await Promise.all([listColleges(id), listCampusLogins(id)]);
    setColleges(c);
    setLogins(l);
  }

  useEffect(() => {
    if (!campusId) {
      setColleges([]);
      setLogins([]);
      setCollegeId("");
      return;
    }
    setCollegeId("");
    loadForCampus(campusId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campusId]);

  const visibleLogins = collegeId === "all" ? logins : collegeId ? logins.filter((l) => l.collegeId === collegeId) : [];

  async function handleDelete(uid: string) {
    setDeleteError(null);
    setDeletingUid(uid);
    try {
      await deleteCampusLogin(uid);
      await loadForCampus(campusId);
    } catch (err) {
      setDeleteError(functionsErrorMessage(err, "Could not delete this login. Please try again."));
    } finally {
      setDeletingUid(null);
    }
  }

  if (loadingCampuses) return null;

  return (
    <div className="logins-management">
      <div className="logins-management__header">
        <Button type="button" onClick={() => setAddOpen(true)}>
          + Add Login
        </Button>
      </div>

      <div className="logins-management__filters">
        <div className="logins-management__field">
          <label htmlFor="logins-campus">Campus</label>
          <Select id="logins-campus" value={campusId} onChange={setCampusId}>
            <option value="" disabled>
              Select a campus…
            </option>
            {campuses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="logins-management__field">
          <label htmlFor="logins-college">College</label>
          <Select id="logins-college" value={collegeId} onChange={setCollegeId} disabled={!campusId || colleges.length === 0}>
            <option value="" disabled>
              {!campusId ? "Select a campus first" : colleges.length === 0 ? "No colleges on this campus" : "Select a college…"}
            </option>
            {colleges.length > 0 && <option value="all">All Colleges</option>}
            {colleges.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {deleteError && <p className="logins-management__error">{deleteError}</p>}
      {!campusId && <p>Select a campus and college to view logins.</p>}
      {campusId && !collegeId && <p>Select a college to view its logins.</p>}
      {campusId && collegeId && visibleLogins.length === 0 && (
        <p>{collegeId === "all" ? "No logins on this campus yet." : "No logins for this college yet."}</p>
      )}

      {campusId &&
        collegeId &&
        visibleLogins.map((login) => (
          <Card key={login.uid} className="logins-management__row">
            <div>
              <p className="logins-management__name">{login.displayName || login.email}</p>
              <p className="logins-management__role">{ROLE_LABELS[login.role]}</p>
              {collegeId === "all" && (
                <p className="logins-management__college">
                  {colleges.find((c) => c.id === login.collegeId)?.name ?? "—"}
                </p>
              )}
            </div>
            <div className="logins-management__row-actions">
              <Button type="button" variant="outlined" onClick={() => setEditingLogin(login)}>
                Edit
              </Button>
              <Button
                type="button"
                variant="outlined"
                disabled={deletingUid === login.uid}
                onClick={() => handleDelete(login.uid)}
              >
                {deletingUid === login.uid ? "Deleting…" : "Delete login"}
              </Button>
            </div>
          </Card>
        ))}

      {addOpen && (
        <AddLoginModal
          defaultCampusId={campusId || undefined}
          defaultCollegeId={collegeId && collegeId !== "all" ? collegeId : undefined}
          onClose={() => setAddOpen(false)}
          onCreated={async () => {
            if (campusId) await loadForCampus(campusId);
          }}
        />
      )}

      {editingLogin && (
        <EditLoginModal
          login={editingLogin}
          colleges={colleges}
          hasOtherHead={logins.some((l) => l.role === "head" && l.uid !== editingLogin.uid)}
          onClose={() => setEditingLogin(null)}
          onSaved={() => loadForCampus(campusId)}
        />
      )}
    </div>
  );
}

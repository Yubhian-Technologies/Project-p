import { useEffect, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { listCampuses } from "../../services/firebase/campuses";
import { listColleges } from "../../services/firebase/colleges";
import { listCampusLogins } from "../../services/firebase/firestore";
import { deleteCampusLogin, functionsErrorMessage } from "../../services/firebase/functions";
import type { Campus } from "../../types/campus";
import type { College } from "../../types/college";
import type { UserProfile } from "../../types/user";
import { useViewMore } from "../../hooks/useViewMore";
import { Card } from "../../components/common/Card";
import { Button } from "../../components/common/Button";
import { Select } from "../../components/common/Select";
import { ROLE_LABELS } from "../../config/roles";
import { AddLoginModal } from "./AddLoginModal";
import { EditLoginModal } from "./EditLoginModal";
import "./LoginsManagementSection.css";

export function LoginsManagementSection() {
  const { profile } = useAuth();
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [colleges, setColleges] = useState<College[]>([]);
  const [logins, setLogins] = useState<UserProfile[]>([]);
  const [campusId, setCampusId] = useState("");
  const [loadingCampuses, setLoadingCampuses] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [editingLogin, setEditingLogin] = useState<UserProfile | null>(null);
  const [deletingUid, setDeletingUid] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // A campus-restricted Admin login only ever sees/picks their own assigned
  // campuses here — Super Admin and a global-scope Admin see every campus,
  // unchanged.
  const scopedCampusIds =
    profile?.role === "admin" && profile.adminAccess?.scope === "campuses"
      ? profile.adminAccess.campusIds ?? []
      : null;

  useEffect(() => {
    listCampuses().then((c) => {
      setCampuses(scopedCampusIds ? c.filter((campus) => scopedCampusIds.includes(campus.id)) : c);
      setLoadingCampuses(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      return;
    }
    loadForCampus(campusId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campusId]);

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

  const { visible: visibleLogins, hiddenCount, showMore } = useViewMore(logins);

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
      </div>

      {deleteError && <p className="logins-management__error">{deleteError}</p>}
      {!campusId && <p>Select a campus to view its logins.</p>}
      {campusId && logins.length === 0 && <p>No logins on this campus yet.</p>}

      {campusId &&
        visibleLogins.map((login) => (
          <Card key={login.uid} className="logins-management__row">
            <div>
              <p className="logins-management__name">
                {login.displayName || login.email}
                {login.active === false && <span className="logins-management__status-badge">Inactive</span>}
              </p>
              <p className="logins-management__role">{ROLE_LABELS[login.role]}</p>
              <p className="logins-management__college">
                {colleges.find((c) => c.id === login.collegeId)?.name ?? "—"}
              </p>
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

      {campusId && hiddenCount > 0 && (
        <Button type="button" variant="outlined" style={{ alignSelf: "center" }} onClick={showMore}>
          View More ({hiddenCount} more)
        </Button>
      )}

      {addOpen && (
        <AddLoginModal
          defaultCampusId={campusId || undefined}
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

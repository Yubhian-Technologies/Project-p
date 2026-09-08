import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../../services/firebase/config";
import { createCampusLogin } from "../../services/firebase/managedAccounts";
import { deleteCampusLogin, functionsErrorMessage } from "../../services/firebase/functions";
import { listColleges } from "../../services/firebase/colleges";
import type { Campus } from "../../types/campus";
import type { College } from "../../types/college";
import type { UserProfile } from "../../types/user";
import { Card } from "../../components/common/Card";
import { Button } from "../../components/common/Button";
import { Select } from "../../components/common/Select";
import { ROLE_LABELS } from "../../config/roles";
import { CampusCollegesSection } from "./CampusCollegesSection";
import { EditLoginModal } from "./EditLoginModal";
import "./CampusLoginsDetail.css";

interface CampusLoginsDetailProps {
  campus: Campus;
  onBack: () => void;
}

export function CampusLoginsDetail({ campus, onBack }: CampusLoginsDetailProps) {
  const [logins, setLogins] = useState<UserProfile[]>([]);
  const [colleges, setColleges] = useState<College[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<"counsellor" | "head">("counsellor");
  const [collegeId, setCollegeId] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [deletingUid, setDeletingUid] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [editingLogin, setEditingLogin] = useState<UserProfile | null>(null);

  async function load() {
    const q = query(collection(db, "users"), where("campusId", "==", campus.id));
    const snapshot = await getDocs(q);
    const staff = snapshot.docs
      .map((d) => d.data() as UserProfile)
      .filter((p) => p.role === "counsellor" || p.role === "head");
    setLogins(staff);
    setColleges(await listColleges(campus.id));
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [campus.id]);

  const hasHead = logins.some((l) => l.role === "head");

  async function handleAdd(event: FormEvent) {
    event.preventDefault();
    setAddError(null);
    setAdding(true);
    try {
      await createCampusLogin({
        email: email.trim(),
        password,
        displayName: displayName.trim(),
        role,
        campusId: campus.id,
        collegeId,
      });
      setEmail("");
      setPassword("");
      setDisplayName("");
      setRole("counsellor");
      setCollegeId("");
      await load();
    } catch (err) {
      setAddError(functionsErrorMessage(err, "Could not create the login. Please try again."));
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(uid: string) {
    setDeleteError(null);
    setDeletingUid(uid);
    try {
      await deleteCampusLogin(uid);
      await load();
    } catch (err) {
      setDeleteError(functionsErrorMessage(err, "Could not delete this login. Please try again."));
    } finally {
      setDeletingUid(null);
    }
  }

  if (loading) return null;

  return (
    <div className="campus-logins-detail">
      <Button type="button" variant="outlined" onClick={onBack}>
        ← Back to Campuses
      </Button>

      <h3 className="campus-logins-detail__heading">{campus.name} — Colleges</h3>

      <CampusCollegesSection campus={campus} colleges={colleges} onChange={load} />

      <h3 className="campus-logins-detail__heading">{campus.name} — Logins</h3>

      <Card className="campus-logins-detail__add-form">
        <p className="campus-logins-detail__form-title">+ Add Login</p>
        <form onSubmit={handleAdd}>
          <div className="campus-logins-detail__field">
            <label htmlFor="login-display-name">Display name</label>
            <input
              id="login-display-name"
              type="text"
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </div>
          <div className="campus-logins-detail__field">
            <label htmlFor="login-email">Email</label>
            <input id="login-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="campus-logins-detail__field">
            <label htmlFor="login-password">Password</label>
            <input
              id="login-password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div className="campus-logins-detail__field">
            <label htmlFor="login-role">Role</label>
            <Select id="login-role" value={role} onChange={(v) => setRole(v as "counsellor" | "head")}>
              <option value="counsellor">Counsellor</option>
              <option value="head" disabled={hasHead}>
                Head{hasHead ? " (already assigned)" : ""}
              </option>
            </Select>
          </div>
          <div className="campus-logins-detail__field">
            <label htmlFor="login-college">College</label>
            <Select
              id="login-college"
              disabled={colleges.length === 0}
              value={collegeId}
              onChange={setCollegeId}
            >
              <option value="" disabled>
                {colleges.length === 0 ? "Add a college first" : "Select a college…"}
              </option>
              {colleges.map((college) => (
                <option key={college.id} value={college.id}>
                  {college.name}
                </option>
              ))}
            </Select>
          </div>
          {addError && <p className="campus-logins-detail__error">{addError}</p>}
          <Button type="submit" disabled={adding || !collegeId}>
            {adding ? "Creating…" : "Create login"}
          </Button>
        </form>
      </Card>

      {deleteError && <p className="campus-logins-detail__error">{deleteError}</p>}

      {logins.length === 0 && <p>No logins created for this campus yet.</p>}

      {logins.map((login) => {
        const loginCollege = colleges.find((c) => c.id === login.collegeId);
        return (
          <Card key={login.uid} className="campus-logins-detail__row">
            <div>
              <p className="campus-logins-detail__name">{login.displayName || login.email}</p>
              <p className="campus-logins-detail__role">{ROLE_LABELS[login.role]}</p>
              {loginCollege && <p className="campus-logins-detail__college">{loginCollege.name}</p>}
            </div>
            <div className="campus-logins-detail__row-actions">
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
        );
      })}

      {editingLogin && (
        <EditLoginModal
          login={editingLogin}
          colleges={colleges}
          hasOtherHead={logins.some((l) => l.role === "head" && l.uid !== editingLogin.uid)}
          onClose={() => setEditingLogin(null)}
          onSaved={load}
        />
      )}
    </div>
  );
}

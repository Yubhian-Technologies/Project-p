import { useState } from "react";
import type { FormEvent } from "react";
import { Modal } from "../../components/common/Modal";
import { Button } from "../../components/common/Button";
import { Select } from "../../components/common/Select";
import { functionsErrorMessage, updateCampusLogin } from "../../services/firebase/functions";
import type { College } from "../../types/college";
import type { UserProfile } from "../../types/user";
import "./CampusLoginsDetail.css";

interface EditLoginModalProps {
  login: UserProfile;
  colleges: College[];
  hasOtherHead: boolean;
  onClose: () => void;
  onSaved: () => Promise<void>;
}

export function EditLoginModal({ login, colleges, hasOtherHead, onClose, onSaved }: EditLoginModalProps) {
  const [displayName, setDisplayName] = useState(login.displayName ?? "");
  const [email, setEmail] = useState(login.email);
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"counsellor" | "head">(login.role === "head" ? "head" : "counsellor");
  const [collegeId, setCollegeId] = useState(login.collegeId ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await updateCampusLogin({
        uid: login.uid,
        displayName: displayName.trim(),
        email: email.trim(),
        password: password || undefined,
        role,
        collegeId,
      });
      await onSaved();
      onClose();
    } catch (err) {
      setError(functionsErrorMessage(err, "Could not update this login. Please try again."));
      setSaving(false);
    }
  }

  return (
    <Modal title="Edit Login" onClose={onClose}>
      <form onSubmit={handleSubmit} className="campus-logins-detail__edit-form">
        <div className="campus-logins-detail__field">
          <label htmlFor="edit-display-name">Display name</label>
          <input
            id="edit-display-name"
            type="text"
            required
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </div>
        <div className="campus-logins-detail__field">
          <label htmlFor="edit-email">Email</label>
          <input id="edit-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="campus-logins-detail__field">
          <label htmlFor="edit-password">Password</label>
          <input
            id="edit-password"
            type="password"
            minLength={6}
            placeholder="Leave blank to keep current password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div className="campus-logins-detail__field">
          <label htmlFor="edit-role">Role</label>
          <Select id="edit-role" value={role} onChange={(v) => setRole(v as "counsellor" | "head")}>
            <option value="counsellor">Counsellor</option>
            <option value="head" disabled={hasOtherHead}>
              Head{hasOtherHead ? " (already assigned)" : ""}
            </option>
          </Select>
        </div>
        <div className="campus-logins-detail__field">
          <label htmlFor="edit-college">College</label>
          <Select id="edit-college" value={collegeId} onChange={setCollegeId}>
            <option value="" disabled>
              Select a college…
            </option>
            {colleges.map((college) => (
              <option key={college.id} value={college.id}>
                {college.name}
              </option>
            ))}
          </Select>
        </div>
        {error && <p className="campus-logins-detail__error">{error}</p>}
        <Button type="submit" disabled={saving || !collegeId}>
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </form>
    </Modal>
  );
}

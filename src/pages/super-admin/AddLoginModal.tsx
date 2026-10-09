import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Modal } from "../../components/common/Modal";
import { Button } from "../../components/common/Button";
import { Select } from "../../components/common/Select";
import { createCampusLogin } from "../../services/firebase/managedAccounts";
import { functionsErrorMessage } from "../../services/firebase/functions";
import { listCampuses } from "../../services/firebase/campuses";
import { listColleges } from "../../services/firebase/colleges";
import { listCampusLogins } from "../../services/firebase/firestore";
import type { Campus } from "../../types/campus";
import type { College } from "../../types/college";
import "./LoginsManagementSection.css";

interface AddLoginModalProps {
  defaultCampusId?: string;
  defaultCollegeId?: string;
  // When set, this login can only be created in one of these colleges — the
  // College dropdown below is narrowed to just them. Used for a college-scoped
  // Admin; Super Admin and a campus-only (not college-narrowed) Admin pass
  // nothing here and see every college on the campus, unchanged.
  allowedCollegeIds?: string[];
  onClose: () => void;
  onCreated: () => Promise<void>;
}

export function AddLoginModal({
  defaultCampusId,
  defaultCollegeId,
  allowedCollegeIds,
  onClose,
  onCreated,
}: AddLoginModalProps) {
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [colleges, setColleges] = useState<College[]>([]);
  const [campusId, setCampusId] = useState(defaultCampusId ?? "");
  const [collegeId, setCollegeId] = useState(defaultCollegeId ?? "");
  const [hasHead, setHasHead] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"counsellor" | "head">("counsellor");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listCampuses().then(setCampuses);
  }, []);

  useEffect(() => {
    if (!campusId) {
      setColleges([]);
      setHasHead(false);
      return;
    }
    listColleges(campusId).then(setColleges);
    listCampusLogins(campusId).then((logins) => setHasHead(logins.some((l) => l.role === "head")));
  }, [campusId]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await createCampusLogin({
        email: email.trim(),
        password,
        displayName: displayName.trim(),
        role,
        campusId,
        collegeId,
      });
      await onCreated();
      onClose();
    } catch (err) {
      setError(functionsErrorMessage(err, "Could not create the login. Please try again."));
      setSaving(false);
    }
  }

  const collegeOptions = allowedCollegeIds
    ? colleges.filter((c) => allowedCollegeIds.includes(c.id))
    : colleges;

  return (
    <Modal title="Add Login" onClose={onClose}>
      <form onSubmit={handleSubmit} className="logins-management__form">
        <div className="logins-management__field">
          <label htmlFor="add-login-campus">Campus</label>
          {defaultCampusId ? (
            <p className="logins-management__fixed-value">
              {campuses.find((c) => c.id === campusId)?.name ?? "…"}
            </p>
          ) : (
            <Select
              id="add-login-campus"
              value={campusId}
              onChange={(v) => {
                setCampusId(v);
                setCollegeId("");
              }}
            >
              <option value="" disabled>
                Select a campus…
              </option>
              {campuses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          )}
        </div>
        <div className="logins-management__field">
          <label htmlFor="add-login-college">College</label>
          <Select id="add-login-college" value={collegeId} onChange={setCollegeId} disabled={!campusId || collegeOptions.length === 0}>
            <option value="" disabled>
              {!campusId ? "Select a campus first" : collegeOptions.length === 0 ? "Add a college first" : "Select a college…"}
            </option>
            {collegeOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="logins-management__field">
          <label htmlFor="add-login-display-name">Display name</label>
          <input
            id="add-login-display-name"
            type="text"
            autoComplete="off"
            required
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </div>
        <div className="logins-management__field">
          <label htmlFor="add-login-email">Email</label>
          <input
            id="add-login-email"
            type="email"
            autoComplete="off"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="logins-management__field">
          <label htmlFor="add-login-password">Password</label>
          {/* Plain text, not masked — this is a shared default password the
              admin is typing/handing out, not a secret they're entering for
              themselves, so there's nothing to hide it from. autoComplete
              "new-password" stops the browser from offering to fill in one
              of the admin's own saved passwords here. */}
          <input
            id="add-login-password"
            type="text"
            autoComplete="new-password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div className="logins-management__field">
          <label htmlFor="add-login-role">Role</label>
          <Select id="add-login-role" value={role} onChange={(v) => setRole(v as "counsellor" | "head")}>
            <option value="counsellor">Counsellor</option>
            <option value="head" disabled={hasHead}>
              Head{hasHead ? " (already assigned)" : ""}
            </option>
          </Select>
        </div>
        {error && <p className="logins-management__error">{error}</p>}
        <Button type="submit" disabled={saving || !campusId || !collegeId}>
          {saving ? "Creating…" : "Create login"}
        </Button>
      </form>
    </Modal>
  );
}

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Modal } from "../common/Modal";
import { Button } from "../common/Button";
import { Select } from "../common/Select";
import { createStudentLogin } from "../../services/firebase/managedAccounts";
import { functionsErrorMessage } from "../../services/firebase/functions";
import { listColleges } from "../../services/firebase/colleges";
import type { College } from "../../types/college";
import "./ImportLoginsModal.css";

interface AddStudentModalProps {
  campusId: string;
  onClose: () => void;
  onCreated: () => Promise<void>;
}

const GENDER_OPTIONS = ["Male", "Female", "Other", "Prefer not to say"];

/** Creates a single student ("user" role) login — the one-at-a-time
    counterpart to ImportLoginsModal's bulk spreadsheet import. Used from
    both the Head's Profile page and Super Admin's Users section. */
export function AddStudentModal({ campusId, onClose, onCreated }: AddStudentModalProps) {
  const [colleges, setColleges] = useState<College[]>([]);
  const [collegeId, setCollegeId] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [studentOrProfessional, setStudentOrProfessional] = useState<"student" | "professional">("student");
  const [yearOrBatch, setYearOrBatch] = useState("");
  const [branch, setBranch] = useState("");
  const [gender, setGender] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listColleges(campusId).then(setColleges);
  }, [campusId]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await createStudentLogin({
        email: email.trim(),
        password: password.trim() || undefined,
        collegeId,
        studentOrProfessional,
        yearOrBatch: yearOrBatch.trim() || undefined,
        branch: branch.trim() || undefined,
        gender: gender || undefined,
      });
      await onCreated();
      onClose();
    } catch (err) {
      setError(functionsErrorMessage(err, "Could not create this login. Please try again."));
      setSaving(false);
    }
  }

  return (
    <Modal title="Add User" onClose={onClose}>
      <form onSubmit={handleSubmit} className="import-logins-modal__step">
        <div className="import-logins-modal__field">
          <label htmlFor="add-student-email">Email</label>
          <input
            id="add-student-email"
            type="email"
            autoComplete="off"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="import-logins-modal__field">
          <label htmlFor="add-student-password">Password (optional)</label>
          {/* Plain text, not masked — same reasoning as AddLoginModal: this is
              a password the creator is handing out, not one they're keeping
              secret from themselves. Left blank, it defaults to 123456, same
              as the bulk import. */}
          <input
            id="add-student-password"
            type="text"
            autoComplete="new-password"
            minLength={6}
            placeholder="Leave blank to use the default (123456)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div className="import-logins-modal__field">
          <label htmlFor="add-student-college">College</label>
          <Select id="add-student-college" value={collegeId} onChange={setCollegeId} disabled={colleges.length === 0}>
            <option value="" disabled>
              {colleges.length === 0 ? "Add a college first" : "Select a college…"}
            </option>
            {colleges.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="import-logins-modal__field">
          <label htmlFor="add-student-occupation">Student / Professional</label>
          <Select
            id="add-student-occupation"
            value={studentOrProfessional}
            onChange={(v) => setStudentOrProfessional(v as "student" | "professional")}
          >
            <option value="student">Student</option>
            <option value="professional">Working professional</option>
          </Select>
        </div>
        <div className="import-logins-modal__field">
          <label htmlFor="add-student-year">Year / Batch (optional)</label>
          <input
            id="add-student-year"
            type="text"
            placeholder="e.g. 2nd Year"
            value={yearOrBatch}
            onChange={(e) => setYearOrBatch(e.target.value)}
          />
        </div>
        <div className="import-logins-modal__field">
          <label htmlFor="add-student-branch">Branch (optional)</label>
          <input
            id="add-student-branch"
            type="text"
            placeholder="e.g. CSE"
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
          />
        </div>
        <div className="import-logins-modal__field">
          <label htmlFor="add-student-gender">Gender (optional)</label>
          <Select id="add-student-gender" value={gender} onChange={setGender}>
            <option value="">—</option>
            {GENDER_OPTIONS.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </Select>
        </div>
        {error && <p className="import-logins-modal__error">{error}</p>}
        <Button type="submit" disabled={saving || !email.trim() || !collegeId}>
          {saving ? "Creating…" : "Create login"}
        </Button>
      </form>
    </Modal>
  );
}

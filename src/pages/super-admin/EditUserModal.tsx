import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Modal } from "../../components/common/Modal";
import { Button } from "../../components/common/Button";
import { Select } from "../../components/common/Select";
import { listColleges } from "../../services/firebase/colleges";
import { updateUserAccount } from "../../services/firebase/firestore";
import type { Campus } from "../../types/campus";
import type { College } from "../../types/college";
import type { UserProfile } from "../../types/user";
import "./LoginForms.css";

interface EditUserModalProps {
  user: UserProfile;
  campuses: Campus[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}

export function EditUserModal({ user, campuses, onClose, onSaved }: EditUserModalProps) {
  const [displayName, setDisplayName] = useState(user.displayName ?? "");
  const [studentOrProfessional, setStudentOrProfessional] = useState<"student" | "professional">(
    user.studentOrProfessional ?? "student",
  );
  const [whatsappNumber, setWhatsappNumber] = useState(user.whatsappNumber ?? "");
  const [registerNumber, setRegisterNumber] = useState(user.registerNumber ?? "");
  const [yearOrBatch, setYearOrBatch] = useState(user.yearOrBatch ?? "");
  const [admissionType, setAdmissionType] = useState<"" | "regular" | "lateral">(user.admissionType ?? "");
  const [branch, setBranch] = useState(user.branch ?? "");
  const [gender, setGender] = useState(user.gender ?? "");
  const [campusId, setCampusId] = useState(user.campusId ?? "");
  const [collegeId, setCollegeId] = useState(user.collegeId ?? "");
  const [colleges, setColleges] = useState<College[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!campusId) {
      setColleges([]);
      return;
    }
    listColleges(campusId).then(setColleges);
  }, [campusId]);

  function handleCampusChange(id: string) {
    setCampusId(id);
    setCollegeId("");
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await updateUserAccount(user.uid, {
        displayName: displayName.trim(),
        studentOrProfessional,
        whatsappNumber: whatsappNumber.trim(),
        registerNumber: registerNumber.trim(),
        yearOrBatch: yearOrBatch.trim(),
        admissionType: admissionType,
        branch: branch.trim(),
        gender,
        campusId,
        collegeId,
      });
      await onSaved();
      onClose();
    } catch {
      setError("Could not update this account. Please try again.");
      setSaving(false);
    }
  }

  return (
    <Modal title="Edit User" onClose={onClose}>
      <form onSubmit={handleSubmit} className="campus-logins-detail__edit-form">
        <div className="campus-logins-detail__field">
          <label htmlFor="edit-user-display-name">Display name</label>
          <input
            id="edit-user-display-name"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </div>
        <div className="campus-logins-detail__field">
          <label htmlFor="edit-user-email">Email</label>
          <input id="edit-user-email" type="email" value={user.email} disabled />
        </div>
        <div className="campus-logins-detail__field">
          <label htmlFor="edit-user-type">Student / Professional</label>
          <Select
            id="edit-user-type"
            value={studentOrProfessional}
            onChange={(v) => setStudentOrProfessional(v as "student" | "professional")}
          >
            <option value="student">Student</option>
            <option value="professional">Professional</option>
          </Select>
        </div>
        {studentOrProfessional === "student" && (
          <div className="campus-logins-detail__field">
            <label htmlFor="edit-user-register-number">Register number</label>
            <input
              id="edit-user-register-number"
              type="text"
              value={registerNumber}
              onChange={(e) => setRegisterNumber(e.target.value)}
            />
          </div>
        )}
        <div className="campus-logins-detail__field">
          <label htmlFor="edit-user-whatsapp">WhatsApp number</label>
          <input
            id="edit-user-whatsapp"
            type="text"
            value={whatsappNumber}
            onChange={(e) => setWhatsappNumber(e.target.value)}
          />
        </div>
        {studentOrProfessional === "student" && (
          <>
            <div className="campus-logins-detail__field">
              <label htmlFor="edit-user-year">Batch</label>
              <input
                id="edit-user-year"
                type="text"
                placeholder="e.g. 2nd Year"
                value={yearOrBatch}
                onChange={(e) => setYearOrBatch(e.target.value)}
              />
            </div>
            <div className="campus-logins-detail__field">
              <label htmlFor="edit-user-admission-type">Regular / Lateral</label>
              <Select
                id="edit-user-admission-type"
                value={admissionType}
                onChange={(v) => setAdmissionType(v as "" | "regular" | "lateral")}
              >
                <option value="">—</option>
                <option value="regular">Regular</option>
                <option value="lateral">Lateral</option>
              </Select>
            </div>
            <div className="campus-logins-detail__field">
              <label htmlFor="edit-user-branch">Branch</label>
              <input
                id="edit-user-branch"
                type="text"
                placeholder="e.g. CSE"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
              />
            </div>
          </>
        )}
        <div className="campus-logins-detail__field">
          <label htmlFor="edit-user-gender">Gender</label>
          <Select id="edit-user-gender" value={gender} onChange={setGender}>
            <option value="">—</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
            <option value="Other">Other</option>
            <option value="Prefer not to say">Prefer not to say</option>
          </Select>
        </div>
        <div className="campus-logins-detail__field">
          <label htmlFor="edit-user-campus">Campus</label>
          <Select id="edit-user-campus" value={campusId} onChange={handleCampusChange}>
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
        <div className="campus-logins-detail__field">
          <label htmlFor="edit-user-college">College</label>
          <Select id="edit-user-college" value={collegeId} onChange={setCollegeId} disabled={!campusId}>
            <option value="" disabled>
              {campusId ? "Select a college…" : "Select a campus first"}
            </option>
            {colleges.map((college) => (
              <option key={college.id} value={college.id}>
                {college.name}
              </option>
            ))}
          </Select>
        </div>
        {error && <p className="campus-logins-detail__error">{error}</p>}
        <Button type="submit" disabled={saving || !campusId || !collegeId}>
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </form>
    </Modal>
  );
}

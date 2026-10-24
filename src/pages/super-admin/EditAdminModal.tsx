import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Modal } from "../../components/common/Modal";
import { Button } from "../../components/common/Button";
import { Select } from "../../components/common/Select";
import { MultiSelect } from "../../components/common/MultiSelect";
import { updateAdminLogin } from "../../services/firebase/managedAccounts";
import { functionsErrorMessage } from "../../services/firebase/functions";
import { listCampuses } from "../../services/firebase/campuses";
import { listColleges } from "../../services/firebase/colleges";
import { ADMIN_SECTIONS, ADMIN_DESIGNATIONS } from "../../config/roles";
import type { Campus } from "../../types/campus";
import type { College } from "../../types/college";
import type { AdminDesignation, AdminSectionId, UserProfile } from "../../types/user";
import "./LoginsManagementSection.css";
import "./AdminsManagementSection.css";

interface EditAdminModalProps {
  admin: UserProfile;
  onClose: () => void;
  onSaved: () => Promise<void>;
}

export function EditAdminModal({ admin, onClose, onSaved }: EditAdminModalProps) {
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [colleges, setColleges] = useState<College[]>([]);
  const [displayName, setDisplayName] = useState(admin.displayName ?? "");
  const [email, setEmail] = useState(admin.email);
  const [password, setPassword] = useState("");
  const [scope, setScope] = useState<"global" | "campuses">(admin.adminAccess?.scope ?? "global");
  const [designation, setDesignation] = useState<"" | AdminDesignation>(admin.adminAccess?.designation ?? "");
  const [campusIds, setCampusIds] = useState<string[]>(admin.adminAccess?.campusIds ?? []);
  const [collegeIds, setCollegeIds] = useState<string[]>(admin.adminAccess?.collegeIds ?? []);
  const [sections, setSections] = useState<AdminSectionId[]>(
    admin.adminAccess?.sections ?? ADMIN_SECTIONS.map((s) => s.id),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listCampuses().then(setCampuses);
  }, []);

  // Colleges offered are only those under the currently-selected campus(es);
  // dropping a campus also drops any of its colleges that were picked.
  useEffect(() => {
    if (campusIds.length === 0) {
      setColleges([]);
      setCollegeIds([]);
      return;
    }
    Promise.all(campusIds.map((id) => listColleges(id))).then((lists) => {
      const flat = lists.flat();
      setColleges(flat);
      setCollegeIds((prev) => prev.filter((id) => flat.some((c) => c.id === id)));
    });
  }, [campusIds]);

  function handleScopeChange(value: string) {
    const next = value as "global" | "campuses";
    setScope(next);
    if (next === "campuses") {
      setSections((prev) => prev.filter((s) => s !== "campuses"));
    } else {
      setCampusIds([]);
      setCollegeIds([]);
    }
  }

  function toggleSection(id: AdminSectionId) {
    setSections((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  }

  // Consolidated Reports is a campus-wide roll-up that can span several
  // colleges — out of scope for a Principal/VP, who only ever oversees one
  // college, so it's dropped the moment that designation is picked (mirrors
  // handleScopeChange dropping "campuses" above).
  function handleDesignationChange(value: string) {
    const next = value as "" | AdminDesignation;
    setDesignation(next);
    if (next === "administration" && scope === "global") {
      handleScopeChange("campuses");
    }
    if (next === "principal" || next === "vice-principal") {
      setSections((prev) => prev.filter((s) => s !== "monthly-reports"));
    }
  }

  const isPrincipalOrVp = designation === "principal" || designation === "vice-principal";
  const isAdministration = designation === "administration";

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await updateAdminLogin({
        uid: admin.uid,
        displayName: displayName.trim(),
        email: email.trim(),
        password: password || undefined,
        adminAccess: {
          scope,
          ...(designation ? { designation } : {}),
          ...(scope === "campuses" ? { campusIds, ...(collegeIds.length > 0 ? { collegeIds } : {}) } : {}),
          sections,
        },
      });
      await onSaved();
      onClose();
    } catch (err) {
      setError(functionsErrorMessage(err, "Could not update this admin login. Please try again."));
      setSaving(false);
    }
  }

  const campusOptions = campuses.map((c) => ({ value: c.id, label: c.name }));
  const campusNameById = new Map(campuses.map((c) => [c.id, c.name]));
  const collegeOptions = colleges.map((c) => ({
    value: c.id,
    label: campusIds.length > 1 ? `${c.name} (${campusNameById.get(c.campusId) ?? "?"})` : c.name,
  }));
  const canSubmit =
    !saving &&
    (scope === "global" || (campusIds.length > 0 && collegeIds.length > 0)) &&
    (!isAdministration || (scope === "campuses" && campusIds.length > 0 && collegeIds.length > 0)) &&
    sections.length > 0;

  return (
    <Modal title="Edit Admin" onClose={onClose}>
      <form onSubmit={handleSubmit} className="logins-management__form">
        <div className="logins-management__field">
          <label htmlFor="edit-admin-display-name">Display name</label>
          <input
            id="edit-admin-display-name"
            type="text"
            required
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </div>
        <div className="logins-management__field">
          <label htmlFor="edit-admin-email">Email</label>
          <input
            id="edit-admin-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="logins-management__field">
          <label htmlFor="edit-admin-password">Password</label>
          <input
            id="edit-admin-password"
            type="password"
            minLength={6}
            placeholder="Leave blank to keep current password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div className="logins-management__field">
          <label htmlFor="edit-admin-designation">Designation (optional)</label>
          <Select
            id="edit-admin-designation"
            value={designation}
            onChange={handleDesignationChange}
          >
            <option value="">—</option>
            {ADMIN_DESIGNATIONS.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="logins-management__field">
          <label htmlFor="edit-admin-scope">Access</label>
          <Select id="edit-admin-scope" value={scope} onChange={handleScopeChange}>
            <option value="global" disabled={isAdministration}>Global — all campuses</option>
            <option value="campuses">Specific campuses</option>
          </Select>
        </div>
        {scope === "campuses" && (
          <div className="logins-management__field">
            <label htmlFor="edit-admin-campuses">Campuses</label>
            <MultiSelect
              id="edit-admin-campuses"
              options={campusOptions}
              selected={campusIds}
              onChange={setCampusIds}
              placeholder="Select campus(es)…"
            />
          </div>
        )}
        {scope === "campuses" && campusIds.length > 0 && (
          <div className="logins-management__field">
            <label htmlFor="edit-admin-colleges">
              {isAdministration ? "Assigned college(s) — required" : "Colleges"}
            </label>
            <MultiSelect
              id="edit-admin-colleges"
              options={collegeOptions}
              selected={collegeIds}
              onChange={setCollegeIds}
              placeholder="Select the college(s) this admin oversees…"
            />
            {(collegeIds.length > 0 || isAdministration) && (
              <p className="logins-management__hint">
                {isAdministration
                  ? "Consolidated reports and campus rankings are campus-level, read-only views. At least one college assignment is required for the Principal-style college dashboard."
                  : "Can only manage (create/edit/delete) counsellor &amp; head logins for these colleges; Analytics, Events, and Counsellor Worksheet are also narrowed to just these colleges. Logins for other colleges on the same campus stay visible, just not editable."}
              </p>
            )}
          </div>
        )}
        <div className="logins-management__field">
          <span>Visible sections</span>
          <div className="admins-management__section-checklist">
            {ADMIN_SECTIONS.map((section) => (
              <label key={section.id} className="admins-management__section-checkbox">
                <input
                  type="checkbox"
                  checked={sections.includes(section.id)}
                  disabled={
                    (section.id === "campuses" && scope === "campuses") ||
                    (section.id === "monthly-reports" && isPrincipalOrVp)
                  }
                  onChange={() => toggleSection(section.id)}
                />
                {section.label}
              </label>
            ))}
          </div>
        </div>
        {error && <p className="logins-management__error">{error}</p>}
        <Button type="submit" disabled={!canSubmit}>
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </form>
    </Modal>
  );
}

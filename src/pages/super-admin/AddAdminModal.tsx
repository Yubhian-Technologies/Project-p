import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Modal } from "../../components/common/Modal";
import { Button } from "../../components/common/Button";
import { Select } from "../../components/common/Select";
import { MultiSelect } from "../../components/common/MultiSelect";
import { createAdminLogin } from "../../services/firebase/managedAccounts";
import { functionsErrorMessage } from "../../services/firebase/functions";
import { listCampuses } from "../../services/firebase/campuses";
import { listColleges } from "../../services/firebase/colleges";
import { ADMIN_SECTIONS } from "../../config/roles";
import type { Campus } from "../../types/campus";
import type { College } from "../../types/college";
import type { AdminSectionId } from "../../types/user";
import "./LoginsManagementSection.css";
import "./AdminsManagementSection.css";

interface AddAdminModalProps {
  onClose: () => void;
  onCreated: () => Promise<void>;
}

export function AddAdminModal({ onClose, onCreated }: AddAdminModalProps) {
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [colleges, setColleges] = useState<College[]>([]);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [scope, setScope] = useState<"global" | "campuses">("global");
  const [campusIds, setCampusIds] = useState<string[]>([]);
  const [collegeIds, setCollegeIds] = useState<string[]>([]);
  const [sections, setSections] = useState<AdminSectionId[]>(ADMIN_SECTIONS.map((s) => s.id));
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

  // Campus Management can only ever be granted to a global-scope admin —
  // switching to "Specific campuses" drops it from whatever was checked.
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

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await createAdminLogin({
        email: email.trim(),
        password,
        displayName: displayName.trim(),
        adminAccess: {
          scope,
          ...(scope === "campuses" ? { campusIds, ...(collegeIds.length > 0 ? { collegeIds } : {}) } : {}),
          sections,
        },
      });
      await onCreated();
      onClose();
    } catch (err) {
      setError(functionsErrorMessage(err, "Could not create the admin login. Please try again."));
      setSaving(false);
    }
  }

  const campusOptions = campuses.map((c) => ({ value: c.id, label: c.name }));
  const campusNameById = new Map(campuses.map((c) => [c.id, c.name]));
  const collegeOptions = colleges.map((c) => ({
    value: c.id,
    label: campusIds.length > 1 ? `${c.name} (${campusNameById.get(c.campusId) ?? "?"})` : c.name,
  }));
  const canSubmit = !saving && (scope === "global" || campusIds.length > 0) && sections.length > 0;

  return (
    <Modal title="Add Admin" onClose={onClose}>
      <form onSubmit={handleSubmit} className="logins-management__form">
        <div className="logins-management__field">
          <label htmlFor="add-admin-display-name">Display name</label>
          <input
            id="add-admin-display-name"
            type="text"
            autoComplete="off"
            required
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </div>
        <div className="logins-management__field">
          <label htmlFor="add-admin-email">Email</label>
          <input
            id="add-admin-email"
            type="email"
            autoComplete="off"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="logins-management__field">
          <label htmlFor="add-admin-password">Password</label>
          <input
            id="add-admin-password"
            type="text"
            autoComplete="new-password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div className="logins-management__field">
          <label htmlFor="add-admin-scope">Access</label>
          <Select id="add-admin-scope" value={scope} onChange={handleScopeChange}>
            <option value="global">Global — all campuses</option>
            <option value="campuses">Specific campuses</option>
          </Select>
        </div>
        {scope === "campuses" && (
          <div className="logins-management__field">
            <label htmlFor="add-admin-campuses">Campuses</label>
            <MultiSelect
              id="add-admin-campuses"
              options={campusOptions}
              selected={campusIds}
              onChange={setCampusIds}
              placeholder="Select campus(es)…"
            />
          </div>
        )}
        {scope === "campuses" && campusIds.length > 0 && (
          <div className="logins-management__field">
            <label htmlFor="add-admin-colleges">Colleges (optional)</label>
            <MultiSelect
              id="add-admin-colleges"
              options={collegeOptions}
              selected={collegeIds}
              onChange={setCollegeIds}
              placeholder="Leave blank for every college on these campuses…"
            />
            {collegeIds.length > 0 && (
              <p className="logins-management__hint">
                Can only manage (create/edit/delete) counsellor &amp; head logins for these colleges; Analytics,
                Events, and Counsellor Worksheet are also narrowed to just these colleges. Logins for other
                colleges on the same campus stay visible, just not editable.
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
                  disabled={section.id === "campuses" && scope === "campuses"}
                  onChange={() => toggleSection(section.id)}
                />
                {section.label}
              </label>
            ))}
          </div>
        </div>
        {error && <p className="logins-management__error">{error}</p>}
        <Button type="submit" disabled={!canSubmit}>
          {saving ? "Creating…" : "Create admin"}
        </Button>
      </form>
    </Modal>
  );
}

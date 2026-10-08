import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Modal } from "../../components/common/Modal";
import { Button } from "../../components/common/Button";
import { Select } from "../../components/common/Select";
import { MultiSelect } from "../../components/common/MultiSelect";
import { updateAdminLogin } from "../../services/firebase/managedAccounts";
import { functionsErrorMessage } from "../../services/firebase/functions";
import { listCampuses } from "../../services/firebase/campuses";
import { ADMIN_SECTIONS } from "../../config/roles";
import type { Campus } from "../../types/campus";
import type { AdminSectionId, UserProfile } from "../../types/user";
import "./LoginsManagementSection.css";
import "./AdminsManagementSection.css";

interface EditAdminModalProps {
  admin: UserProfile;
  onClose: () => void;
  onSaved: () => Promise<void>;
}

export function EditAdminModal({ admin, onClose, onSaved }: EditAdminModalProps) {
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [displayName, setDisplayName] = useState(admin.displayName ?? "");
  const [email, setEmail] = useState(admin.email);
  const [password, setPassword] = useState("");
  const [scope, setScope] = useState<"global" | "campuses">(admin.adminAccess?.scope ?? "global");
  const [campusIds, setCampusIds] = useState<string[]>(admin.adminAccess?.campusIds ?? []);
  const [sections, setSections] = useState<AdminSectionId[]>(
    admin.adminAccess?.sections ?? ADMIN_SECTIONS.map((s) => s.id),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listCampuses().then(setCampuses);
  }, []);

  function handleScopeChange(value: string) {
    const next = value as "global" | "campuses";
    setScope(next);
    if (next === "campuses") {
      setSections((prev) => prev.filter((s) => s !== "campuses"));
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
      await updateAdminLogin({
        uid: admin.uid,
        displayName: displayName.trim(),
        email: email.trim(),
        password: password || undefined,
        adminAccess: {
          scope,
          ...(scope === "campuses" ? { campusIds } : {}),
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
  const canSubmit = !saving && (scope === "global" || campusIds.length > 0) && sections.length > 0;

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
          <label htmlFor="edit-admin-scope">Access</label>
          <Select id="edit-admin-scope" value={scope} onChange={handleScopeChange}>
            <option value="global">Global — all campuses</option>
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
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </form>
    </Modal>
  );
}

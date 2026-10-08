import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Modal } from "../../components/common/Modal";
import { Button } from "../../components/common/Button";
import { Select } from "../../components/common/Select";
import { MultiSelect } from "../../components/common/MultiSelect";
import { createAdminLogin } from "../../services/firebase/managedAccounts";
import { functionsErrorMessage } from "../../services/firebase/functions";
import { listCampuses } from "../../services/firebase/campuses";
import { ADMIN_SECTIONS } from "../../config/roles";
import type { Campus } from "../../types/campus";
import type { AdminSectionId } from "../../types/user";
import "./LoginsManagementSection.css";
import "./AdminsManagementSection.css";

interface AddAdminModalProps {
  onClose: () => void;
  onCreated: () => Promise<void>;
}

export function AddAdminModal({ onClose, onCreated }: AddAdminModalProps) {
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [scope, setScope] = useState<"global" | "campuses">("global");
  const [campusIds, setCampusIds] = useState<string[]>([]);
  const [sections, setSections] = useState<AdminSectionId[]>(ADMIN_SECTIONS.map((s) => s.id));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listCampuses().then(setCampuses);
  }, []);

  // Campus Management can only ever be granted to a global-scope admin —
  // switching to "Specific campuses" drops it from whatever was checked.
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
      await createAdminLogin({
        email: email.trim(),
        password,
        displayName: displayName.trim(),
        adminAccess: {
          scope,
          ...(scope === "campuses" ? { campusIds } : {}),
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

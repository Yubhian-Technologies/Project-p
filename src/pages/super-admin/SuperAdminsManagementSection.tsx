import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { listUsersByRole } from "../../services/firebase/firestore";
import { createSuperAdminLogin } from "../../services/firebase/managedAccounts";
import { functionsErrorMessage } from "../../services/firebase/functions";
import type { UserProfile } from "../../types/user";
import { Card } from "../../components/common/Card";
import { Button } from "../../components/common/Button";
import { Modal } from "../../components/common/Modal";
import "./LoginsManagementSection.css";

export function SuperAdminsManagementSection() {
  const [accounts, setAccounts] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      setAccounts(await listUsersByRole("super-admin"));
      setError(null);
    } catch {
      setError("Could not load Super Admin accounts. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  return (
    <div className="logins-management">
      <div className="logins-management__header">
        <p className="logins-management__hint">All Super Admin accounts have the same global access to the shared platform data.</p>
        <Button type="button" onClick={() => setAddOpen(true)}>+ Add Super Admin</Button>
      </div>
      {error && <p className="logins-management__error">{error}</p>}
      {loading ? <p>Loading Super Admin accounts…</p> : accounts.length === 0 ? (
        <p>No Super Admin accounts found.</p>
      ) : accounts.map((account) => (
        <Card key={account.uid} className="logins-management__row">
          <div>
            <p className="logins-management__name">{account.displayName || account.email}</p>
            <p className="logins-management__role">{account.email}</p>
            <p className="logins-management__college">Global access · shared platform data</p>
          </div>
        </Card>
      ))}
      {addOpen && <AddSuperAdminModal onClose={() => setAddOpen(false)} onCreated={load} />}
    </div>
  );
}

function AddSuperAdminModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => Promise<void> }) {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await createSuperAdminLogin({ displayName: displayName.trim(), email: email.trim(), password });
      await onCreated();
      onClose();
    } catch (err) {
      setError(functionsErrorMessage(err, "Could not create the Super Admin login. Please try again."));
      setSaving(false);
    }
  }

  return (
    <Modal title="Add Super Admin" onClose={onClose}>
      <form onSubmit={submit} className="logins-management__form">
        <p className="logins-management__hint">This creates a separate login with the same global access and shared data as existing Super Admins.</p>
        <div className="logins-management__field">
          <label htmlFor="new-super-admin-name">Display name</label>
          <input id="new-super-admin-name" autoComplete="off" required value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
        </div>
        <div className="logins-management__field">
          <label htmlFor="new-super-admin-email">Email</label>
          <input id="new-super-admin-email" type="email" autoComplete="off" required value={email} onChange={(event) => setEmail(event.target.value)} />
        </div>
        <div className="logins-management__field">
          <label htmlFor="new-super-admin-password">Temporary password</label>
          <input id="new-super-admin-password" type="password" autoComplete="new-password" required minLength={6} value={password} onChange={(event) => setPassword(event.target.value)} />
        </div>
        {error && <p className="logins-management__error">{error}</p>}
        <Button type="submit" disabled={saving}>{saving ? "Creating…" : "Create Super Admin"}</Button>
      </form>
    </Modal>
  );
}

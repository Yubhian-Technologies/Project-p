import { useEffect, useState } from "react";
import { listCampuses } from "../../services/firebase/campuses";
import { listUsersByRole } from "../../services/firebase/firestore";
import { deleteCampusLogin, functionsErrorMessage } from "../../services/firebase/functions";
import { ADMIN_SECTION_LABELS } from "../../config/roles";
import type { Campus } from "../../types/campus";
import type { UserProfile } from "../../types/user";
import { useViewMore } from "../../hooks/useViewMore";
import { Card } from "../../components/common/Card";
import { Button } from "../../components/common/Button";
import { AddAdminModal } from "./AddAdminModal";
import { EditAdminModal } from "./EditAdminModal";
import "./LoginsManagementSection.css";
import "./AdminsManagementSection.css";

export function AdminsManagementSection() {
  const [admins, setAdmins] = useState<UserProfile[]>([]);
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<UserProfile | null>(null);
  const [deletingUid, setDeletingUid] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function load() {
    const [adminList, campusList] = await Promise.all([listUsersByRole("admin"), listCampuses()]);
    setAdmins(adminList);
    setCampuses(campusList);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleDelete(uid: string) {
    setDeleteError(null);
    setDeletingUid(uid);
    try {
      await deleteCampusLogin(uid);
      await load();
    } catch (err) {
      setDeleteError(functionsErrorMessage(err, "Could not delete this admin login. Please try again."));
    } finally {
      setDeletingUid(null);
    }
  }

  const { visible: visibleAdmins, hiddenCount, showMore } = useViewMore(admins);

  if (loading) return null;

  function scopeLabel(admin: UserProfile): string {
    const access = admin.adminAccess;
    if (!access || access.scope === "global") return "Global — all campuses";
    const names = (access.campusIds ?? []).map((id) => campuses.find((c) => c.id === id)?.name ?? "Unknown campus");
    return names.length > 0 ? names.join(", ") : "No campuses assigned";
  }

  return (
    <div className="logins-management">
      <div className="logins-management__header">
        <Button type="button" onClick={() => setAddOpen(true)}>
          + Add Admin
        </Button>
      </div>

      {deleteError && <p className="logins-management__error">{deleteError}</p>}
      {admins.length === 0 && <p>No admin logins yet.</p>}

      {visibleAdmins.map((admin) => (
        <Card key={admin.uid} className="logins-management__row">
          <div>
            <p className="logins-management__name">{admin.displayName || admin.email}</p>
            <p className="logins-management__role">{admin.email}</p>
            <p className="logins-management__college">{scopeLabel(admin)}</p>
            <div className="admins-management__tags">
              {(admin.adminAccess?.sections ?? Object.keys(ADMIN_SECTION_LABELS)).map((id) => (
                <span key={id} className="admins-management__tag">
                  {ADMIN_SECTION_LABELS[id as keyof typeof ADMIN_SECTION_LABELS]}
                </span>
              ))}
            </div>
          </div>
          <div className="logins-management__row-actions">
            <Button type="button" variant="outlined" onClick={() => setEditingAdmin(admin)}>
              Edit
            </Button>
            <Button
              type="button"
              variant="outlined"
              disabled={deletingUid === admin.uid}
              onClick={() => handleDelete(admin.uid)}
            >
              {deletingUid === admin.uid ? "Deleting…" : "Delete login"}
            </Button>
          </div>
        </Card>
      ))}

      {hiddenCount > 0 && (
        <Button type="button" variant="outlined" style={{ alignSelf: "center" }} onClick={showMore}>
          View More ({hiddenCount} more)
        </Button>
      )}

      {addOpen && <AddAdminModal onClose={() => setAddOpen(false)} onCreated={load} />}

      {editingAdmin && (
        <EditAdminModal admin={editingAdmin} onClose={() => setEditingAdmin(null)} onSaved={load} />
      )}
    </div>
  );
}

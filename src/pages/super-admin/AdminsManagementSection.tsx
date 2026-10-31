import { useEffect, useState } from "react";
import { listCampuses } from "../../services/firebase/campuses";
import { listColleges } from "../../services/firebase/colleges";
import { listUsersByRole } from "../../services/firebase/firestore";
import { deleteCampusLogin, functionsErrorMessage } from "../../services/firebase/functions";
import { ADMIN_SECTION_LABELS, ADMIN_DESIGNATIONS, ADMIN_DESIGNATION_LABELS } from "../../config/roles";
import type { Campus } from "../../types/campus";
import type { College } from "../../types/college";
import type { UserProfile } from "../../types/user";
import { useViewMore } from "../../hooks/useViewMore";
import { Card } from "../../components/common/Card";
import { Button } from "../../components/common/Button";
import { Select } from "../../components/common/Select";

const ALL = "all";
const UNASSIGNED = "unassigned";
import { AddAdminModal } from "./AddAdminModal";
import { EditAdminModal } from "./EditAdminModal";
import "./LoginsManagementSection.css";
import "./AdminsManagementSection.css";

export function AdminsManagementSection() {
  const [admins, setAdmins] = useState<UserProfile[]>([]);
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [allColleges, setAllColleges] = useState<College[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<UserProfile | null>(null);
  const [deletingUid, setDeletingUid] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [designationFilter, setDesignationFilter] = useState(ALL);

  async function load() {
const [adminRes, campusList] = await Promise.all([listUsersByRole("admin"), listCampuses()]);
      setAdmins(adminRes.users);
    setCampuses(campusList);
    const collegeLists = await Promise.all(campusList.map((c) => listColleges(c.id)));
    setAllColleges(collegeLists.flat());
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

  const searchQueryNormalized = searchQuery.trim().toLowerCase();
  const filteredAdmins = admins.filter((admin) => {
    if (
      designationFilter === UNASSIGNED
        ? !!admin.adminAccess?.designation
        : designationFilter !== ALL && admin.adminAccess?.designation !== designationFilter
    )
      return false;
    if (
      searchQueryNormalized &&
      !(admin.displayName ?? "").toLowerCase().includes(searchQueryNormalized) &&
      !admin.email.toLowerCase().includes(searchQueryNormalized)
    )
      return false;
    return true;
  });

  const { visible: visibleAdmins, hiddenCount, showMore } = useViewMore(filteredAdmins);

  // Live count of what the search/designation filter currently resolves to.
  const anyFilterActive = designationFilter !== ALL || searchQueryNormalized.length > 0;
  const countLabel =
    anyFilterActive
      ? `${filteredAdmins.length} of ${admins.length} admin logins match the filter`
      : `${admins.length} admin logins in total`;

  if (loading) return null;

  function scopeLabel(admin: UserProfile): string {
    const access = admin.adminAccess;
    if (!access || access.scope === "global") return "Global — all campuses";
    const names = (access.campusIds ?? []).map((id) => campuses.find((c) => c.id === id)?.name ?? "Unknown campus");
    const campusLabel = names.length > 0 ? names.join(", ") : "No campuses assigned";
    if (!access.collegeIds?.length) return campusLabel;
    const collegeNames = access.collegeIds.map((id) => allColleges.find((c) => c.id === id)?.name ?? "Unknown college");
    return `${campusLabel} — ${collegeNames.join(", ")} only`;
  }

  return (
    <div className="logins-management">
      <div className="logins-management__header">
        <Button type="button" onClick={() => setAddOpen(true)}>
          + Add Admin
        </Button>
      </div>

      <div className="logins-management__filters">
        <div className="logins-management__field logins-management__field--search">
          <label htmlFor="admins-search">Search by name or email</label>
          <div className="logins-management__search-input-wrap">
            <input
              id="admins-search"
              type="text"
              placeholder="e.g. Siddiq"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                type="button"
                className="logins-management__search-clear"
                aria-label="Clear search"
                onClick={() => setSearchQuery("")}
              >
                ✕
              </button>
            )}
          </div>
        </div>
        <div className="logins-management__field">
          <label htmlFor="admins-designation-filter">Designation</label>
          <Select id="admins-designation-filter" value={designationFilter} onChange={setDesignationFilter}>
            <option value={ALL}>All designations</option>
            <option value={UNASSIGNED}>Unassigned</option>
            {ADMIN_DESIGNATIONS.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {deleteError && <p className="logins-management__error">{deleteError}</p>}
      <p className="logins-management__hint logins-management__hint--count">{countLabel}</p>
      {admins.length === 0 && <p>No admin logins yet.</p>}
      {admins.length > 0 && filteredAdmins.length === 0 && <p>No admins match this filter.</p>}

      {visibleAdmins.map((admin) => (
        <Card key={admin.uid} className="logins-management__row">
          <div>
            <p className="logins-management__name">{admin.displayName || admin.email}</p>
            <p className="logins-management__role">{admin.email}</p>
            {admin.adminAccess?.designation && (
              <p className="logins-management__role">{ADMIN_DESIGNATION_LABELS[admin.adminAccess.designation]}</p>
            )}
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

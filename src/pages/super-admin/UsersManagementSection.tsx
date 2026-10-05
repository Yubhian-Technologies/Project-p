import { useEffect, useState } from "react";
import { listCampuses } from "../../services/firebase/campuses";
import { listColleges } from "../../services/firebase/colleges";
import { listUsersByRole } from "../../services/firebase/firestore";
import type { Campus } from "../../types/campus";
import type { College } from "../../types/college";
import type { UserProfile } from "../../types/user";
import { Card } from "../../components/common/Card";
import { Button } from "../../components/common/Button";
import { Select } from "../../components/common/Select";
import { EditUserModal } from "./EditUserModal";
import "./LoginsManagementSection.css";

const UNASSIGNED = "unassigned";
const ALL = "all";

export function UsersManagementSection() {
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [allColleges, setAllColleges] = useState<College[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [campusFilter, setCampusFilter] = useState(ALL);
  const [collegeFilter, setCollegeFilter] = useState(ALL);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);

  async function load() {
    const [campusList, userList] = await Promise.all([listCampuses(), listUsersByRole("user")]);
    setCampuses(campusList);
    setUsers(userList);
    const collegeLists = await Promise.all(campusList.map((c) => listColleges(c.id)));
    setAllColleges(collegeLists.flat());
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    setCollegeFilter(ALL);
  }, [campusFilter]);

  const campusName = (id?: string) => campuses.find((c) => c.id === id)?.name;
  const collegeName = (id?: string) => allColleges.find((c) => c.id === id)?.name;
  const collegesForFilter =
    campusFilter !== ALL && campusFilter !== UNASSIGNED ? allColleges.filter((c) => c.campusId === campusFilter) : [];

  const filteredUsers = users.filter((u) => {
    if (campusFilter === ALL) return true;
    if (campusFilter === UNASSIGNED) return !u.campusId;
    if (u.campusId !== campusFilter) return false;
    if (collegeFilter === ALL) return true;
    if (collegeFilter === UNASSIGNED) return !u.collegeId;
    return u.collegeId === collegeFilter;
  });

  if (loading) return null;

  return (
    <div className="logins-management">
      <div className="logins-management__filters">
        <div className="logins-management__field">
          <label htmlFor="users-campus">Campus</label>
          <Select id="users-campus" value={campusFilter} onChange={setCampusFilter}>
            <option value={ALL}>All campuses</option>
            <option value={UNASSIGNED}>Unassigned (no campus)</option>
            {campuses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="logins-management__field">
          <label htmlFor="users-college">College</label>
          <Select
            id="users-college"
            value={collegeFilter}
            onChange={setCollegeFilter}
            disabled={campusFilter === ALL || campusFilter === UNASSIGNED}
          >
            <option value={ALL}>All colleges</option>
            <option value={UNASSIGNED}>Unassigned (no college)</option>
            {collegesForFilter.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {filteredUsers.length === 0 && <p>No users match this filter.</p>}

      {filteredUsers.map((user) => (
        <Card key={user.uid} className="logins-management__row">
          <div>
            <p className="logins-management__name">{user.displayName || user.email}</p>
            <p className="logins-management__role">{user.email}</p>
            <p className="logins-management__college">
              {user.campusId ? campusName(user.campusId) ?? "Unknown campus" : "Unassigned campus"}
              {" • "}
              {user.campusId ? (user.collegeId ? collegeName(user.collegeId) ?? "Unknown college" : "Unassigned college") : "—"}
            </p>
          </div>
          <div className="logins-management__row-actions">
            <Button type="button" variant="outlined" onClick={() => setEditingUser(user)}>
              Edit
            </Button>
          </div>
        </Card>
      ))}

      {editingUser && (
        <EditUserModal user={editingUser} campuses={campuses} onClose={() => setEditingUser(null)} onSaved={load} />
      )}
    </div>
  );
}

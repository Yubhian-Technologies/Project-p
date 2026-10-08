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
import { AddStudentModal } from "../../components/profile/AddStudentModal";
import { ImportLoginsModal } from "../../components/profile/ImportLoginsModal";
import "./LoginsManagementSection.css";

const UNASSIGNED = "unassigned";
const ALL = "all";

// Two branches ended up saved under two different spellings by mistake
// (import/creation inconsistency) — these are the same branch, just typed
// differently. Merged ONLY for these two specific pairs in the Branch
// filter below (never touches the raw `branch` value stored on a student,
// and no other branch is affected). The first entry in each group is the
// one shown as the filter option.
const BRANCH_ALIAS_GROUPS = [
  ["AI&ML", "CSE(AI&ML)"],
  ["AI&DS", "CSE(AI&DS)"],
];

// Matched loosely — case-insensitive and ignoring ALL whitespace — so
// "CSE(AI&ML)", "CSE (AI&ML)", "cse( ai & ml )" etc. all still land on the
// same canonical branch, not just the one exact spelling.
function branchMatchKey(value: string): string {
  return value.replace(/\s+/g, "").toUpperCase();
}

const BRANCH_ALIAS_LOOKUP = new Map<string, string>(
  BRANCH_ALIAS_GROUPS.flatMap((group) => group.map((alias) => [branchMatchKey(alias), group[0]] as const)),
);

function canonicalBranch(branch: string): string {
  return BRANCH_ALIAS_LOOKUP.get(branchMatchKey(branch)) ?? branch;
}

export function UsersManagementSection() {
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [allColleges, setAllColleges] = useState<College[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [campusFilter, setCampusFilter] = useState(ALL);
  const [collegeFilter, setCollegeFilter] = useState(ALL);
  const [branchFilter, setBranchFilter] = useState(ALL);
  const [yearFilter, setYearFilter] = useState(ALL);
  const [emailSearch, setEmailSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [showAddUser, setShowAddUser] = useState(false);
  const [showImportUsers, setShowImportUsers] = useState(false);

  // Both creation paths need one specific campus picked first (every account
  // belongs to exactly one) — not available from "All campuses" or
  // "Unassigned".
  const canCreateUsers = campusFilter !== ALL && campusFilter !== UNASSIGNED;

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

  // Branch/Year options depend on which campus+college is selected, so a
  // stale choice (e.g. a branch that only exists elsewhere) can't linger
  // when that selection narrows.
  useEffect(() => {
    setBranchFilter(ALL);
    setYearFilter(ALL);
  }, [campusFilter, collegeFilter]);

  const campusName = (id?: string) => campuses.find((c) => c.id === id)?.name;
  const collegeName = (id?: string) => allColleges.find((c) => c.id === id)?.name;
  const collegesForFilter =
    campusFilter !== ALL && campusFilter !== UNASSIGNED ? allColleges.filter((c) => c.campusId === campusFilter) : [];

  const usersAfterCampusCollege = users.filter((u) => {
    if (campusFilter === ALL) return true;
    if (campusFilter === UNASSIGNED) return !u.campusId;
    if (u.campusId !== campusFilter) return false;
    if (collegeFilter === ALL) return true;
    if (collegeFilter === UNASSIGNED) return !u.collegeId;
    return u.collegeId === collegeFilter;
  });

  const branchesForFilter = Array.from(
    new Set(
      usersAfterCampusCollege
        .map((u) => u.branch)
        .filter((b): b is string => !!b)
        .map(canonicalBranch),
    ),
  ).sort((a, b) => a.localeCompare(b));
  const yearsForFilter = Array.from(
    new Set(usersAfterCampusCollege.map((u) => u.yearOrBatch).filter((y): y is string => !!y)),
  ).sort((a, b) => a.localeCompare(b));

  const emailQuery = emailSearch.trim().toLowerCase();

  const filteredUsers = usersAfterCampusCollege.filter((u) => {
    if (
      branchFilter === UNASSIGNED
        ? !!u.branch
        : branchFilter !== ALL && (!u.branch || canonicalBranch(u.branch) !== branchFilter)
    )
      return false;
    if (yearFilter === UNASSIGNED ? !!u.yearOrBatch : yearFilter !== ALL && u.yearOrBatch !== yearFilter) return false;
    if (emailQuery && !u.email.toLowerCase().includes(emailQuery)) return false;
    return true;
  });

  // Natural sort by email — plain string sort puts "...a10" before "...a2"
  // since it compares character-by-character; `numeric: true` compares the
  // embedded numbers as numbers instead, matching the actual roll-number order.
  const sortedUsers = [...filteredUsers].sort((a, b) =>
    a.email.localeCompare(b.email, undefined, { numeric: true, sensitivity: "base" }),
  );

  if (loading) return null;

  // Breadcrumb for the list below, so it's always clear exactly which slice
  // of Campus → College → Branch → Year is being shown. Branch/Year only
  // appear once narrowed past "All", to keep the common case short.
  const breadcrumbParts =
    campusFilter === ALL
      ? ["All campuses"]
      : campusFilter === UNASSIGNED
        ? ["Unassigned"]
        : [
            campusName(campusFilter) ?? "Unknown campus",
            collegeFilter === ALL
              ? "All colleges"
              : collegeFilter === UNASSIGNED
                ? "Unassigned"
                : collegeName(collegeFilter) ?? "Unknown college",
          ];
  if (branchFilter !== ALL) breadcrumbParts.push(branchFilter === UNASSIGNED ? "Unassigned" : branchFilter);
  if (yearFilter !== ALL) breadcrumbParts.push(yearFilter === UNASSIGNED ? "Unassigned" : yearFilter);
  if (emailQuery) breadcrumbParts.push(`Email contains "${emailSearch.trim()}"`);
  const breadcrumb = breadcrumbParts.join(" → ");

  return (
    <div className="logins-management">
      <div className="logins-management__header">
        <Button type="button" disabled={!canCreateUsers} onClick={() => setShowAddUser(true)}>
          + Add User
        </Button>
        <Button type="button" variant="outlined" disabled={!canCreateUsers} onClick={() => setShowImportUsers(true)}>
          Import Users
        </Button>
      </div>
      {!canCreateUsers && (
        <p className="logins-management__hint">
          Select one specific campus below to add or import students and working professionals.
        </p>
      )}

      <div className="logins-management__field logins-management__field--search">
        <label htmlFor="users-email-search">Search by email</label>
        <input
          id="users-email-search"
          type="search"
          placeholder="e.g. 23pa1a12n3@vishnu.edu.in"
          value={emailSearch}
          onChange={(e) => setEmailSearch(e.target.value)}
        />
      </div>

      <div className="logins-management__filters">
        <div className="logins-management__field">
          <label htmlFor="users-campus">1. Campus</label>
          <Select id="users-campus" value={campusFilter} onChange={setCampusFilter}>
            <option value={ALL}>All campuses</option>
            <option value={UNASSIGNED}>Unassigned</option>
            {campuses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
        {campusFilter !== ALL && campusFilter !== UNASSIGNED && (
          <div className="logins-management__field">
            <label htmlFor="users-college">2. College</label>
            <Select id="users-college" value={collegeFilter} onChange={setCollegeFilter}>
              <option value={ALL}>All colleges</option>
              <option value={UNASSIGNED}>Unassigned</option>
              {collegesForFilter.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
        )}
        <div className="logins-management__field">
          <label htmlFor="users-branch">3. Branch</label>
          <Select id="users-branch" value={branchFilter} onChange={setBranchFilter}>
            <option value={ALL}>All branches</option>
            <option value={UNASSIGNED}>Unassigned</option>
            {branchesForFilter.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </Select>
        </div>
        <div className="logins-management__field">
          <label htmlFor="users-year">4. Year / Batch</label>
          <Select id="users-year" value={yearFilter} onChange={setYearFilter}>
            <option value={ALL}>All years / batches</option>
            <option value={UNASSIGNED}>Unassigned</option>
            {yearsForFilter.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <p className="logins-management__hint">{breadcrumb}</p>

      {filteredUsers.length === 0 && <p>No users match this filter.</p>}

      {sortedUsers.map((user) => (
        <Card key={user.uid} className="logins-management__row">
          <div>
            <p className="logins-management__name">{user.displayName || user.email}</p>
            {user.displayName && <p className="logins-management__role">{user.email}</p>}
            <p className="logins-management__college">
              {user.campusId ? campusName(user.campusId) ?? "Unknown campus" : "Unassigned campus"}
              {" • "}
              {user.campusId ? (user.collegeId ? collegeName(user.collegeId) ?? "Unknown college" : "Unassigned college") : "—"}
            </p>
            <p className="logins-management__college">
              {user.studentOrProfessional === "professional" ? "Working professional" : "Student"}
              {user.yearOrBatch ? ` • ${user.yearOrBatch}` : ""}
              {user.branch ? ` • ${user.branch}` : ""}
              {user.gender ? ` • ${user.gender}` : ""}
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

      {showAddUser && canCreateUsers && (
        <AddStudentModal campusId={campusFilter} onClose={() => setShowAddUser(false)} onCreated={load} />
      )}

      {showImportUsers && canCreateUsers && (
        <ImportLoginsModal
          campusId={campusFilter}
          onClose={() => {
            setShowImportUsers(false);
            load();
          }}
        />
      )}
    </div>
  );
}

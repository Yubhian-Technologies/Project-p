import type { AdminSectionId, Role } from "../types/user";

export const ROLES: Role[] = ["user", "counsellor", "head", "admin", "super-admin"];

export const DEFAULT_ROLE: Role = "user";

export const ROLE_LABELS: Record<Role, string> = {
  user: "User",
  counsellor: "Counsellor",
  head: "Head",
  admin: "Admin",
  "super-admin": "Super Admin",
};

// The Admin dashboard sections a Super Admin can grant/withhold per Admin
// login (see AdminAccess in types/user.ts). Order here is the order they're
// offered in the Add/Edit Admin forms. "campuses" (Campus Management) is only
// ever offerable when that admin's scope is "global".
export const ADMIN_SECTIONS: { id: AdminSectionId; label: string }[] = [
  { id: "campuses", label: "Campus Management" },
  { id: "logins", label: "Logins" },
  { id: "events", label: "Events & Programs" },
  { id: "analytics", label: "Analytics" },
  { id: "ssi-analytics", label: "SSI Analytics" },
  { id: "counsellor-worksheet", label: "Counsellor Worksheet" },
  { id: "monthly-reports", label: "Consolidated Reports" },
];

export const ADMIN_SECTION_LABELS: Record<AdminSectionId, string> = Object.fromEntries(
  ADMIN_SECTIONS.map((s) => [s.id, s.label]),
) as Record<AdminSectionId, string>;

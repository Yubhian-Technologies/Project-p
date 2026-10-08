import type { DayAvailability } from "./availability";

export type Role = "user" | "counsellor" | "head" | "admin" | "super-admin";

// The six Admin-dashboard sidebar sections a Super Admin can individually
// grant/withhold per Admin login — see AdminAccess below. Kept in sync with
// the `id`s in src/pages/admin/AdminDashboard.tsx's SECTIONS array.
export type AdminSectionId =
  | "campuses"
  | "logins"
  | "events"
  | "analytics"
  | "counsellor-worksheet"
  | "monthly-reports";

// Only ever set on role === "admin" accounts, by a Super Admin (via
// createAdminLogin/updateAdminLogin). Absent entirely = legacy/global admin,
// same full access every admin account had before this existed.
export interface AdminAccess {
  scope: "global" | "campuses";
  campusIds?: string[]; // only meaningful when scope === "campuses"
  sections: AdminSectionId[]; // "campuses" only valid here when scope === "global"
}

export interface UserProfile {
  uid: string;
  email: string;
  role: Role;
  campusId?: string;
  collegeId?: string;
  adminAccess?: AdminAccess;
  displayName?: string;
  photoURL?: string;
  bio?: string;
  available?: boolean;
  studentOrProfessional?: "student" | "professional";
  yearOrBatch?: string; // e.g. "2nd Year" or "2022-2026" — student-only, free text
  branch?: string; // e.g. "CSE" — student-only, free text
  gender?: string; // student-only
  whatsappNumber?: string;
  additionalEmail?: string;
  specialization?: string;
  experience?: string;
  location?: string;
  areasOfExpertise?: string[];
  educationDegree?: string;
  educationInstitution?: string;
  currentOrganization?: string;
  certifications?: string[];
  sessionType?: "online" | "offline" | "both";
  languages?: string[];
  approachEmpathetic?: string;
  approachEvidenceBased?: string;
  approachSolutionFocused?: string;
  availabilitySchedule?: DayAvailability[];
  createdAt: number;
}

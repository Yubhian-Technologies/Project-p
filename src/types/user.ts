export type Role = "user" | "counsellor" | "head" | "admin" | "super-admin";

// The six Admin-dashboard sidebar sections a Super Admin can individually
// grant/withhold per Admin login — see AdminAccess below. Kept in sync with
// the `id`s in src/pages/admin/AdminDashboard.tsx's SECTIONS array.
export type AdminSectionId =
  | "campuses"
  | "logins"
  | "events"
  | "analytics"
  | "ssi-analytics"
  | "serious-cases"
  | "counsellor-worksheet"
  | "monthly-reports";

export type AdminDesignation = "principal" | "vice-principal" | "administration" | "management";

// Only ever set on role === "admin" accounts, by a Super Admin (via
// createAdminLogin/updateAdminLogin). Absent entirely = legacy/global admin,
// same full access every admin account had before this existed.
export interface AdminAccess {
  scope: "global" | "campuses";
  // Selects role-specific dashboard and permission behavior. Optional; left
  // unset for legacy admins.
  designation?: AdminDesignation;
  campusIds?: string[]; // meaningful when scope === "campuses"
  // Further narrows college-level views and login management within the
  // assigned campus(es). Administration accounts require at least one
  // assigned college while retaining campus-level report/ranking views.
  // Only meaningful when scope === "campuses".
  collegeIds?: string[];
  sections: AdminSectionId[]; // "campuses" only valid here when scope === "global"
}

// Extended bio-data record for BOTH students and working professionals —
// which fields apply is decided by `studentOrProfessional`, not by this type
// (every field here is optional for that reason). Kept as its own nested
// object rather than flattened onto UserProfile since it's a large block,
// filled in either by the person themselves (Profile page) or, for students
// only, in bulk by Super Admin via a Register-Number-matched spreadsheet
// import.
export interface StudentBioData {
  // Student-only
  course?: string; // e.g. "B.Tech" — distinct from `branch` (e.g. "CSE")
  dateOfBirth?: string; // free text as entered (no fixed format enforced)
  hostelOrDayScholar?: "" | "Hostel" | "Day Scholar";
  // Working-professional-only
  employeeId?: string;
  institution?: string;
  designation?: string;
  age?: string; // professionals enter this directly; a student's age is derived from dateOfBirth instead
  preferredLanguage?: string;
  maritalStatus?: string; // optional, free text
  address?: string;
  // Shared (student + professional)
  mobileNumber?: string; // distinct from `whatsappNumber`, which drives booking/crisis contact flows
  personalEmail?: string;
  // Student-only (parent/guardian details — not applicable to professionals)
  fatherName?: string;
  motherName?: string;
  fatherOccupation?: string;
  motherOccupation?: string;
  fatherPhone?: string;
  motherPhone?: string;
  fatherEmail?: string;
  motherEmail?: string;
  correspondenceAddress?: string;
  permanentAddress?: string;
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
  // Counsellor/Head accounts only, set via updateCampusLogin. Absent = active
  // (same "missing field = default" convention used elsewhere in this app).
  // false also disables the underlying Firebase Auth account server-side, so
  // they can no longer sign in at all — not just a booking-availability
  // toggle (that's what `available` above already covers).
  active?: boolean;
  studentOrProfessional?: "student" | "professional";
  // Student-only. Auto-derived at creation time from the email's own
  // local-part (e.g. "23pa1a04a0@vishnu.edu.in" -> "23PA1A04A0") — never
  // typed separately during import/creation — but editable afterward via
  // Edit User, in case a particular email doesn't follow that pattern.
  registerNumber?: string;
  yearOrBatch?: string; // e.g. "2nd Year" or "2022-2026" — student-only, free text. Shown to users as "Batch".
  admissionType?: "regular" | "lateral"; // student-only
  branch?: string; // e.g. "CSE" — student-only, free text
  gender?: string; // student-only
  bioData?: StudentBioData; // student-only
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
  createdAt: number;
}

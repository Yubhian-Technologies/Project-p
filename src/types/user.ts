import type { DayAvailability } from "./availability";

export type Role = "user" | "counsellor" | "head" | "admin" | "super-admin";

export interface UserProfile {
  uid: string;
  email: string;
  role: Role;
  campusId?: string;
  collegeId?: string;
  displayName?: string;
  photoURL?: string;
  bio?: string;
  available?: boolean;
  studentOrProfessional?: "student" | "professional";
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

import { collection, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from "firebase/firestore";
import { db } from "./config";
import type { Role, StudentBioData, UserProfile } from "../../types/user";
import type { DayAvailability } from "../../types/availability";

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snapshot = await getDoc(doc(db, "users", uid));
  return snapshot.exists() ? (snapshot.data() as UserProfile) : null;
}

export async function listCampusLogins(campusId: string): Promise<UserProfile[]> {
  const q = query(collection(db, "users"), where("campusId", "==", campusId));
  const snapshot = await getDocs(q);
  return snapshot.docs
    .map((d) => d.data() as UserProfile)
    .filter((p) => p.role === "counsellor" || p.role === "head");
}

export async function createUserProfile(profile: UserProfile): Promise<void> {
  await setDoc(doc(db, "users", profile.uid), profile);
}

export async function listUsersByRole(role: Role): Promise<UserProfile[]> {
  const q = query(collection(db, "users"), where("role", "==", role));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => d.data() as UserProfile);
}

// Super Admin fixing a student ("user" role) account's campus/college and basic
// details — e.g. accounts created before Campus/College existed, which have no
// other admin UI path to reach them.
export async function updateUserAccount(
  uid: string,
  updates: Partial<
    Pick<
      UserProfile,
      | "displayName"
      | "campusId"
      | "collegeId"
      | "studentOrProfessional"
      | "whatsappNumber"
      | "registerNumber"
      | "yearOrBatch"
      | "branch"
      | "gender"
    >
  > & { admissionType?: "regular" | "lateral" | "" },
): Promise<void> {
  await updateDoc(doc(db, "users", uid), updates);
}

export async function updateUserPhoto(uid: string, photoURL: string): Promise<void> {
  await updateDoc(doc(db, "users", uid), { photoURL });
}

export async function updateUserBio(uid: string, bio: string): Promise<void> {
  await updateDoc(doc(db, "users", uid), { bio });
}

export async function setAvailability(uid: string, available: boolean): Promise<void> {
  await updateDoc(doc(db, "users", uid), { available });
}

export async function updateUserIntakeInfo(
  uid: string,
  data: {
    displayName: string;
    studentOrProfessional: "student" | "professional";
    whatsappNumber: string;
    yearOrBatch: string;
    branch: string;
    gender: string;
  },
): Promise<void> {
  await updateDoc(doc(db, "users", uid), data);
}

export async function updateUserBioData(uid: string, bioData: StudentBioData): Promise<void> {
  await updateDoc(doc(db, "users", uid), { bioData });
}

export async function updateCounsellorProfile(
  uid: string,
  data: {
    displayName: string;
    whatsappNumber: string;
    additionalEmail: string;
    specialization: string;
    experience: string;
    location: string;
    areasOfExpertise: string[];
    educationDegree: string;
    educationInstitution: string;
    currentOrganization: string;
    certifications: string[];
    sessionType: "online" | "offline" | "both";
    languages: string[];
    approachEmpathetic: string;
    approachEvidenceBased: string;
    approachSolutionFocused: string;
    availabilitySchedule: DayAvailability[];
  },
): Promise<void> {
  await updateDoc(doc(db, "users", uid), data);
}

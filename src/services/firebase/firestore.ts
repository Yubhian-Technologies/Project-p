import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { db } from "./config";
import type { UserProfile } from "../../types/user";
import type { DayAvailability } from "../../types/availability";

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snapshot = await getDoc(doc(db, "users", uid));
  return snapshot.exists() ? (snapshot.data() as UserProfile) : null;
}

export async function createUserProfile(profile: UserProfile): Promise<void> {
  await setDoc(doc(db, "users", profile.uid), profile);
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
  data: { displayName: string; studentOrProfessional: "student" | "professional"; whatsappNumber: string },
): Promise<void> {
  await updateDoc(doc(db, "users", uid), data);
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

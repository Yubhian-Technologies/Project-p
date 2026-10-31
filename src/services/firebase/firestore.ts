import { collection, doc, getDoc, getDocs, query, setDoc, updateDoc, where, limit, startAfter, getCountFromServer } from "firebase/firestore";
import { db } from "./config";
import type { Role, StudentBioData, UserProfile } from "../../types/user";

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

export async function getTotalUserCount(): Promise<number> {
  const snap = await getCountFromServer(query(collection(db, "users"), where("role", "==", "user")));
  return snap.data().count;
}

export async function listUsersByRole(
  role: Role,
  pageSize = 200,
  lastDoc?: any,
): Promise<{ users: UserProfile[]; lastDoc: any; hasMore: boolean }> {
  let q = query(collection(db, "users"), where("role", "==", role), limit(pageSize + 1));
  if (lastDoc) q = query(collection(db, "users"), where("role", "==", role), startAfter(lastDoc), limit(pageSize + 1));
  const snapshot = await getDocs(q);
  const docs = snapshot.docs;
  const hasMore = docs.length > pageSize;
  const pageDocs = hasMore ? docs.slice(0, pageSize) : docs;
  return {
    users: pageDocs.map((d) => d.data() as UserProfile),
    lastDoc: pageDocs.length ? pageDocs[pageDocs.length - 1] : lastDoc,
    hasMore,
  };
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
  },
): Promise<void> {
  await updateDoc(doc(db, "users", uid), data);
}

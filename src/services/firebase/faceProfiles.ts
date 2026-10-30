import { deleteDoc, doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { db } from "./config";

/**
 * Firestore collection `face-profiles`: one doc per user holding their
 * enrolled 128-number face descriptor. Registration is an explicit,
 * one-time action (see FaceRegisterModal) — a profile can only be created
 * once; re-registering requires the person's Head/admin manager to reset
 * (delete) it first, enforced by firestore.rules as well as the UI.
 */
export interface FaceProfile {
  uid: string;
  campusId: string;
  /** 128 floating-point numbers from face-api's recognition network. */
  descriptor: number[];
  enrolledAt: number;
}

const faceProfilesCollection = "face-profiles";

export async function getFaceProfile(uid: string): Promise<FaceProfile | null> {
  const snapshot = await getDoc(doc(db, faceProfilesCollection, uid));
  if (!snapshot.exists()) return null;
  return snapshot.data() as FaceProfile;
}

export async function enrollFaceProfile(
  uid: string,
  campusId: string,
  descriptor: Float32Array,
): Promise<void> {
  const payload: FaceProfile = {
    uid,
    campusId,
    descriptor: Array.from(descriptor),
    enrolledAt: Date.now(),
  };
  await setDoc(doc(db, faceProfilesCollection, uid), payload);
}

/** Clears a person's enrolled face so they can register again — only their
    Head/admin manager (or the person themself) can do this. */
export async function resetFaceProfile(uid: string): Promise<void> {
  await deleteDoc(doc(db, faceProfilesCollection, uid));
}

export function faceProfileToFloat32(profile: FaceProfile): Float32Array {
  return new Float32Array(profile.descriptor);
}

/** Backfills `campusId` on a profile registered before that field existed —
    firestore.rules only allow this while the field is genuinely missing and
    only for the owner, and reject any attempt to also touch the descriptor
    or enrolledAt, so this can never be used to re-enroll a different face. */
export async function backfillFaceProfileCampusId(uid: string, campusId: string): Promise<void> {
  await updateDoc(doc(db, faceProfilesCollection, uid), { campusId });
}

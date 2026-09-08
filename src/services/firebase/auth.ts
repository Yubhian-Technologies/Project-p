import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { auth } from "./config";
import { createUserProfile } from "./firestore";
import { DEFAULT_ROLE } from "../../config/roles";

export async function signIn(email: string, password: string) {
  return signInWithEmailAndPassword(auth, email, password);
}

export async function signUp(email: string, password: string, campusId: string, collegeId: string) {
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  await createUserProfile({
    uid: credential.user.uid,
    email,
    role: DEFAULT_ROLE,
    campusId,
    collegeId,
    createdAt: Date.now(),
  });
  return credential;
}

export async function signOutUser() {
  return signOut(auth);
}

import {
  EmailAuthProvider,
  createUserWithEmailAndPassword,
  reauthenticateWithCredential,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
} from "firebase/auth";
import { FirebaseError } from "firebase/app";
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

export async function sendPasswordReset(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email);
}

export async function changeOwnPassword(currentPassword: string, newPassword: string): Promise<void> {
  const user = auth.currentUser;
  if (!user || !user.email) {
    throw new Error("Not signed in.");
  }
  const credential = EmailAuthProvider.credential(user.email, currentPassword);
  await reauthenticateWithCredential(user, credential);
  await updatePassword(user, newPassword);
}

const KNOWN_AUTH_ERROR_MESSAGES: Record<string, string> = {
  "auth/wrong-password": "Current password is incorrect.",
  "auth/invalid-credential": "Current password is incorrect.",
  "auth/weak-password": "New password is too weak. Use at least 6 characters.",
  "auth/requires-recent-login": "For security, please sign out and sign in again before changing your password.",
  "auth/too-many-requests": "Too many attempts. Please wait a moment and try again.",
  "auth/user-not-found": "No account found with that email address.",
  "auth/invalid-email": "Please enter a valid email address.",
};

export function authErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof FirebaseError) {
    return KNOWN_AUTH_ERROR_MESSAGES[err.code] ?? fallback;
  }
  return fallback;
}

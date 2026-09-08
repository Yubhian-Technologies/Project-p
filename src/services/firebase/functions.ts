import { FirebaseError } from "firebase/app";
import { getFunctions, httpsCallable } from "firebase/functions";
import { app } from "./config";

const KNOWN_ERROR_CODES = new Set([
  "functions/permission-denied",
  "functions/invalid-argument",
  "functions/already-exists",
  "functions/unauthenticated",
]);

export function functionsErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof FirebaseError && KNOWN_ERROR_CODES.has(err.code)) {
    return err.message;
  }
  return fallback;
}

export async function deleteCampusLogin(uid: string): Promise<void> {
  const fn = httpsCallable(getFunctions(app), "deleteCampusLogin");
  await fn({ uid });
}

export interface UpdateCampusLoginInput {
  uid: string;
  displayName: string;
  email: string;
  password?: string;
  role: "counsellor" | "head";
  collegeId: string;
}

export async function updateCampusLogin(input: UpdateCampusLoginInput): Promise<void> {
  const fn = httpsCallable(getFunctions(app), "updateCampusLogin");
  await fn(input);
}

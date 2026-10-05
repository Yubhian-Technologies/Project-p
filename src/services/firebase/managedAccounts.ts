import { getFunctions, httpsCallable } from "firebase/functions";
import { app } from "./config";

interface CreateCampusLoginInput {
  email: string;
  password: string;
  displayName: string;
  role: "counsellor" | "head";
  campusId: string;
  collegeId: string;
}

export async function createCampusLogin(input: CreateCampusLoginInput): Promise<void> {
  const fn = httpsCallable(getFunctions(app), "createCampusLogin");
  await fn(input);
}

interface CreateStudentLoginInput {
  email: string;
  collegeId: string;
}

export async function createStudentLogin(input: CreateStudentLoginInput): Promise<void> {
  const fn = httpsCallable(getFunctions(app), "createStudentLogin");
  await fn(input);
}

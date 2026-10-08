import { getFunctions, httpsCallable } from "firebase/functions";
import { app } from "./config";
import type { AdminAccess } from "../../types/user";

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
  password?: string;
  studentOrProfessional: "student" | "professional";
  yearOrBatch?: string;
  branch?: string;
  gender?: string;
}

export async function createStudentLogin(input: CreateStudentLoginInput): Promise<void> {
  const fn = httpsCallable(getFunctions(app), "createStudentLogin");
  await fn(input);
}

interface CreateAdminLoginInput {
  email: string;
  password: string;
  displayName: string;
  adminAccess: AdminAccess;
}

export async function createAdminLogin(input: CreateAdminLoginInput): Promise<void> {
  const fn = httpsCallable(getFunctions(app), "createAdminLogin");
  await fn(input);
}

interface UpdateAdminLoginInput {
  uid: string;
  displayName: string;
  email: string;
  password?: string;
  adminAccess: AdminAccess;
}

export async function updateAdminLogin(input: UpdateAdminLoginInput): Promise<void> {
  const fn = httpsCallable(getFunctions(app), "updateAdminLogin");
  await fn(input);
}

import { FirebaseError } from "firebase/app";
import { getFunctions, httpsCallable } from "firebase/functions";
import { app } from "./config";

const KNOWN_ERROR_CODES = new Set([
  "functions/permission-denied",
  "functions/invalid-argument",
  "functions/already-exists",
  "functions/unauthenticated",
  "functions/failed-precondition",
  "functions/not-found",
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
  active?: boolean;
}

export async function updateCampusLogin(input: UpdateCampusLoginInput): Promise<void> {
  const fn = httpsCallable(getFunctions(app), "updateCampusLogin");
  await fn(input);
}

export interface SaveAcademicYearInput {
  id?: string;
  campusId: string;
  label: string;
  startDate: number;
  endDate: number;
  collegeIds: string[];
  status?: "active" | "closed";
}

export async function saveAcademicYear(input: SaveAcademicYearInput): Promise<string> {
  const fn = httpsCallable<SaveAcademicYearInput, { id: string }>(getFunctions(app), "saveAcademicYear");
  const result = await fn(input);
  return result.data.id;
}

export async function backfillBookingCollegeIds(): Promise<number> {
  const fn = httpsCallable<undefined, { updated: number }>(getFunctions(app), "backfillBookingCollegeIds");
  const result = await fn();
  return result.data.updated;
}

export interface AcademicYearExportFile {
  name: string;
  content?: string;
  downloadURL?: string;
}

export type AcademicYearExportType = "sessions" | "crisis-sos" | "serious-cases" | "feedback" | "ssi" | "events" | "monthly-reports" | "consolidated-reports";
export interface AcademicYearArchiveRecord {
  id: string;
  data: Record<string, unknown>;
  searchText: string;
}

export async function exportAcademicYearCollege(
  yearId: string,
  collegeId: string,
  selectedTypes: AcademicYearExportType[],
): Promise<{ files: AcademicYearExportFile[]; counts: Record<string, number> }> {
  const fn = httpsCallable<
    { yearId: string; collegeId: string; selectedTypes: AcademicYearExportType[] },
    { files: AcademicYearExportFile[]; counts: Record<string, number> }
  >(getFunctions(app), "exportAcademicYearCollege");
  const result = await fn({ yearId, collegeId, selectedTypes });
  return result.data;
}

export async function listAcademicYearArchiveRecords(
  yearId: string,
  collegeId: string,
  recordType: string,
  searchTerm?: string,
  cursor?: string,
): Promise<{ records: AcademicYearArchiveRecord[]; hasMore: boolean; nextCursor: string }> {
  const fn = httpsCallable<
    { yearId: string; collegeId: string; recordType: string; searchTerm?: string; cursor?: string },
    { records: AcademicYearArchiveRecord[]; hasMore: boolean; nextCursor: string }
  >(getFunctions(app), "listAcademicYearArchiveRecords");
  const result = await fn({ yearId, collegeId, recordType, searchTerm, cursor });
  return result.data;
}

import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  query,
  orderBy,
  where,
  serverTimestamp,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { db, storage } from "./config";

export interface MonthlyReport {
  id: string;
  title: string;
  month: number;      // 1–12
  year: number;
  uploadedBy: string; // displayName or email of the head
  uploadedByUid: string;
  campusId: string;   // campus the head belongs to
  collegeId: string;  // college the head belongs to
  downloadURL: string;
  storagePath: string;
  fileName: string;
  uploadedAt: string; // ISO string
}

const COLLECTION = "monthlyReports";

/** Upload a file to Storage + create a Firestore record. */
export async function uploadMonthlyReport(
  file: File,
  title: string,
  month: number,
  year: number,
  uploadedBy: string,
  uploadedByUid: string,
  onProgress?: (pct: number) => void,
  campusId = "",
  collegeId = "",
): Promise<MonthlyReport> {
  const storagePath = `monthly-reports/${uploadedByUid}/${year}/${String(month).padStart(2, "0")}/${Date.now()}_${file.name}`;
  const storageRef = ref(storage, storagePath);

  onProgress?.(0);
  await uploadBytes(storageRef, file);
  onProgress?.(100);

  const downloadURL = await getDownloadURL(storageRef);

  const docRef = await addDoc(collection(db, COLLECTION), {
    title,
    month,
    year,
    uploadedBy,
    uploadedByUid,
    campusId,
    collegeId,
    downloadURL,
    storagePath,
    fileName: file.name,
    uploadedAt: serverTimestamp(),
  });

  return {
    id: docRef.id,
    title,
    month,
    year,
    uploadedBy,
    uploadedByUid,
    campusId,
    collegeId,
    downloadURL,
    storagePath,
    fileName: file.name,
    uploadedAt: new Date().toISOString(),
  };
}

/** Fetch all monthly reports ordered by most recent first. */
export async function listMonthlyReports(): Promise<MonthlyReport[]> {
  const q = query(collection(db, COLLECTION), orderBy("uploadedAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => docToReport(d.id, d.data()));
}

/** Fetch reports filtered by campus + college (for admin view). */
export async function listMonthlyReportsByCampusCollege(
  campusId: string,
  collegeId: string,
): Promise<MonthlyReport[]> {
  const q = query(
    collection(db, COLLECTION),
    where("campusId", "==", campusId),
    where("collegeId", "==", collegeId),
    orderBy("uploadedAt", "desc"),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => docToReport(d.id, d.data()));
}

/** Delete a report from both Firestore and Storage. */
export async function deleteMonthlyReport(id: string, storagePath: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTION, id));
  try {
    await deleteObject(ref(storage, storagePath));
  } catch {
    // Storage object may already be gone — ignore
  }
}

// ── helpers ──────────────────────────────────────────────────────────────────
function docToReport(id: string, data: Record<string, unknown>): MonthlyReport {
  return {
    id,
    title: (data.title as string) ?? "",
    month: (data.month as number) ?? 1,
    year: (data.year as number) ?? new Date().getFullYear(),
    uploadedBy: (data.uploadedBy as string) ?? "",
    uploadedByUid: (data.uploadedByUid as string) ?? "",
    campusId: (data.campusId as string) ?? "",
    collegeId: (data.collegeId as string) ?? "",
    downloadURL: (data.downloadURL as string) ?? "",
    storagePath: (data.storagePath as string) ?? "",
    fileName: (data.fileName as string) ?? "",
    uploadedAt:
      (data.uploadedAt as { toDate?: () => Date })?.toDate?.()?.toISOString?.() ??
      new Date().toISOString(),
  };
}

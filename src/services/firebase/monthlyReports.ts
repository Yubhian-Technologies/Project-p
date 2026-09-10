import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  query,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage";
import { db, storage } from "./config";

export interface MonthlyReport {
  id: string;
  title: string;
  month: number;      // 1–12
  year: number;
  uploadedBy: string; // displayName or email of the head
  uploadedByUid: string;
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
): Promise<MonthlyReport> {
  const storagePath = `monthly-reports/${year}/${String(month).padStart(2, "0")}/${Date.now()}_${file.name}`;
  const storageRef = ref(storage, storagePath);

  // Upload with progress
  await new Promise<void>((resolve, reject) => {
    const task = uploadBytesResumable(storageRef, file);
    task.on(
      "state_changed",
      (snap) => {
        if (onProgress) {
          onProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100));
        }
      },
      reject,
      () => resolve(),
    );
  });

  const downloadURL = await getDownloadURL(storageRef);

  const docRef = await addDoc(collection(db, COLLECTION), {
    title,
    month,
    year,
    uploadedBy,
    uploadedByUid,
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
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      title: data.title ?? "",
      month: data.month ?? 1,
      year: data.year ?? new Date().getFullYear(),
      uploadedBy: data.uploadedBy ?? "",
      uploadedByUid: data.uploadedByUid ?? "",
      downloadURL: data.downloadURL ?? "",
      storagePath: data.storagePath ?? "",
      fileName: data.fileName ?? "",
      uploadedAt: data.uploadedAt?.toDate?.()?.toISOString?.() ?? new Date().toISOString(),
    } satisfies MonthlyReport;
  });
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

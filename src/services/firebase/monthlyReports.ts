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
  updateDoc,
  deleteField,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { httpsCallable, getFunctions } from "firebase/functions";
import { db, storage, app } from "./config";
import { attachmentMetadata } from "../../utils/attachmentMetadata";

export type MonthlyReportStatus = "pending" | "verified";

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
  status: MonthlyReportStatus;
  // populated once Admin verifies it
  verifiedBy?: string;
  verifiedByUid?: string;
  verifiedAt?: string;
  // populated only when the verifying Admin had a signature on file — see
  // the verifyMonthlyReport Cloud Function. "stamped" = the original PDF
  // with a verification page appended; "certificate" = a standalone
  // verification page (the original wasn't a PDF, so it couldn't be stamped).
  signedDownloadURL?: string;
  signedFileName?: string;
  signedKind?: "stamped" | "certificate";
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
  const existingReports = (await listMonthlyReportsByCampus(campusId)).filter(
    (report) => report.uploadedByUid === uploadedByUid && report.month === month && report.year === year,
  );
  const existingReport = existingReports[0];
  const storagePath = `monthly-reports/${uploadedByUid}/${year}/${String(month).padStart(2, "0")}/${Date.now()}_${file.name}`;
  const storageRef = ref(storage, storagePath);

  onProgress?.(0);
  await uploadBytes(storageRef, file, attachmentMetadata(file.name));
  onProgress?.(100);

  const downloadURL = await getDownloadURL(storageRef);

  const reportData = {
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
    status: "pending",
  };
  let reportId = existingReport?.id ?? "";
  try {
    if (existingReport) {
      await updateDoc(doc(db, COLLECTION, existingReport.id), {
        ...reportData,
        verifiedBy: deleteField(),
        verifiedByUid: deleteField(),
        verifiedAt: deleteField(),
        signedDownloadURL: deleteField(),
        signedFileName: deleteField(),
        signedKind: deleteField(),
      });
    } else {
      const docRef = await addDoc(collection(db, COLLECTION), reportData);
      reportId = docRef.id;
    }
  } catch (error) {
    try {
      await deleteObject(storageRef);
    } catch (cleanupError) {
      console.error("Failed to remove an unshared replacement report file:", cleanupError);
    }
    throw error;
  }

  for (const duplicate of existingReports.slice(1)) {
    await deleteDoc(doc(db, COLLECTION, duplicate.id));
  }

  for (const oldReport of existingReports) {
    if (oldReport.storagePath !== storagePath) {
      try {
        await deleteObject(ref(storage, oldReport.storagePath));
      } catch (error) {
        console.error("The report was replaced, but its previous file could not be removed:", error);
        throw new Error("The report was shared, but its previous file could not be removed. Contact support.");
      }
    }
  }

  return {
    id: reportId,
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
    status: "pending",
  };
}

/** Re-notify the Head and authorized Management/Administration admins. */
export async function reshareMonthlyReport(reportId: string): Promise<void> {
  const fn = httpsCallable(getFunctions(app), "reshareMonthlyReport");
  await fn({ reportId });
}

/**
 * Admin verifies a Head's consolidated report. Runs server-side (not a plain
 * updateDoc) because stamping the Admin's own uploaded signature onto a copy
 * of the report requires reading the original file's bytes from Storage —
 * this bucket has no CORS configured (see utils/attachmentMetadata.ts), so a
 * client-side fetch() of it would silently fail. verifiedBy/verifiedByUid are
 * derived server-side from the caller's own profile, not passed in.
 */
export async function verifyMonthlyReport(id: string): Promise<void> {
  const fn = httpsCallable(getFunctions(app), "verifyMonthlyReport");
  await fn({ reportId: id });
}

/** Fetch all monthly reports ordered by most recent first. */
export async function listMonthlyReports(): Promise<MonthlyReport[]> {
  const q = query(collection(db, COLLECTION), orderBy("uploadedAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => docToReport(d.id, d.data()));
}

/** Fetch one campus's own consolidated reports — used by that campus's Head
    (client-sorted so no composite index is required). */
export async function listMonthlyReportsByCampus(campusId: string): Promise<MonthlyReport[]> {
  const q = query(collection(db, COLLECTION), where("campusId", "==", campusId));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => docToReport(d.id, d.data()))
    .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
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
    status: (data.status as MonthlyReportStatus) ?? "pending",
    verifiedBy: (data.verifiedBy as string | undefined) ?? undefined,
    verifiedByUid: (data.verifiedByUid as string | undefined) ?? undefined,
    verifiedAt:
      (data.verifiedAt as { toDate?: () => Date } | undefined)?.toDate?.()?.toISOString?.() ?? undefined,
    signedDownloadURL: (data.signedDownloadURL as string | undefined) ?? undefined,
    signedFileName: (data.signedFileName as string | undefined) ?? undefined,
    signedKind: (data.signedKind as "stamped" | "certificate" | undefined) ?? undefined,
  };
}

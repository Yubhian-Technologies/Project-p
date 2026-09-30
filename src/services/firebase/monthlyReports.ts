import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  getDoc,
  updateDoc,
  query,
  orderBy,
  where,
  serverTimestamp,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { db, storage } from "./config";
import { createNotification } from "./notifications";
import { listUsersByRole } from "./firestore";
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
  await uploadBytes(storageRef, file, attachmentMetadata(file.name));
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
    status: "pending",
  });

  // Platform-level alert for admins whenever a campus uploads a monthly report.
  const campusName = await getCampusName(campusId);
  const monthName = new Date(year, month - 1, 1).toLocaleString("en-IN", { month: "long" });
  const admins = await listUsersByRole("admin");
  const campusLabel = campusName ? `${campusName} campus` : "A campus";
  await Promise.all(
    admins.map((admin) =>
      createNotification({
        recipientId: admin.uid,
        type: "monthly_report_uploaded",
        title: "Monthly report available",
        message: `${campusLabel} has a new monthly report: ${title} (${monthName} ${year}).`,
      }),
    ),
  );

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
    status: "pending",
  };
}

/** Admin verifies a Head's consolidated report. */
export async function verifyMonthlyReport(id: string, verifiedBy: string, verifiedByUid: string): Promise<void> {
  await updateDoc(doc(db, COLLECTION, id), {
    status: "verified",
    verifiedBy,
    verifiedByUid,
    verifiedAt: serverTimestamp(),
  });
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
async function getCampusName(campusId: string): Promise<string> {
  try {
    const snap = await getDoc(doc(db, "campuses", campusId));
    return (snap.data() as { name?: string } | undefined)?.name ?? "";
  } catch {
    return "";
  }
}

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
  };
}

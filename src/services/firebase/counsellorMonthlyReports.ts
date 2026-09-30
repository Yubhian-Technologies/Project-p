import {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  query,
  where,
  serverTimestamp,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "./config";
import { createNotification } from "./notifications";
import { listUsersByRole } from "./firestore";
import { attachmentMetadata } from "../../utils/attachmentMetadata";

export type CounsellorMonthlyReportStatus = "pending" | "verified";

export interface CounsellorMonthlyReport {
  id: string;
  title: string;
  month: number; // 1–12
  year: number;
  uploadedBy: string; // displayName or email of the counsellor
  uploadedByUid: string;
  campusId: string;
  collegeId: string;
  downloadURL: string;
  storagePath: string;
  fileName: string;
  uploadedAt: string; // ISO string
  status: CounsellorMonthlyReportStatus;
  // populated once the Head verifies it
  verifiedBy?: string;
  verifiedByUid?: string;
  verifiedAt?: string;
  headNotes?: string;
}

const COLLECTION = "counsellorMonthlyReports";

/** Upload a counsellor's monthly report to Storage + create a Firestore record, then notify their campus's Head. */
export async function submitCounsellorMonthlyReport(
  file: File,
  title: string,
  month: number,
  year: number,
  uploadedBy: string,
  uploadedByUid: string,
  campusId: string,
  collegeId: string,
  onProgress?: (pct: number) => void,
): Promise<CounsellorMonthlyReport> {
  const storagePath = `counsellor-monthly-reports/${uploadedByUid}/${year}/${String(month).padStart(2, "0")}/${Date.now()}_${file.name}`;
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

  const monthName = new Date(year, month - 1, 1).toLocaleString("en-IN", { month: "long" });
  const heads = await listUsersByRole("head");
  // Exactly one Head per campus, overseeing every college in it — not scoped
  // to the submitting counsellor's own college.
  const campusHeads = heads.filter((h) => h.campusId === campusId);
  await Promise.all(
    campusHeads.map((head) =>
      createNotification({
        recipientId: head.uid,
        type: "monthly_report_uploaded",
        title: "Monthly report submitted",
        message: `${uploadedBy} submitted a monthly report: ${title} (${monthName} ${year}).`,
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

/** Head verifies a counsellor's report, optionally with notes. */
export async function verifyCounsellorMonthlyReport(
  id: string,
  verifiedBy: string,
  verifiedByUid: string,
  headNotes: string,
): Promise<void> {
  await updateDoc(doc(db, COLLECTION, id), {
    status: "verified",
    verifiedBy,
    verifiedByUid,
    headNotes,
    verifiedAt: serverTimestamp(),
  });
}

function sortByUploadedAtDesc(reports: CounsellorMonthlyReport[]): CounsellorMonthlyReport[] {
  return reports.sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
}

/** A counsellor's own submission history (client-sorted so no composite index is required). */
export async function listCounsellorMonthlyReportsForUser(uid: string): Promise<CounsellorMonthlyReport[]> {
  const q = query(collection(db, COLLECTION), where("uploadedByUid", "==", uid));
  const snap = await getDocs(q);
  return sortByUploadedAtDesc(snap.docs.map((d) => docToReport(d.id, d.data())));
}

/** Every report submitted by counsellors anywhere in one campus — used by
    that campus's one Head, who oversees every college in it. */
export async function listCounsellorMonthlyReportsForCampus(campusId: string): Promise<CounsellorMonthlyReport[]> {
  const q = query(collection(db, COLLECTION), where("campusId", "==", campusId));
  const snap = await getDocs(q);
  return sortByUploadedAtDesc(snap.docs.map((d) => docToReport(d.id, d.data())));
}

function docToReport(id: string, data: Record<string, unknown>): CounsellorMonthlyReport {
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
    status: (data.status as CounsellorMonthlyReportStatus) ?? "pending",
    verifiedBy: (data.verifiedBy as string | undefined) ?? undefined,
    verifiedByUid: (data.verifiedByUid as string | undefined) ?? undefined,
    verifiedAt:
      (data.verifiedAt as { toDate?: () => Date } | undefined)?.toDate?.()?.toISOString?.() ?? undefined,
    headNotes: (data.headNotes as string | undefined) ?? undefined,
  };
}

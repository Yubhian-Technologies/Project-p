import {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  where,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "./config";

export type WorkReportStatus = "pending" | "verified";
export type WorkReportType = "daily" | "weekly" | "other";

export interface WorkReport {
  id: string;
  title: string;
  body: string;
  reportType: WorkReportType;
  periodLabel: string;          // e.g. "Week 1, Sep 2026"
  submittedBy: string;          // counsellor display name / email
  submittedByUid: string;
  submittedAt: string;          // ISO string
  status: WorkReportStatus;
  // populated after verification
  verifiedBy?: string;
  verifiedByUid?: string;
  verifiedAt?: string;
  headNotes?: string;
}

const COLLECTION = "workReports";

/** Counsellor submits a new work report. */
export async function submitWorkReport(
  title: string,
  body: string,
  reportType: WorkReportType,
  periodLabel: string,
  submittedBy: string,
  submittedByUid: string,
): Promise<WorkReport> {
  const docRef = await addDoc(collection(db, COLLECTION), {
    title,
    body,
    reportType,
    periodLabel,
    submittedBy,
    submittedByUid,
    submittedAt: serverTimestamp(),
    status: "pending",
  });

  return {
    id: docRef.id,
    title,
    body,
    reportType,
    periodLabel,
    submittedBy,
    submittedByUid,
    submittedAt: new Date().toISOString(),
    status: "pending",
  };
}

/** Counsellor fetches their own reports, newest first (client-sorted so no
 *  composite index is required on the query). */
export async function listWorkReportsByUid(uid: string): Promise<WorkReport[]> {
  const q = query(collection(db, COLLECTION), where("submittedByUid", "==", uid));
  const snap = await getDocs(q);
  const reports = snap.docs.map((d) => docToReport(d.id, d.data()));
  return reports.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
}

/** Head fetches all reports from all counsellors, newest first. */
export async function listAllWorkReports(): Promise<WorkReport[]> {
  const q = query(collection(db, COLLECTION), orderBy("submittedAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => docToReport(d.id, d.data()));
}

/** Head verifies a report and optionally adds notes. */
export async function verifyWorkReport(
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

/** Counsellor or Head deletes a work report. */
export async function deleteWorkReport(id: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTION, id));
}


// ── helpers ──────────────────────────────────────────────────────────────────

function docToReport(id: string, data: Record<string, unknown>): WorkReport {
  return {
    id,
    title: (data.title as string) ?? "",
    body: (data.body as string) ?? "",
    reportType: (data.reportType as WorkReportType) ?? "other",
    periodLabel: (data.periodLabel as string) ?? "",
    submittedBy: (data.submittedBy as string) ?? "",
    submittedByUid: (data.submittedByUid as string) ?? "",
    submittedAt:
      (data.submittedAt as { toDate?: () => Date })?.toDate?.()?.toISOString?.() ??
      new Date().toISOString(),
    status: (data.status as WorkReportStatus) ?? "pending",
    verifiedBy: (data.verifiedBy as string | undefined) ?? undefined,
    verifiedByUid: (data.verifiedByUid as string | undefined) ?? undefined,
    verifiedAt:
      (data.verifiedAt as { toDate?: () => Date } | undefined)?.toDate?.()?.toISOString?.() ??
      undefined,
    headNotes: (data.headNotes as string | undefined) ?? undefined,
  };
}

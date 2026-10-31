import {
  collection,
  addDoc,
  getDocs,
  doc,
  deleteDoc,
  updateDoc,
  query,
  where,
  serverTimestamp,
  deleteField,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { db, storage } from "./config";
import { listUsersByRole } from "./firestore";
import { attachmentMetadata } from "../../utils/attachmentMetadata";

export type MonthlyStaffReportStatus = "pending" | "verified";

export type MonthlyReportAuthorRole = "counsellor" | "head";
export type MonthlyReportRecipientRole = MonthlyReportAuthorRole | "principal" | "vice-principal";

export interface MonthlyReportRecipient {
  uid: string;
  name: string;
  role: MonthlyReportRecipientRole;
  defaultSelected: boolean;
}

export interface MonthlyReportScope {
  campusId: string;
  collegeId: string;
}

export interface MonthlyStaffReport {
  id: string;
  title: string;
  month: number; // 1–12
  year: number;
  uploadedBy: string; // displayName or email of the staff member
  uploadedByUid: string;
  uploadedByRole: MonthlyReportAuthorRole;
  campusId: string;
  collegeId: string;
  recipientUids: string[];
  downloadURL: string;
  storagePath: string;
  fileName: string;
  uploadedAt: string; // ISO string
  status: MonthlyStaffReportStatus;
  // populated once the Head verifies it
  verifiedBy?: string;
  verifiedByUid?: string;
  verifiedAt?: string;
  headNotes?: string;
}

const COLLECTION = "counsellorMonthlyReports";

/** Recipients are limited to the author's college and the relevant reporting chain. */
export async function listMonthlyReportRecipients(
  campusId: string,
  collegeId: string,
  authorRole: MonthlyReportAuthorRole,
): Promise<MonthlyReportRecipient[]> {
const [headsRes, adminsRes] = await Promise.all([
    authorRole === "counsellor" ? listUsersByRole("head") : Promise.resolve({ users: [], lastDoc: null, hasMore: false }),
    listUsersByRole("admin"),
  ]);
  const heads = headsRes.users ?? headsRes;
  const admins = adminsRes.users ?? adminsRes;
  const headRecipients: MonthlyReportRecipient[] = heads
    .filter((head) => head.campusId === campusId && head.collegeId === collegeId)
    .map((head) => ({
      uid: head.uid,
      name: head.displayName || head.email,
      role: "head",
      defaultSelected: true,
    }));
  const adminRecipients: MonthlyReportRecipient[] = admins
    .filter((admin) => {
      const designation = admin.adminAccess?.designation;
      return Boolean(
        admin.uid &&
          (admin.displayName || admin.email) &&
          (designation === "principal" || designation === "vice-principal") &&
          admin.adminAccess?.scope === "campuses" &&
          admin.adminAccess.campusIds?.includes(campusId) &&
          admin.adminAccess.collegeIds?.includes(collegeId),
      );
    })
    .map((admin) => ({
      uid: admin.uid,
      name: admin.displayName || admin.email,
      role: admin.adminAccess?.designation === "principal" ? "principal" : "vice-principal",
      defaultSelected: false,
    }));

  return [...headRecipients, ...adminRecipients];
}

/** Upload a staff monthly report and notify only its explicitly selected same-college recipients. */
export async function submitMonthlyStaffReport(
  file: File,
  title: string,
  month: number,
  year: number,
  uploadedBy: string,
  uploadedByUid: string,
  uploadedByRole: MonthlyReportAuthorRole,
  campusId: string,
  collegeId: string,
  recipientUids: string[],
  onProgress?: (pct: number) => void,
): Promise<MonthlyStaffReport> {
  const recipients = await listMonthlyReportRecipients(campusId, collegeId, uploadedByRole);
  const selectedRecipientUids = [...new Set(recipientUids)];
  if (
    selectedRecipientUids.length === 0 ||
    selectedRecipientUids.some((uid) => !recipients.some((recipient) => recipient.uid === uid))
  ) {
    throw new Error("Choose at least one recipient assigned to your college.");
  }

  const existingReports = (await listMonthlyStaffReportsForUser(uploadedByUid)).filter(
    (report) =>
      report.uploadedByRole === uploadedByRole &&
      report.campusId === campusId &&
      report.collegeId === collegeId &&
      report.month === month &&
      report.year === year,
  );
  const existingReport = existingReports[0];
  const storagePath = `counsellor-monthly-reports/${uploadedByUid}/${year}/${String(month).padStart(2, "0")}/${Date.now()}_${file.name}`;
  const storageRef = ref(storage, storagePath);

  onProgress?.(0);
  const customMetadata = Object.fromEntries(selectedRecipientUids.map((uid) => [uid, "true"]));
  await uploadBytes(storageRef, file, {
    ...attachmentMetadata(file.name),
    customMetadata: { ...customMetadata, authorUid: uploadedByUid },
  });
  onProgress?.(100);

  const downloadURL = await getDownloadURL(storageRef);

  const reportData = {
    title,
    month,
    year,
    uploadedBy,
    uploadedByUid,
    uploadedByRole,
    campusId,
    collegeId,
    recipientUids: selectedRecipientUids,
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
        headNotes: deleteField(),
      });
    } else {
      const docRef = await addDoc(collection(db, COLLECTION), reportData);
      reportId = docRef.id;
    }
  } catch (error) {
    try {
      await deleteObject(storageRef);
    } catch (cleanupError) {
      console.error("Failed to remove an unshared replacement monthly report file:", cleanupError);
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
        console.error("The monthly report was replaced, but a previous file could not be removed:", error);
        throw new Error("The monthly report was shared, but a previous file could not be removed. Contact support.");
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
    uploadedByRole,
    campusId,
    collegeId,
    recipientUids: selectedRecipientUids,
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

function sortByUploadedAtDesc(reports: MonthlyStaffReport[]): MonthlyStaffReport[] {
  return reports.sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
}

/** The author's own submission history (client-sorted so no composite index is required). */
export async function listMonthlyStaffReportsForUser(uid: string): Promise<MonthlyStaffReport[]> {
  const q = query(collection(db, COLLECTION), where("uploadedByUid", "==", uid));
  const snap = await getDocs(q);
  return sortByUploadedAtDesc(snap.docs.map((d) => docToReport(d.id, d.data())));
}

/** Reports explicitly shared with this user, plus their own submissions. */
export async function listMonthlyStaffReportsForRecipient(
  uid: string,
  scopes: MonthlyReportScope[],
): Promise<MonthlyStaffReport[]> {
  const reports = collection(db, COLLECTION);
  const uniqueScopes = [...new Map(scopes.map((scope) => [`${scope.campusId}:${scope.collegeId}`, scope])).values()];
  const snapshots = await Promise.all(
    uniqueScopes.flatMap(({ campusId, collegeId }) => [
      getDocs(
        query(
          reports,
          where("campusId", "==", campusId),
          where("collegeId", "==", collegeId),
          where("recipientUids", "array-contains", uid),
        ),
      ),
      getDocs(
        query(
          reports,
          where("campusId", "==", campusId),
          where("collegeId", "==", collegeId),
          where("uploadedByUid", "==", uid),
        ),
      ),
    ]),
  );
  const byId = new Map<string, MonthlyStaffReport>();
  for (const snapshot of snapshots) {
    snapshot.docs.forEach((d) => byId.set(d.id, docToReport(d.id, d.data())));
  }
  return sortByUploadedAtDesc([...byId.values()]);
}

function docToReport(id: string, data: Record<string, unknown>): MonthlyStaffReport {
  return {
    id,
    title: (data.title as string) ?? "",
    month: (data.month as number) ?? 1,
    year: (data.year as number) ?? new Date().getFullYear(),
    uploadedBy: (data.uploadedBy as string) ?? "",
    uploadedByUid: (data.uploadedByUid as string) ?? "",
    uploadedByRole: (data.uploadedByRole as MonthlyReportAuthorRole) ?? "counsellor",
    campusId: (data.campusId as string) ?? "",
    collegeId: (data.collegeId as string) ?? "",
    recipientUids: (data.recipientUids as string[]) ?? [],
    downloadURL: (data.downloadURL as string) ?? "",
    storagePath: (data.storagePath as string) ?? "",
    fileName: (data.fileName as string) ?? "",
    uploadedAt:
      (data.uploadedAt as { toDate?: () => Date })?.toDate?.()?.toISOString?.() ??
      new Date().toISOString(),
    status: (data.status as MonthlyStaffReportStatus) ?? "pending",
    verifiedBy: (data.verifiedBy as string | undefined) ?? undefined,
    verifiedByUid: (data.verifiedByUid as string | undefined) ?? undefined,
    verifiedAt:
      (data.verifiedAt as { toDate?: () => Date } | undefined)?.toDate?.()?.toISOString?.() ?? undefined,
    headNotes: (data.headNotes as string | undefined) ?? undefined,
  };
}

import { addDoc, collection, deleteDoc, doc, getDocs, query, updateDoc, where } from "firebase/firestore";
import { db } from "./config";
import type { WorksheetRowStatus } from "../../types/worksheet";
import type { WorkloadFeedback, WorkloadGroup, WorkloadRow } from "../../types/workloadSheet";

function rowsCollection(ownerUid: string) {
  return collection(db, "workloadSheets", ownerUid, "rows");
}

/** Rows for one person on one campus, in their saved order. The campusId filter
    is required so the security rule can be proven from the query alone. */
export async function listWorkloadRows(ownerUid: string, campusId: string): Promise<WorkloadRow[]> {
  const q = query(rowsCollection(ownerUid), where("campusId", "==", campusId));
  const snapshot = await getDocs(q);
  return snapshot.docs
    .map((d) => ({ id: d.id, ...d.data() }) as WorkloadRow)
    .sort((a, b) => a.order - b.order);
}

export interface WorkloadRowInput {
  group: WorkloadGroup;
  topic: string;
  timelineMonth: string;
  sessionDates: string;
  /** null clears the value (Firestore rejects undefined). */
  durationMinutes?: number | null;
  attendance?: number | null;
  feedback?: WorkloadFeedback | null;
}

export async function addWorkloadRow(
  ownerUid: string,
  campusId: string,
  input: WorkloadRowInput,
  createdBy: string,
  existingRows: WorkloadRow[],
): Promise<string> {
  const nextOrder = existingRows.reduce((max, row) => Math.max(max, row.order), -1) + 1;
  const now = Date.now();
  const docRef = await addDoc(rowsCollection(ownerUid), {
    ownerUid,
    campusId,
    ...input,
    status: "pending" satisfies WorksheetRowStatus,
    order: nextOrder,
    createdBy,
    createdAt: now,
    updatedAt: now,
  });
  return docRef.id;
}

export async function updateWorkloadRow(
  ownerUid: string,
  rowId: string,
  patch: Partial<WorkloadRowInput>,
): Promise<void> {
  await updateDoc(doc(db, "workloadSheets", ownerUid, "rows", rowId), {
    ...patch,
    updatedAt: Date.now(),
  });
}

export async function setWorkloadRowStatus(
  ownerUid: string,
  rowId: string,
  status: WorksheetRowStatus,
): Promise<void> {
  await updateDoc(doc(db, "workloadSheets", ownerUid, "rows", rowId), {
    status,
    updatedAt: Date.now(),
  });
}

export async function deleteWorkloadRow(ownerUid: string, rowId: string): Promise<void> {
  await deleteDoc(doc(db, "workloadSheets", ownerUid, "rows", rowId));
}

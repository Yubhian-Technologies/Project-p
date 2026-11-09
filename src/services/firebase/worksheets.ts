import { addDoc, collection, deleteDoc, doc, getDocs, query, updateDoc, where, writeBatch } from "firebase/firestore";
import { db } from "./config";
import type { Worksheet, WorksheetAcademicYear, WorksheetRow, WorksheetRowStatus } from "../../types/worksheet";

const yearsCollection = collection(db, "worksheetAcademicYears");
const worksheetsCollection = collection(db, "worksheets");

function rowsCollection(worksheetId: string) {
  return collection(db, "worksheets", worksheetId, "rows");
}

export async function listWorksheetAcademicYears(campusId: string): Promise<WorksheetAcademicYear[]> {
  const q = query(yearsCollection, where("campusId", "==", campusId));
  const snapshot = await getDocs(q);
  return snapshot.docs
    .map((d) => ({ id: d.id, ...d.data() }) as WorksheetAcademicYear)
    .sort((a, b) => a.createdAt - b.createdAt);
}

export async function createWorksheetAcademicYear(
  campusId: string,
  label: string,
  createdBy: string,
): Promise<string> {
  const docRef = await addDoc(yearsCollection, {
    campusId,
    label,
    createdBy,
    createdAt: Date.now(),
  });
  return docRef.id;
}

// Cascades: deleting a year deletes every worksheet under it and each of
// those worksheets' rows.
export async function deleteWorksheetAcademicYear(id: string, campusId: string): Promise<void> {
  // The security rule checks campusId on every matched document, so a list
  // query must filter on it directly too — Firestore rejects the whole query
  // outright if it can't prove every possible match satisfies the rule from
  // the query's own filters alone (unlike a single get(), which is fine).
  const worksheetsSnapshot = await getDocs(
    query(worksheetsCollection, where("campusId", "==", campusId), where("academicYearId", "==", id)),
  );
  await Promise.all(worksheetsSnapshot.docs.map((d) => deleteWorksheet(d.id, campusId)));
  await deleteDoc(doc(db, "worksheetAcademicYears", id));
}

export async function listWorksheets(campusId: string, academicYearId: string): Promise<Worksheet[]> {
  const q = query(worksheetsCollection, where("campusId", "==", campusId), where("academicYearId", "==", academicYearId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Worksheet).sort((a, b) => a.createdAt - b.createdAt);
}

export async function createWorksheet(
  campusId: string,
  academicYearId: string,
  name: string,
  createdBy: string,
): Promise<string> {
  const docRef = await addDoc(worksheetsCollection, {
    campusId,
    academicYearId,
    name,
    createdBy,
    createdAt: Date.now(),
  });
  return docRef.id;
}

// Cascades: deleting a worksheet deletes every row written under it.
export async function deleteWorksheet(id: string, campusId: string): Promise<void> {
  const rowsSnapshot = await getDocs(query(rowsCollection(id), where("campusId", "==", campusId)));
  await Promise.all(rowsSnapshot.docs.map((d) => deleteDoc(d.ref)));
  await deleteDoc(doc(db, "worksheets", id));
}

export async function listWorksheetRows(worksheetId: string, campusId: string): Promise<WorksheetRow[]> {
  const q = query(rowsCollection(worksheetId), where("campusId", "==", campusId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as WorksheetRow).sort((a, b) => a.order - b.order);
}

export async function addWorksheetRows(
  worksheetId: string,
  campusId: string,
  input: {
    assignees: Array<{ counsellorId: string; counsellorName: string }>;
    month: string;
    topic: string;
    dates: string;
    time: string;
  },
  createdBy: string,
): Promise<void> {
  if (input.assignees.length === 0) {
    throw new Error("Assign at least one counsellor or head.");
  }
  if (new Set(input.assignees.map((assignee) => assignee.counsellorId)).size !== input.assignees.length) {
    throw new Error("Each counsellor or head can only be assigned once per row.");
  }

  const existingRows = await listWorksheetRows(worksheetId, campusId);
  const firstOrder = existingRows.reduce((max, row) => Math.max(max, row.order), -1) + 1;
  const now = Date.now();
  const batch = writeBatch(db);

  input.assignees.forEach((assignee, index) => {
    batch.set(doc(rowsCollection(worksheetId)), {
      campusId,
      ...assignee,
      month: input.month,
      topic: input.topic,
      dates: input.dates,
      time: input.time,
      status: "pending" satisfies WorksheetRowStatus,
      order: firstOrder + index,
      createdBy,
      createdAt: now,
      updatedAt: now,
    });
  });

  await batch.commit();
}

export async function updateWorksheetRow(
  worksheetId: string,
  rowId: string,
  patch: Partial<Pick<WorksheetRow, "counsellorId" | "counsellorName" | "month" | "topic" | "dates" | "time">>,
): Promise<void> {
  await updateDoc(doc(db, "worksheets", worksheetId, "rows", rowId), {
    ...patch,
    updatedAt: Date.now(),
  });
}

export async function updateWorksheetRowWithAssignees(
  worksheetId: string,
  campusId: string,
  rowId: string,
  input: {
    assignees: Array<{ counsellorId: string; counsellorName: string }>;
    month: string;
    topic: string;
    dates: string;
    time: string;
  },
  createdBy: string,
): Promise<void> {
  if (input.assignees.length === 0) {
    throw new Error("Assign at least one counsellor or head.");
  }
  if (input.assignees.length > 500) {
    throw new Error("A worksheet row cannot be assigned to more than 500 people.");
  }
  if (new Set(input.assignees.map((assignee) => assignee.counsellorId)).size !== input.assignees.length) {
    throw new Error("Each counsellor or head can only be assigned once per row.");
  }

  const existingRows = await listWorksheetRows(worksheetId, campusId);
  const row = existingRows.find((existingRow) => existingRow.id === rowId);
  if (!row) {
    throw new Error("This worksheet row no longer exists. Reload the worksheet and try again.");
  }

  const now = Date.now();
  const batch = writeBatch(db);
  const rowRef = doc(rowsCollection(worksheetId), rowId);
  batch.update(rowRef, {
    counsellorId: input.assignees[0].counsellorId,
    counsellorName: input.assignees[0].counsellorName,
    month: input.month,
    topic: input.topic,
    dates: input.dates,
    time: input.time,
    updatedAt: now,
  });

  const firstOrder = existingRows.reduce((max, existingRow) => Math.max(max, existingRow.order), -1) + 1;
  input.assignees.slice(1).forEach((assignee, index) => {
    batch.set(doc(rowsCollection(worksheetId)), {
      campusId,
      ...assignee,
      month: input.month,
      topic: input.topic,
      dates: input.dates,
      time: input.time,
      status: "pending" satisfies WorksheetRowStatus,
      order: firstOrder + index,
      createdBy,
      createdAt: now,
      updatedAt: now,
    });
  });

  await batch.commit();
}

export async function toggleWorksheetRowStatus(
  worksheetId: string,
  rowId: string,
  status: WorksheetRowStatus,
): Promise<void> {
  await updateDoc(doc(db, "worksheets", worksheetId, "rows", rowId), {
    status,
    updatedAt: Date.now(),
  });
}

export async function deleteWorksheetRow(worksheetId: string, rowId: string): Promise<void> {
  await deleteDoc(doc(db, "worksheets", worksheetId, "rows", rowId));
}

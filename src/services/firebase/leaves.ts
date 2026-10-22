import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
  orderBy,
} from "firebase/firestore";
import { db } from "./config";
import type { LeaveRequest, LeaveDuration, LeaveType, ActiveLeaveInfo } from "../../types/leave";

const LEAVES_COLLECTION = "leaves";

/**
 * Returns today's date formatted as YYYY-MM-DD in local time
 */
export function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Checks if a given leave is active on targetDate (defaults to today)
 */
export function isLeaveActiveOnDate(leave: LeaveRequest, targetDate?: string): boolean {
  if (leave.status !== "approved") return false;
  const date = targetDate || getTodayDateString();
  return date >= leave.startDate && date <= leave.endDate;
}

/**
 * Apply for a new leave by a Counsellor or Head
 */
export async function applyLeave(params: {
  applicantUid: string;
  applicantName: string;
  applicantEmail: string;
  applicantRole: "counsellor" | "head";
  applicantPhotoURL?: string;
  campusId: string;
  campusName?: string;
  collegeId?: string;
  collegeName?: string;
  startDate: string;
  endDate: string;
  duration: LeaveDuration;
  type: LeaveType;
  reason: string;
}): Promise<string> {
  const leavesRef = collection(db, LEAVES_COLLECTION);
  const newDoc = doc(leavesRef);
  const now = Date.now();

  const leave: LeaveRequest = {
    id: newDoc.id,
    ...params,
    status: "pending",
    createdAt: now,
    updatedAt: now,
  };

  await setDoc(newDoc, leave);
  return newDoc.id;
}

/**
 * Listen in real-time to leaves submitted by a specific user (Counsellor or Head)
 */
export function subscribeLeavesByApplicant(
  applicantUid: string,
  callback: (leaves: LeaveRequest[]) => void,
): () => void {
  const q = query(
    collection(db, LEAVES_COLLECTION),
    where("applicantUid", "==", applicantUid),
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const leaves = snapshot.docs
        .map((d) => d.data() as LeaveRequest)
        .sort((a, b) => b.createdAt - a.createdAt);
      callback(leaves);
    },
    (err) => {
      console.error("Error subscribing to applicant leaves:", err);
      callback([]);
    },
  );
}

/**
 * Listen in real-time to leaves belonging to a specific college (for Principal / Vice-Principal)
 */
export function subscribeLeavesForCollege(
  collegeId: string,
  callback: (leaves: LeaveRequest[]) => void,
): () => void {
  const q = query(
    collection(db, LEAVES_COLLECTION),
    where("collegeId", "==", collegeId),
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const leaves = snapshot.docs
        .map((d) => d.data() as LeaveRequest)
        .sort((a, b) => b.createdAt - a.createdAt);
      callback(leaves);
    },
    (err) => {
      console.error("Error subscribing to college leaves:", err);
      callback([]);
    },
  );
}

/**
 * Listen in real-time to leaves for an entire campus (for Campus Head & Admins)
 */
export function subscribeLeavesForCampus(
  campusId: string,
  callback: (leaves: LeaveRequest[]) => void,
): () => void {
  const q = query(
    collection(db, LEAVES_COLLECTION),
    where("campusId", "==", campusId),
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const leaves = snapshot.docs
        .map((d) => d.data() as LeaveRequest)
        .sort((a, b) => b.createdAt - a.createdAt);
      callback(leaves);
    },
    (err) => {
      console.error("Error subscribing to campus leaves:", err);
      callback([]);
    },
  );
}

/**
 * Listen in real-time to all leaves (Super Admin)
 */
export function subscribeAllLeaves(
  callback: (leaves: LeaveRequest[]) => void,
): () => void {
  const q = query(collection(db, LEAVES_COLLECTION));

  return onSnapshot(
    q,
    (snapshot) => {
      const leaves = snapshot.docs
        .map((d) => d.data() as LeaveRequest)
        .sort((a, b) => b.createdAt - a.createdAt);
      callback(leaves);
    },
    (err) => {
      console.error("Error subscribing to all leaves:", err);
      callback([]);
    },
  );
}

/**
 * Approve a leave request by a Principal or Vice-Principal
 * Either one approving sets the status to "approved".
 */
export async function approveLeave(
  leaveId: string,
  reviewer: {
    uid: string;
    name: string;
    role: "principal" | "vice-principal" | "admin" | "super-admin";
  },
  remarks?: string,
): Promise<void> {
  const leaveRef = doc(db, LEAVES_COLLECTION, leaveId);
  const now = Date.now();

  await updateDoc(leaveRef, {
    status: "approved",
    reviewedByUid: reviewer.uid,
    reviewedByName: reviewer.name,
    reviewedByRole: reviewer.role,
    reviewedAt: now,
    reviewRemarks: remarks || "",
    updatedAt: now,
  });
}

/**
 * Disapprove a leave request by a Principal or Vice-Principal
 */
export async function disapproveLeave(
  leaveId: string,
  reviewer: {
    uid: string;
    name: string;
    role: "principal" | "vice-principal" | "admin" | "super-admin";
  },
  remarks?: string,
): Promise<void> {
  const leaveRef = doc(db, LEAVES_COLLECTION, leaveId);
  const now = Date.now();

  await updateDoc(leaveRef, {
    status: "disapproved",
    reviewedByUid: reviewer.uid,
    reviewedByName: reviewer.name,
    reviewedByRole: reviewer.role,
    reviewedAt: now,
    reviewRemarks: remarks || "",
    updatedAt: now,
  });
}

/**
 * Cancel a leave request by the applicant (Counsellor or Head)
 * Flexible: can be cancelled when pending OR after being approved.
 */
export async function cancelLeave(
  leaveId: string,
  cancelledByUid: string,
  cancellationReason?: string,
): Promise<void> {
  const leaveRef = doc(db, LEAVES_COLLECTION, leaveId);
  const now = Date.now();

  await updateDoc(leaveRef, {
    status: "cancelled",
    cancelledAt: now,
    cancelledByUid,
    cancellationReason: cancellationReason || "",
    updatedAt: now,
  });
}

/**
 * Subscribe to all active approved leaves today mapped by applicantUid
 * Used across the platform to show the real-time "On Leave" badge on Counsellor profiles
 */
export function subscribeActiveLeavesToday(
  callback: (activeLeavesMap: Record<string, LeaveRequest>) => void,
): () => void {
  const today = getTodayDateString();
  const q = query(
    collection(db, LEAVES_COLLECTION),
    where("status", "==", "approved"),
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const map: Record<string, LeaveRequest> = {};
      snapshot.docs.forEach((d) => {
        const leave = d.data() as LeaveRequest;
        if (today >= leave.startDate && today <= leave.endDate) {
          map[leave.applicantUid] = leave;
        }
      });
      callback(map);
    },
    (err) => {
      console.error("Error subscribing to active leaves:", err);
      callback({});
    },
  );
}

/**
 * Formats a leave request date range into human-readable text
 * Example: "Oct 22 - Oct 24, 2026 (Full Day)"
 */
export function formatLeaveRange(leave: LeaveRequest): string {
  const durationLabel =
    leave.duration === "half_day_morning"
      ? "Half Day (Morning)"
      : leave.duration === "half_day_afternoon"
      ? "Half Day (Afternoon)"
      : "Full Day";

  if (leave.startDate === leave.endDate) {
    return `${leave.startDate} • ${durationLabel}`;
  }
  return `${leave.startDate} to ${leave.endDate} • ${durationLabel}`;
}

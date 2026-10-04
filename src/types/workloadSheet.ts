import type { WorksheetRowStatus } from "./worksheet";

export type WorkloadGroup = "compulsory" | "optional" | "action";

export const WORKLOAD_GROUP_LABELS: Record<WorkloadGroup, string> = {
  compulsory: "Compulsory",
  optional: "Optional",
  action: "Action Items",
};

export type WorkloadFeedback = "yes" | "no";

/** One person's workload sheet. The document id is the owner's uid. */
export interface WorkloadSheet {
  ownerUid: string;
  campusId: string;
  createdAt: number;
}

export interface WorkloadRow {
  id: string;
  ownerUid: string;
  campusId: string;
  group: WorkloadGroup;
  topic: string;
  timelineMonth: string;
  sessionDates: string;
  status: WorksheetRowStatus;
  durationMinutes?: number | null;
  attendance?: number | null;
  feedback?: WorkloadFeedback | null;
  order: number;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
}

export type LeaveType = "casual" | "sick" | "personal" | "emergency" | "duty" | "other";

export type LeaveDuration = "full_day" | "half_day_morning" | "half_day_afternoon";

export type LeaveStatus = "pending" | "approved" | "disapproved" | "cancelled";

export interface LeaveRequest {
  id: string;
  applicantUid: string;
  applicantName: string;
  applicantEmail: string;
  applicantRole: "counsellor" | "head";
  applicantPhotoURL?: string;
  campusId: string;
  campusName?: string;
  collegeId?: string;
  collegeName?: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  duration: LeaveDuration;
  type: LeaveType;
  reason: string;
  status: LeaveStatus;

  // Principal / Vice-Principal review details
  // Note: One approval from either Principal OR Vice-Principal is sufficient
  reviewedByUid?: string;
  reviewedByName?: string;
  reviewedByRole?: "principal" | "vice-principal" | "admin" | "super-admin";
  reviewedAt?: number;
  reviewRemarks?: string;

  // Self-service cancellation details (flexible before or after approval)
  cancelledAt?: number;
  cancelledByUid?: string;
  cancellationReason?: string;

  createdAt: number;
  updatedAt: number;
}

export interface ActiveLeaveInfo {
  isOnLeave: boolean;
  activeLeave?: LeaveRequest;
  leaveText?: string;
}

export type BookingStatus =
  | "pending"
  | "accepted"
  | "scheduled"
  | "rejected"
  | "cancelled"
  | "completed";

export type BookingOutcome = "completed" | "followup" | "missed";

export interface RescheduleProposal {
  proposedBy: "user" | "counsellor";
  proposedAt: number; // epoch ms of the newly proposed session time
  reason?: string;
  createdAt: number;
}

export interface TransferRequest {
  requestedBy: string; // counsellor uid
  requestedByEmail: string;
  reason?: string;
  suggestedTargetId?: string;
  suggestedTargetEmail?: string;
  status: "pending" | "approved" | "declined";
  createdAt: number;
  decidedBy?: string; // head uid
  decisionNote?: string;
}

export interface Booking {
  id: string;
  userId: string;
  userEmail: string;
  counsellorId: string;
  counsellorEmail: string;
  status: BookingStatus;
  scheduledAt?: number;
  durationMinutes: number;
  outcome?: BookingOutcome;
  followUpOfBookingId?: string;
  cancelledBy?: "user" | "counsellor";
  cancellationReason?: string;
  missedReason?: string;
  missedNotified?: boolean;
  transferredFrom?: string;
  userRatingOfCounsellor?: number;
  userReviewText?: string;
  counsellorRatingOfUser?: number;
  counsellorNoteOnUser?: string;
  sessionMode?: "online" | "offline";
  isEmergency?: boolean;
  campusId?: string; // set on every booking so campus staff (e.g. the Head) can find it
  proposedSlots?: [number, number]; // the two times the student proposed at request time
  rescheduleProposal?: RescheduleProposal;
  transferRequest?: TransferRequest;
  createdAt: number;
  updatedAt: number;
}

export interface BookingIntake {
  username: string;
  occupation: "student" | "professional";
  whatsappNumber: string;
  issue: string;
  summary?: string;
}

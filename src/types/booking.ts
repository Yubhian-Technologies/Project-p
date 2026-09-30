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

export interface CompensationOffer {
  offeredBy: string; // head uid
  offeredByEmail: string;
  status: "pending" | "accepted" | "declined";
  createdAt: number;
  decidedAt?: number;
  compensationBookingId?: string; // set once the Head schedules the new session
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
  ratedAt?: number;
  counsellorRatingOfUser?: number;
  counsellorNoteOnUser?: string;
  counsellorRatedAt?: number;
  sessionMode?: "online" | "offline";
  isEmergency?: boolean;
  /** Set once the counsellor/head has suggested the SSI test — keeps the button
      a one-time action across reopening the details popup, not just per-session. */
  ssiSuggestedAt?: number;
  /** Set by the scheduled reminder job (see functions/) once the "starting
      now" notification has gone out, so it's never sent twice. */
  reminderStartSent?: boolean;
  campusId?: string; // set on every booking so campus staff (e.g. the Head) can find it
  /** The counsellor/head's session summary, explicitly shared with the
      student — a separate copy from the private working notes in the
      intake doc, so only the counsellor/head ever controls what (and
      whether) the student sees. */
  sharedSummary?: string;
  sharedSummaryAt?: number;
  proposedSlots?: [number, number]; // the two times the student proposed at request time
  rescheduleProposal?: RescheduleProposal;
  transferRequest?: TransferRequest;
  compensationOffer?: CompensationOffer;
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

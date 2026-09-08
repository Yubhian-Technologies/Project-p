export type BookingStatus =
  | "pending"
  | "accepted"
  | "scheduled"
  | "rejected"
  | "cancelled"
  | "completed";

export type BookingOutcome = "completed" | "followup";

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
  transferredFrom?: string;
  userRatingOfCounsellor?: number;
  userReviewText?: string;
  counsellorRatingOfUser?: number;
  counsellorNoteOnUser?: string;
  sessionMode?: "online" | "offline";
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

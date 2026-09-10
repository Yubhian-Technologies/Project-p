export type NotificationType =
  | "booking_requested"
  | "booking_accepted"
  | "booking_rejected"
  | "booking_scheduled"
  | "booking_cancelled"
  | "booking_transferred"
  | "booking_completed"
  | "booking_missed"
  | "session_needs_review"
  | "followup_scheduled"
  | "emergency_sos"
  | "reschedule_requested"
  | "reschedule_accepted"
  | "transfer_requested"
  | "transfer_declined";

export interface Notification {
  id: string;
  recipientId: string;
  type: NotificationType;
  bookingId: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: number;
}

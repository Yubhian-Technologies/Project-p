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
  | "feedback_submitted"
  | "ssi_test"
  | "ssi_suggested"
  | "session_reminder"
  | "chat_message"
  | "followup_scheduled"
  | "emergency_sos"
  | "reschedule_requested"
  | "reschedule_accepted"
  | "transfer_requested"
  | "transfer_declined"
  | "event_added"
  | "monthly_report_uploaded";

export interface Notification {
  id: string;
  recipientId: string;
  type: NotificationType;
  bookingId?: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: number;
}

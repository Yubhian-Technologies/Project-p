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
  | "compensation_offered"
  | "compensation_accepted"
  | "compensation_declined"
  | "feedback_submitted"
  | "ssi_test"
  | "ssi_suggested"
  | "session_reminder"
  | "chat_message"
  | "session_resource_added"
  | "followup_scheduled"
  | "emergency_sos"
  | "emergency_sos_claimed"
  | "reschedule_requested"
  | "reschedule_accepted"
  | "transfer_requested"
  | "transfer_declined"
  | "event_added"
  | "event_today"
  | "monthly_report_uploaded"
  | "journal_entry_shared"
  | "session_summary_shared"
  | "team_chat_message";

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

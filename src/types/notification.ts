export type NotificationType =
  | "booking_requested"
  | "booking_accepted"
  | "booking_rejected"
  | "booking_scheduled"
  | "booking_cancelled"
  | "booking_transferred"
  | "booking_completed"
  | "followup_scheduled";

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

export interface ChatMessage {
  id: string;
  chatRoomId: string;
  bookingId?: string;
  senderUid: string;
  senderEmail: string;
  senderName: string;
  senderRole: "user" | "counsellor" | "head" | "admin" | "super-admin";
  text: string;
  createdAt: number;
}

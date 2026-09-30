export interface TeamChatMessage {
  id: string;
  campusId: string;
  senderUid: string;
  senderEmail: string;
  senderName: string;
  senderRole: "counsellor" | "head";
  text: string;
  createdAt: number;
}

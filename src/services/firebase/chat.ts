import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { db } from "./config";
import { createNotification } from "./notifications";
import type { ChatMessage } from "../../types/chat";

export async function sendChatMessage(params: {
  chatRoomId: string;
  bookingId?: string;
  senderUid: string;
  senderEmail: string;
  senderName: string;
  senderRole: "user" | "counsellor" | "head" | "admin" | "super-admin";
  text: string;
}): Promise<string> {
  const docRef = await addDoc(collection(db, "chat_messages"), {
    ...params,
    createdAt: Date.now(),
  });
  await notifyCounterpart(params);
  return docRef.id;
}

// Fires an in-app "chat_message" notification to the other party on the same
// booking (which the onNotificationCreated cloud function also mirrors to
// WhatsApp). Best-effort: a missing booking or a failed notification must
// never block the message itself.
async function notifyCounterpart(params: {
  chatRoomId: string;
  senderUid: string;
  senderName: string;
  text: string;
}): Promise<void> {
  try {
    const bookingSnapshot = await getDoc(doc(db, "bookings", params.chatRoomId));
    if (!bookingSnapshot.exists()) return;
    const booking = bookingSnapshot.data();
    const recipientId = booking.userId === params.senderUid ? booking.counsellorId : booking.userId;
    if (!recipientId || recipientId === params.senderUid) return;

    const preview = params.text.length > 60 ? `${params.text.slice(0, 60)}…` : params.text;
    await createNotification({
      recipientId,
      type: "chat_message",
      bookingId: params.chatRoomId,
      title: "New chat message",
      message: `${params.senderName}: ${preview}`,
    });
  } catch (error) {
    console.error("Failed to notify chat counterpart", error);
  }
}

export function subscribeChatMessages(
  chatRoomId: string,
  callback: (messages: ChatMessage[]) => void,
): () => void {
  // No orderBy here: a filtered query on a single field only needs Firestore's
  // automatic single-field index, so it works immediately without waiting for
  // a composite index to build. Messages are sorted client-side by createdAt.
  const q = query(
    collection(db, "chat_messages"),
    where("chatRoomId", "==", chatRoomId),
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const list: ChatMessage[] = snapshot.docs
        .map((doc) => ({
          id: doc.id,
          ...(doc.data() as Omit<ChatMessage, "id">),
        }))
        .sort((a, b) => a.createdAt - b.createdAt);
      callback(list);
    },
    (error) => {
      console.error("Chat subscription failed — check you are a participant of this booking:", error);
    },
  );
}

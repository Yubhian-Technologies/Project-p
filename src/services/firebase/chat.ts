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
    const userId = typeof booking.userId === "string" ? booking.userId : undefined;
    const counsellorId = typeof booking.counsellorId === "string" ? booking.counsellorId : undefined;

    // A Head (or Admin/Super Admin) reading/replying in a session's chat they
    // oversee is neither the student nor the assigned counsellor, so a single
    // "the other party" lookup can't name one recipient for them — notify
    // BOTH parties in that case, since neither has been addressed specifically.
    // (Previously this fell through to always naming the student regardless
    // of who the third party actually was, so the counsellor never learned a
    // Head had messaged into their session.)
    let recipientIds: string[];
    if (params.senderUid === userId) recipientIds = counsellorId ? [counsellorId] : [];
    else if (params.senderUid === counsellorId) recipientIds = userId ? [userId] : [];
    else recipientIds = [userId, counsellorId].filter((id): id is string => !!id);

    const preview = params.text.length > 60 ? `${params.text.slice(0, 60)}…` : params.text;
    await Promise.all(
      recipientIds
        .filter((recipientId) => recipientId !== params.senderUid)
        .map((recipientId) =>
          createNotification({
            recipientId,
            type: "chat_message",
            bookingId: params.chatRoomId,
            title: "New chat message",
            message: `${params.senderName}: ${preview}`,
          }),
        ),
    );
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

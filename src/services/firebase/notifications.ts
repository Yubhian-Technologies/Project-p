import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "./config";
import type { Notification } from "../../types/notification";

const notificationsCollection = collection(db, "notifications");

function toNotification(id: string, data: Record<string, unknown>): Notification {
  return { id, ...data } as Notification;
}

export async function createNotification(
  input: Omit<Notification, "id" | "read" | "createdAt">,
): Promise<void> {
  try {
    await addDoc(notificationsCollection, {
      ...input,
      read: false,
      createdAt: Date.now(),
    });
  } catch (error) {
    console.error("Failed to create notification", error);
  }
}

export function subscribeToNotifications(
  recipientId: string,
  onChange: (notifications: Notification[]) => void,
): Unsubscribe {
  const q = query(
    notificationsCollection,
    where("recipientId", "==", recipientId),
    orderBy("createdAt", "desc"),
  );
  return onSnapshot(
    q,
    (snapshot) => {
      onChange(snapshot.docs.map((d) => toNotification(d.id, d.data())));
    },
    (error) => {
      console.error("Failed to subscribe to notifications", error);
    },
  );
}

export async function markNotificationRead(id: string): Promise<void> {
  await updateDoc(doc(db, "notifications", id), { read: true });
}

export async function markAllNotificationsRead(notifications: Notification[]): Promise<void> {
  await Promise.all(
    notifications.filter((n) => !n.read).map((n) => markNotificationRead(n.id)),
  );
}

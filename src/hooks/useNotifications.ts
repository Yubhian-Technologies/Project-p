import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "./useAuth";
import { useToast } from "../context/ToastContext";
import type { ToastVariant } from "../context/ToastContext";
import {
  markAllNotificationsRead,
  markNotificationRead,
  subscribeToNotifications,
} from "../services/firebase/notifications";
import type { Notification, NotificationType } from "../types/notification";

const ERROR_TYPES: NotificationType[] = [
  "emergency_sos",
  "emergency_sos_claimed",
  "booking_rejected",
  "booking_cancelled",
  "booking_missed",
  "transfer_declined",
  "compensation_declined",
];
const EVENT_TYPES: NotificationType[] = ["event_today", "event_added"];
const SUCCESS_TYPES: NotificationType[] = [
  "booking_accepted",
  "booking_scheduled",
  "booking_completed",
  "compensation_accepted",
  "reschedule_accepted",
];

function variantFor(type: NotificationType): ToastVariant {
  if (ERROR_TYPES.includes(type)) return "error";
  if (EVENT_TYPES.includes(type)) return "event";
  if (SUCCESS_TYPES.includes(type)) return "success";
  return "info";
}

export function useNotifications() {
  const { profile } = useAuth();
  const { showToast } = useToast();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  // Tracks which notification ids we've already shown a toast for, so the
  // very first snapshot (everything that already existed) never floods the
  // screen with toasts — only docs that arrive *after* that initial load do.
  const knownIds = useRef<Set<string> | null>(null);

  useEffect(() => {
    knownIds.current = null;
    if (!profile) {
      setNotifications([]);
      return;
    }
    const unsubscribe = subscribeToNotifications(profile.uid, (list) => {
      if (knownIds.current === null) {
        knownIds.current = new Set(list.map((n) => n.id));
      } else {
        for (const n of list) {
          if (knownIds.current.has(n.id)) continue;
          knownIds.current.add(n.id);
          showToast({ title: n.title, message: n.message, variant: variantFor(n.type) });
        }
      }
      setNotifications(list);
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);

  return {
    notifications,
    unreadCount,
    markAsRead: markNotificationRead,
    markAllAsRead: () => markAllNotificationsRead(notifications),
  };
}

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "./useAuth";
import {
  markAllNotificationsRead,
  markNotificationRead,
  subscribeToNotifications,
} from "../services/firebase/notifications";
import type { Notification } from "../types/notification";

export function useNotifications() {
  const { profile } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    if (!profile) {
      setNotifications([]);
      return;
    }
    const unsubscribe = subscribeToNotifications(profile.uid, setNotifications);
    return unsubscribe;
  }, [profile]);

  const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);

  return {
    notifications,
    unreadCount,
    markAsRead: markNotificationRead,
    markAllAsRead: () => markAllNotificationsRead(notifications),
  };
}

import { useEffect, useRef, useState } from "react";
import { useNotifications } from "../../hooks/useNotifications";
import "./NotificationBell.css";

export function NotificationBell() {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div className="notification-bell" ref={containerRef}>
      <button
        type="button"
        className="notification-bell__trigger"
        aria-label="Notifications"
        onClick={() => setOpen((value) => !value)}
      >
        <svg
          className="notification-bell__icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M6 8a6 6 0 0 1 12 0c0 4 1.5 5.5 2 6.5H4c.5-1 2-2.5 2-6.5" />
          <path d="M10 19a2 2 0 0 0 4 0" />
        </svg>
        {unreadCount > 0 && <span className="notification-bell__badge">{unreadCount}</span>}
      </button>

      {open && (
        <div className="notification-bell__panel">
          <div className="notification-bell__header">
            <span>Notifications</span>
            {unreadCount > 0 && (
              <button type="button" className="notification-bell__mark-all" onClick={markAllAsRead}>
                Mark all as read
              </button>
            )}
          </div>

          <div className="notification-bell__list">
            {notifications.length === 0 && (
              <p className="notification-bell__empty">No notifications yet</p>
            )}
            {notifications.map((notification) => (
              <button
                key={notification.id}
                type="button"
                className={[
                  "notification-bell__item",
                  notification.read ? "" : "notification-bell__item--unread",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => markAsRead(notification.id)}
              >
                <span className="notification-bell__item-title">{notification.title}</span>
                <span className="notification-bell__item-message">{notification.message}</span>
                <span className="notification-bell__item-time">
                  {new Date(notification.createdAt).toLocaleString()}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

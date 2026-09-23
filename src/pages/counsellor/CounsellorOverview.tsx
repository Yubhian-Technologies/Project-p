import { useEffect, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import {
  getBookingIntake,
  listBookingsForCounsellor,
} from "../../services/firebase/bookings";
import { subscribeToNotifications } from "../../services/firebase/notifications";
import type { Notification } from "../../types/notification";
import "./CounsellorOverview.css";

interface TimelineRow {
  id: string;
  time: string;
  student: string;
  type: string;
  mode: string;
  status: "Confirmed" | "Pending" | "Completed" | "Missed";
}

function startOfToday(): number {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
}

function isToday(ts: number): boolean {
  const start = startOfToday();
  return ts >= start && ts < start + 24 * 60 * 60 * 1000;
}

export function CounsellorOverview() {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [appointmentsToday, setAppointmentsToday] = useState(0);
  const [pendingRequests, setPendingRequests] = useState(0);
  const [followUps, setFollowUps] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [timeline, setTimeline] = useState<TimelineRow[]>([]);

  useEffect(() => {
    if (!currentUser) return;
    let active = true;

    const unsub = subscribeToNotifications(currentUser.uid, (list: Notification[]) => {
      if (!active) return;
      setUnreadMessages(list.filter((n) => n.type === "chat_message" && !n.read).length);
    });

    (async () => {
      try {
        const bookings = await listBookingsForCounsellor(currentUser.uid);
        if (!active) return;

        const todaySessions = bookings.filter(
          (b) =>
            b.scheduledAt &&
            isToday(b.scheduledAt) &&
            ["accepted", "scheduled", "completed"].includes(b.status),
        );
        setAppointmentsToday(todaySessions.filter((b) => b.outcome !== "missed").length);
        setPendingRequests(bookings.filter((b) => b.status === "pending").length);
        // Only still-active follow-ups — the card is labelled "Ongoing", but this
        // counted every follow-up booking ever, including ones long since
        // completed, cancelled, or rejected.
        setFollowUps(
          bookings.filter(
            (b) => b.followUpOfBookingId && ["pending", "accepted", "scheduled"].includes(b.status),
          ).length,
        );

        const intakes = await Promise.all(
          todaySessions.map((b) =>
            getBookingIntake(b.id)
              .then((i) => i)
              .catch(() => null),
          ),
        );
        if (!active) return;

        const rows: TimelineRow[] = todaySessions
          .map<TimelineRow>((b, i) => ({
            id: b.id,
            time: new Date(b.scheduledAt as number).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            }),
            student: intakes[i]?.username || b.userEmail,
            type: b.followUpOfBookingId ? "Follow-up" : b.isEmergency ? "Crisis" : "Individual",
            mode: b.sessionMode === "offline" ? "Offline" : "Online",
            status:
              b.status === "completed"
                ? b.outcome === "missed"
                  ? "Missed"
                  : "Completed"
                : "Confirmed",
          }))
          .sort((a, b) => a.time.localeCompare(b.time));

        setTimeline(rows);
      } catch (error) {
        console.error("Failed to load counsellor overview", error);
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
      unsub();
    };
  }, [currentUser]);

  if (loading) return null;

  return (
    <div className="counsellor-overview">
      {/* ── 4 KPI Stat Summary Cards Row ────────────────────────────── */}
      <div className="counsellor-overview__kpi-grid">
        <div className="counsellor-overview__kpi-card">
          <div className="counsellor-overview__kpi-label">Appointments today</div>
          <div className="counsellor-overview__kpi-val">{appointmentsToday}</div>
          <div className="counsellor-overview__kpi-status counsellor-overview__kpi-status--green">
            Today
          </div>
        </div>

        <div className="counsellor-overview__kpi-card">
          <div className="counsellor-overview__kpi-label">Pending requests</div>
          <div className="counsellor-overview__kpi-val">{pendingRequests}</div>
          <div className="counsellor-overview__kpi-status counsellor-overview__kpi-status--green">
            To review
          </div>
        </div>

        <div className="counsellor-overview__kpi-card">
          <div className="counsellor-overview__kpi-label">Follow-ups</div>
          <div className="counsellor-overview__kpi-val">{followUps}</div>
          <div className="counsellor-overview__kpi-status counsellor-overview__kpi-status--green">
            Ongoing
          </div>
        </div>

        <div className="counsellor-overview__kpi-card">
          <div className="counsellor-overview__kpi-label">Unread messages</div>
          <div className="counsellor-overview__kpi-val">{unreadMessages}</div>
          <div className="counsellor-overview__kpi-status counsellor-overview__kpi-status--green">
            In inbox
          </div>
        </div>
      </div>

      {/* ── Today's Timeline Table Section ───────────────────────────── */}
      <div className="counsellor-overview__timeline-card">
        <h3 className="counsellor-overview__title">Today's timeline</h3>
        {timeline.length === 0 ? (
          <p>No sessions scheduled for today.</p>
        ) : (
          <div className="counsellor-overview__table-wrap">
            <table className="counsellor-overview__table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Student</th>
                  <th>Type</th>
                  <th>Mode</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {timeline.map((row) => (
                  <tr key={row.id}>
                    <td className="counsellor-overview__cell-time">{row.time}</td>
                    <td className="counsellor-overview__cell-student">{row.student}</td>
                    <td>{row.type}</td>
                    <td>{row.mode}</td>
                    <td>
                      <span
                        className={`counsellor-overview__badge counsellor-overview__badge--${row.status.toLowerCase()}`}
                      >
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
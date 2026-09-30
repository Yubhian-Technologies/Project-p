import { useEffect, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { listBookingsForCounsellor } from "../../services/firebase/bookings";
import type { Booking } from "../../types/booking";
import {
  TrendingUpIcon,
  CalendarIcon,
  CheckIcon,
  ZapIcon,
  StarIcon,
  SparklesIcon,
  BookOpenIcon,
  MessageCircleIcon,
  AlertTriangleIcon,
} from "../../components/common/icons";
import "./CounsellorHomeActivityOverview.css";

interface CounsellorHomeActivityOverviewProps {
  onSelectSection: (sectionId: string) => void;
}

export function CounsellorHomeActivityOverview({ onSelectSection }: CounsellorHomeActivityOverviewProps) {
  const { profile } = useAuth();
  const [myBookings, setMyBookings] = useState<Booking[]>([]);

  useEffect(() => {
    if (!profile?.uid) return;

    listBookingsForCounsellor(profile.uid)
      .then(setMyBookings)
      .catch((err) => console.error("Failed to load counsellor overview data", err));
  }, [profile?.uid]);

  const pendingBookings = myBookings.filter(
    (b) => b.status === "pending" || b.status === "accepted" || b.status === "scheduled"
  );

  return (
    <div className="cha-overview">
      <div className="cha-header">
        <div>
          <h3 className="cha-header__title"><TrendingUpIcon /> Workspace Activity & Notifications Feed</h3>
          <p className="cha-header__sub">
            Recent session requests and workspace shortcuts.
          </p>
        </div>
      </div>

      <div className="cha-grid">
        {/* Left Column: Session Requests */}
        <div className="cha-card cha-card--main">
          <div className="cha-card__header">
            <div className="cha-card__title-wrap">
              <span className="cha-card__icon"><CalendarIcon /></span>
              <div>
                <h4 className="cha-card__title">Incoming Session Requests</h4>
                <span className="cha-card__subtitle">Student appointments awaiting review</span>
              </div>
            </div>
            {pendingBookings.length > 0 ? (
              <span className="cha-badge cha-badge--pending">{pendingBookings.length} Active</span>
            ) : (
              <span className="cha-badge cha-badge--clear"><CheckIcon width={12} height={12} /> All Clear</span>
            )}
          </div>

          {pendingBookings.length === 0 ? (
            <div className="cha-empty">No active session requests at this time.</div>
          ) : (
            <div className="cha-feed">
              {pendingBookings.slice(0, 4).map((booking) => (
                <div key={booking.id} className="cha-feed__item">
                  <div>
                    <strong className="cha-feed__title">{booking.userEmail}</strong>
<span className="cha-feed__meta">
  <CalendarIcon width={12} height={12} />
  {booking.scheduledAt ? new Date(booking.scheduledAt).toLocaleString("en-IN") : "Pending Slot"} • Status: {booking.status.toUpperCase()}
</span>
                  </div>
                  <button
                    type="button"
                    className="cha-btn-action"
                    onClick={() => onSelectSection("requests")}
                  >
                    Review Request →
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Shortcuts & Quick Jumps */}
        <div className="cha-card cha-card--side">
          <div className="cha-card__header">
            <div className="cha-card__title-wrap">
              <span className="cha-card__icon"><ZapIcon /></span>
              <div>
                <h4 className="cha-card__title">Workspace Shortcuts</h4>
                <span className="cha-card__subtitle">Jump to section</span>
              </div>
            </div>
          </div>

          <div className="cha-shortcuts__list">
<button type="button" onClick={() => onSelectSection("requests")}>
  <CalendarIcon /> Session Requests ({pendingBookings.length})
</button>
<button type="button" onClick={() => onSelectSection("feedback")}>
  <StarIcon /> My Session Feedback
</button>
<button type="button" onClick={() => onSelectSection("events")}>
  <SparklesIcon /> Events & Programs
</button>
<button type="button" onClick={() => onSelectSection("journal")}>
  <BookOpenIcon /> Counselling Journal
</button>
<button type="button" onClick={() => onSelectSection("community")}>
  <MessageCircleIcon /> Wellness Community
</button>
<button type="button" className="cha-btn-urgent" onClick={() => onSelectSection("emergency")}>
  <AlertTriangleIcon /> Emergency Alerts
</button>
          </div>
        </div>
      </div>
    </div>
  );
}

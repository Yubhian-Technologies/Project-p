import { useEffect, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { listBookingsForUser } from "../../services/firebase/bookings";
import type { Booking } from "../../types/booking";
import "./UserHomeActivityOverview.css";

interface UserHomeActivityOverviewProps {
  onSelectSection: (sectionId: string) => void;
}

export function UserHomeActivityOverview({ onSelectSection }: UserHomeActivityOverviewProps) {
  const { profile } = useAuth();
  const [myBookings, setMyBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.uid) return;
    setLoading(true);
    listBookingsForUser(profile.uid)
      .then(setMyBookings)
      .catch((err) => console.error("Failed to load user bookings overview", err))
      .finally(() => setLoading(false));
  }, [profile?.uid]);

  const activeBookings = myBookings.filter(
    (b) => b.status === "pending" || b.status === "accepted" || b.status === "scheduled"
  );

  return (
    <div className="uha-overview">
      <div className="uha-header">
        <div>
          <h3 className="uha-header__title">🌱 My Wellness Activity & Session Overview</h3>
          <p className="uha-header__sub">
            Track your counselling appointments, stress tests, and daily self-care activities.
          </p>
        </div>
      </div>

      <div className="uha-grid">
        {/* Left Column: My Booked Sessions */}
        <div className="uha-card uha-card--main">
          <div className="uha-card__header">
            <div className="uha-card__title-wrap">
              <span className="uha-card__icon">📅</span>
              <div>
                <h4 className="uha-card__title">My Counselling Sessions</h4>
                <span className="uha-card__subtitle">Your upcoming & recent appointments</span>
              </div>
            </div>
            {activeBookings.length > 0 ? (
              <span className="uha-badge uha-badge--active">{activeBookings.length} Active</span>
            ) : (
              <button
                type="button"
                className="uha-btn-book"
                onClick={() => onSelectSection("booking")}
              >
                + Book a Session
              </button>
            )}
          </div>

          {loading ? (
            <p className="uha-empty">Loading your counselling sessions…</p>
          ) : myBookings.length === 0 ? (
            <div className="uha-empty">
              <p>You haven't booked any 1-on-1 counselling sessions yet.</p>
              <button
                type="button"
                className="uha-btn-book-lg"
                onClick={() => onSelectSection("booking")}
              >
                Book 1-on-1 Session Now →
              </button>
            </div>
          ) : (
            <div className="uha-feed">
              {myBookings.slice(0, 4).map((b) => (
                <div key={b.id} className="uha-feed__item">
                  <div>
                    <strong className="uha-feed__title">
                      Counselling Session {b.counsellorEmail ? `with ${b.counsellorEmail}` : ""}
                    </strong>
                    <span className="uha-feed__meta">
                      📅 {b.scheduledAt ? new Date(b.scheduledAt).toLocaleString("en-IN") : "Pending Schedule"} • Status:{" "}
                      <span className={`uha-tag uha-tag--${b.status}`}>
                        {b.status.toUpperCase()}
                      </span>
                    </span>
                  </div>
                  <button
                    type="button"
                    className="uha-btn-sm"
                    onClick={() => onSelectSection("booking")}
                  >
                    View Details →
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Shortcuts Grid */}
        <div className="uha-card uha-card--side">
          <div className="uha-card__header">
            <div className="uha-card__title-wrap">
              <span className="uha-card__icon">🚀</span>
              <div>
                <h4 className="uha-card__title">Quick Wellness Shortcuts</h4>
                <span className="uha-card__subtitle">Instant access to features</span>
              </div>
            </div>
          </div>

          <div className="uha-shortcuts__list">
            <button type="button" onClick={() => onSelectSection("wellness-test")}>
              📋 Take Wellness Stress Test
            </button>
            <button type="button" onClick={() => onSelectSection("games")}>
              🧘 4-7-8 & Box Breathing Exercises
            </button>
            <button type="button" onClick={() => onSelectSection("journal")}>
              📖 Counselling Journal
            </button>
            <button type="button" onClick={() => onSelectSection("community")}>
              💬 Wellness Community
            </button>
            <button type="button" className="uha-btn-urgent" onClick={() => onSelectSection("emergency")}>
              🚨 Emergency SOS Assistance
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

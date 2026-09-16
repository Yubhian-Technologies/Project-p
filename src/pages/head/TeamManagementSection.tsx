import { useEffect, useState } from "react";
import { listBookableProfiles, listAllBookingsForStats, listScheduledBookings } from "../../services/firebase/bookings";
import { setAvailability } from "../../services/firebase/firestore";
import type { UserProfile } from "../../types/user";
import type { Booking } from "../../types/booking";
import { computeLiveStatus, liveStatusLabel } from "../../utils/counsellorStatus";
import { Card } from "../../components/common/Card";
import { Button } from "../../components/common/Button";
import { StarRating } from "../../components/common/StarRating";
import { ROLE_LABELS } from "../../config/roles";
import { CounsellorSessionDetail } from "./CounsellorSessionDetail";
import "./TeamManagementSection.css";

const TAKEN_STATUSES = ["accepted", "scheduled", "completed"];

interface CounsellorStats {
  profile: UserProfile;
  sessionsTaken: number;
  usersServed: number;
  completed: number;
  followedUp: number;
  missed: number;
  cancelled: number;
  avgRating: number;
  ratingCount: number;
  totalHours: number;
}

function computeStats(profiles: UserProfile[], bookings: Booking[]): CounsellorStats[] {
  return profiles.map((profile) => {
    const own = bookings.filter((b) => b.counsellorId === profile.uid && TAKEN_STATUSES.includes(b.status));
    const usersServed = new Set(own.map((b) => b.userId)).size;
    const completed = own.filter((b) => b.status === "completed" && b.outcome === "completed").length;
    const followedUp = own.filter((b) => b.status === "completed" && b.outcome === "followup").length;
    const missed = own.filter((b) => b.status === "completed" && b.outcome === "missed").length;
    const cancelled = bookings.filter((b) => b.counsellorId === profile.uid && b.status === "cancelled").length;
    const rated = own.filter((b) => b.status === "completed" && b.outcome !== "missed" && b.userRatingOfCounsellor !== undefined);
    const avgRating =
      rated.length > 0
        ? rated.reduce((sum, b) => sum + (b.userRatingOfCounsellor ?? 0), 0) / rated.length
        : 0;
    const totalHours = own.reduce((sum, b) => sum + b.durationMinutes, 0) / 60;
    return {
      profile,
      sessionsTaken: own.length,
      usersServed,
      completed,
      followedUp,
      missed,
      cancelled,
      avgRating,
      ratingCount: rated.length,
      totalHours,
    };
  });
}

export function TeamManagementSection() {
  const [stats, setStats] = useState<CounsellorStats[]>([]);
  const [scheduledBookings, setScheduledBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [selectedCounsellor, setSelectedCounsellor] = useState<UserProfile | null>(null);

  async function load() {
    const [profiles, bookings, liveBookings] = await Promise.all([
      listBookableProfiles(),
      listAllBookingsForStats(),
      listScheduledBookings(),
    ]);
    setStats(computeStats(profiles, bookings));
    setScheduledBookings(liveBookings);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleToggleAvailability(target: UserProfile) {
    setTogglingId(target.uid);
    try {
      await setAvailability(target.uid, !target.available);
      await load();
    } finally {
      setTogglingId(null);
    }
  }

  if (selectedCounsellor) {
    return <CounsellorSessionDetail counsellor={selectedCounsellor} onBack={() => setSelectedCounsellor(null)} />;
  }

  if (loading) return null;

  return (
    <div className="team-management">
      {stats.length === 0 && <p>No counsellors or heads are set up yet.</p>}
      {stats.map(({ profile, sessionsTaken, usersServed, completed, followedUp, missed, cancelled, avgRating, ratingCount, totalHours }) => {
        const status = computeLiveStatus(profile, scheduledBookings);
        return (
          <Card
            key={profile.uid}
            className="team-management__row"
            onClick={() => setSelectedCounsellor(profile)}
          >
            <div>
              <p className="team-management__name">
                {profile.displayName || profile.email}
                <span className="team-management__verified-tag">✓ Verified</span>
              </p>
              <p className="team-management__role">{ROLE_LABELS[profile.role]}</p>
              {ratingCount > 0 && <StarRating value={avgRating} count={ratingCount} />}
            </div>
            <div className="team-management__stats">
              <span>
                <strong>{sessionsTaken}</strong> sessions
              </span>
              <span>
                <strong>{usersServed}</strong> users
              </span>
              <span>
                <strong>{completed}</strong> completed
              </span>
              <span>
                <strong>{followedUp}</strong> followed up
              </span>
              {missed > 0 && (
                <span>
                  <strong>{missed}</strong> missed
                </span>
              )}
              <span>
                <strong>{cancelled}</strong> cancelled
              </span>
              <span>
                <strong>{totalHours.toFixed(1)}</strong> hours
              </span>
            </div>
            <div className="team-management__availability" onClick={(e) => e.stopPropagation()}>
              <span className={`team-management__status team-management__status--${status}`}>
                {liveStatusLabel(status)}
              </span>
              <Button
                type="button"
                variant="outlined"
                disabled={togglingId === profile.uid}
                onClick={() => handleToggleAvailability(profile)}
              >
                {profile.available ? "Mark Unavailable" : "Mark Available"}
              </Button>
              <Button type="button" onClick={() => setSelectedCounsellor(profile)}>
                View sessions →
              </Button>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

import { useEffect, useState } from "react";
import { listBookableProfiles, listAllBookingsForStats, listScheduledBookings } from "../../services/firebase/bookings";
import { getAllFeedback, aggregateAllCounsellorFeedback } from "../../services/firebase/feedback";
import type { CounsellorFeedbackAggregate } from "../../services/firebase/feedback";
import { setAvailability } from "../../services/firebase/firestore";
import type { UserProfile } from "../../types/user";
import type { Booking } from "../../types/booking";
import { computeLiveStatus, liveStatusLabel } from "../../utils/counsellorStatus";
import { Card } from "../../components/common/Card";
import { Button } from "../../components/common/Button";
import { StarRating } from "../../components/common/StarRating";
import { ROLE_LABELS } from "../../config/roles";
import { CounsellorSessionDetail } from "./CounsellorSessionDetail";
import { TeamAttendanceSection } from "./TeamAttendanceSection";
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
    const totalHours = own.reduce((sum, b) => sum + b.durationMinutes, 0) / 60;
    return {
      profile,
      sessionsTaken: own.length,
      usersServed,
      completed,
      followedUp,
      missed,
      cancelled,
      totalHours,
    };
  });
}

interface TeamManagementSectionProps {
  onOpenTransferRequests?: () => void;
}

export function TeamManagementSection({
  onOpenTransferRequests,
}: TeamManagementSectionProps) {
  const [stats, setStats] = useState<CounsellorStats[]>([]);
  const [scheduledBookings, setScheduledBookings] = useState<Booking[]>([]);
  const [feedbackAggregates, setFeedbackAggregates] = useState<Map<string, CounsellorFeedbackAggregate>>(
    new Map(),
  );
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [selectedCounsellor, setSelectedCounsellor] = useState<UserProfile | null>(null);
  const [attendanceOpen, setAttendanceOpen] = useState(false);

  async function load() {
    const [profiles, bookings, liveBookings, feedback] = await Promise.all([
      listBookableProfiles(),
      listAllBookingsForStats(),
      listScheduledBookings(),
      getAllFeedback().catch(() => []),
    ]);
    setStats(computeStats(profiles, bookings));
    setFeedbackAggregates(
      new Map(aggregateAllCounsellorFeedback(feedback).map((a) => [a.counsellorId, a])),
    );
    setScheduledBookings(liveBookings);
    setLoading(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react/set-state-in-effect -- initial data fetch, not resetting state from a prop change
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

  if (attendanceOpen) {
    return <TeamAttendanceSection onBack={() => setAttendanceOpen(false)} />;
  }

  if (loading) return null;

  return (
    <div className="team-management">
      <div className="team-management__header">
        <div className="team-management__actions">
          {onOpenTransferRequests && (
            <Button type="button" variant="outlined" onClick={onOpenTransferRequests}>
              Transfer Requests →
            </Button>
          )}
          <Button type="button" variant="outlined" onClick={() => setAttendanceOpen(true)}>
            Check-in / Check-out →
          </Button>
        </div>
      </div>
      {stats.length === 0 && <p>No counsellors or heads are set up yet.</p>}
      {stats.map(({ profile, sessionsTaken, usersServed, completed, followedUp, missed, cancelled, totalHours }) => {
        const status = computeLiveStatus(profile, scheduledBookings);
        const feedbackAgg = feedbackAggregates.get(profile.uid);
        const displayedAvg = feedbackAgg?.average ?? 0;
        const displayedCount = feedbackAgg?.count ?? 0;
        return (
          <Card
            key={profile.uid}
            className="team-management__row"
            onClick={() => setSelectedCounsellor(profile)}
          >
            <div>
              <p className="team-management__name">
                {profile.displayName || profile.email}
              </p>
              <p className="team-management__role">{ROLE_LABELS[profile.role]}</p>
              {displayedCount > 0 && <StarRating value={displayedAvg} count={displayedCount} />}
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
                {profile.available ? "Mark Leave" : "Mark Available"}
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

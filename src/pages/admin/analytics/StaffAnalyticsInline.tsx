import { useEffect, useState } from "react";
import { listBookingsForCounsellor } from "../../../services/firebase/bookings";
import type { UserProfile } from "../../../types/user";
import { StarRating } from "../../../components/common/StarRating";
import "./AnalyticsSection.css";

interface Stats {
  sessionsTaken: number;
  ratingCount: number;
  avgRating: number;
}

const TAKEN_STATUSES = ["accepted", "scheduled", "completed"];

interface StaffAnalyticsInlineProps {
  staff: UserProfile;
}

export function StaffAnalyticsInline({ staff }: StaffAnalyticsInlineProps) {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    listBookingsForCounsellor(staff.uid).then((bookings) => {
      const taken = bookings.filter((b) => TAKEN_STATUSES.includes(b.status));
      const rated = taken.filter((b) => b.userRatingOfCounsellor !== undefined);
      const avgRating =
        rated.length > 0
          ? rated.reduce((sum, b) => sum + (b.userRatingOfCounsellor ?? 0), 0) / rated.length
          : 0;
      setStats({ sessionsTaken: taken.length, ratingCount: rated.length, avgRating });
    });
  }, [staff.uid]);

  if (!stats) return null;

  return (
    <div className="analytics-inline">
      <div className="analytics-inline__stat">
        <span className="analytics-inline__stat-value">{stats.sessionsTaken}</span>
        <span className="analytics-inline__stat-label">Sessions taken</span>
      </div>
      <div className="analytics-inline__stat">
        <span className="analytics-inline__stat-value">{stats.ratingCount}</span>
        <span className="analytics-inline__stat-label">Feedback given</span>
      </div>
      <div className="analytics-inline__stat">
        {stats.ratingCount > 0 ? (
          <StarRating value={stats.avgRating} size="large" />
        ) : (
          <span className="analytics-inline__stat-value">—</span>
        )}
        <span className="analytics-inline__stat-label">Overall rating</span>
      </div>
    </div>
  );
}

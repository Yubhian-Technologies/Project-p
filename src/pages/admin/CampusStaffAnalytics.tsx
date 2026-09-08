import { useEffect, useState } from "react";
import { listBookingsForCounsellor } from "../../services/firebase/bookings";
import type { UserProfile } from "../../types/user";
import { Card } from "../../components/common/Card";
import { Button } from "../../components/common/Button";
import { StarRating } from "../../components/common/StarRating";
import { ROLE_LABELS } from "../../config/roles";
import "./CampusStaffAnalytics.css";

interface CampusStaffAnalyticsProps {
  staff: UserProfile;
  onBack: () => void;
}

interface Stats {
  sessionsTaken: number;
  ratingCount: number;
  avgRating: number;
}

const TAKEN_STATUSES = ["accepted", "scheduled", "completed"];

export function CampusStaffAnalytics({ staff, onBack }: CampusStaffAnalyticsProps) {
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
    <div className="campus-staff-analytics">
      <Button type="button" variant="outlined" onClick={onBack}>
        ← Back to Staff
      </Button>

      <Card className="campus-staff-analytics__card">
        <p className="campus-staff-analytics__name">{staff.displayName || staff.email}</p>
        <p className="campus-staff-analytics__role">{ROLE_LABELS[staff.role]}</p>

        <div className="campus-staff-analytics__stats">
          <div className="campus-staff-analytics__stat">
            <span className="campus-staff-analytics__stat-value">{stats.sessionsTaken}</span>
            <span className="campus-staff-analytics__stat-label">Sessions taken</span>
          </div>
          <div className="campus-staff-analytics__stat">
            <span className="campus-staff-analytics__stat-value">{stats.ratingCount}</span>
            <span className="campus-staff-analytics__stat-label">Feedback given</span>
          </div>
          <div className="campus-staff-analytics__stat">
            {stats.ratingCount > 0 ? (
              <StarRating value={stats.avgRating} size="large" />
            ) : (
              <span className="campus-staff-analytics__stat-value">—</span>
            )}
            <span className="campus-staff-analytics__stat-label">Overall rating</span>
          </div>
        </div>
      </Card>
    </div>
  );
}

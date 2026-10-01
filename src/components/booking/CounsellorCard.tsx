import { useEffect, useState } from "react";
import { Card } from "../common/Card";
import { StarRating } from "../common/StarRating";
import { fetchCounsellorReviews } from "../../services/firebase/bookings";
import type { UserProfile } from "../../types/user";
import type { LiveStatus } from "../../utils/counsellorStatus";
import { liveStatusLabel } from "../../utils/counsellorStatus";
import "./CounsellorCard.css";

interface CounsellorCardProps {
  profile: UserProfile;
  status: LiveStatus;
  onClick: () => void;
}

export function CounsellorCard({ profile, status, onClick }: CounsellorCardProps) {
  const [rating, setRating] = useState<{ average: number; count: number } | null>(null);
  const displayName = profile.displayName || profile.email;

  useEffect(() => {
    let cancelled = false;
    fetchCounsellorReviews(profile.uid)
      .then((reviews) => {
        if (cancelled || reviews.length === 0) return;
        setRating({
          average: reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length,
          count: reviews.length,
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [profile.uid]);

  return (
    <Card className="counsellor-card" onClick={onClick}>
      <div className="counsellor-card__photo-wrap">
        {profile.photoURL ? (
          <img className="counsellor-card__photo" src={profile.photoURL} alt={displayName} />
        ) : (
          <div className="counsellor-card__photo counsellor-card__photo--placeholder" aria-label={displayName}>
            {displayName.trim().charAt(0).toUpperCase() || "?"}
          </div>
        )}
        <span className={`counsellor-card__status-badge counsellor-card__status-badge--${status}`}>
          {liveStatusLabel(status)}
        </span>
      </div>

      <div className="counsellor-card__body">
        <p className="counsellor-card__name">{displayName}</p>
        {profile.bio && <p className="counsellor-card__bio">{profile.bio}</p>}
        {rating && (
          <div className="counsellor-card__rating">
            <StarRating value={rating.average} count={rating.count} />
          </div>
        )}
      </div>
    </Card>
  );
}

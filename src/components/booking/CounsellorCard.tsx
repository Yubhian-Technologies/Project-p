import { Avatar } from "../common/Avatar";
import { Card } from "../common/Card";
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
  return (
    <Card className="counsellor-card" onClick={onClick}>
      <div className="counsellor-card__header">
        <Avatar photoURL={profile.photoURL} label={profile.email} size="large" shape="square" />
        <div>
          <p className="counsellor-card__name">{profile.displayName || profile.email}</p>
          {profile.specialization && <p className="counsellor-card__role">{profile.specialization}</p>}
        </div>
      </div>

      {profile.bio && <p className="counsellor-card__bio">{profile.bio}</p>}

      <div className="counsellor-card__footer">
        <span className={`counsellor-card__badge counsellor-card__badge--${status}`}>
          {liveStatusLabel(status)}
        </span>
        <span className="counsellor-card__hint">View profile →</span>
      </div>
    </Card>
  );
}

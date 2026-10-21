import { useEffect, useState } from "react";
import { BentoCard } from "./BentoCard";
import { TrophyIcon } from "./icons";
import { useAuth } from "../../hooks/useAuth";
import {
  getCampusStudentRankings,
  type CampusLeaderboardResult,
} from "../../services/campusRankings";
import "./CampusRankingsCard.css";

interface CampusRankingsCardProps {
  onOpenRankings: () => void;
}

export function CampusRankingsCard({ onOpenRankings }: CampusRankingsCardProps) {
  const { profile } = useAuth();
  const [data, setData] = useState<CampusLeaderboardResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    function loadData(isInitial = false) {
      if (isInitial) setLoading(true);
      getCampusStudentRankings(profile?.campusId, profile)
        .then((res) => {
          if (isMounted) setData(res);
        })
        .finally(() => {
          if (isMounted) setLoading(false);
        });
    }

    loadData(true);

    function handleUpdate() {
      loadData(false);
    }

    window.addEventListener("wellness_score_updated", handleUpdate);
    return () => {
      isMounted = false;
      window.removeEventListener("wellness_score_updated", handleUpdate);
    };
  }, [profile?.campusId, profile?.uid]);

  const students = data?.students || [];
  const campusName = data?.campusName || "Your Campus";
  const currentUser = students.find((s) => s.isCurrentUser);
  const topStudents = students.slice(0, 3);

  return (
    <BentoCard
      span={4}
      icon={<TrophyIcon />}
      title="Campus Leaderboard"
      subtitle={`Student rankings at ${campusName}`}
      badge={currentUser ? { text: `Rank #${currentUser.rank}`, variant: "primary" } : undefined}
    >
      <div className="cr-card">
        {currentUser && (
          <div className="cr-card__user-standing">
            <div className="cr-card__standing-left">
              <span className="cr-card__standing-icon">👑</span>
              <div>
                <h4 className="cr-card__standing-title">{currentUser.name} (You)</h4>
                <p className="cr-card__standing-sub">{currentUser.score.toLocaleString()} marks • {currentUser.streak}d streak</p>
              </div>
            </div>
            <span className="cr-card__standing-rank">#{currentUser.rank}</span>
          </div>
        )}

        <div className="cr-card__list">
          {loading ? (
            <p style={{ fontSize: "13px", color: "#64748b", margin: 0 }}>Loading campus rankings…</p>
          ) : topStudents.length === 0 ? (
            <p style={{ fontSize: "13px", color: "#64748b", margin: 0 }}>No students recorded yet.</p>
          ) : (
            topStudents.map((st) => (
              <div
                key={st.uid}
                className={`cr-card__item ${st.isCurrentUser ? "is-user" : ""}`}
              >
                <div className="cr-card__item-left">
                  <span className="cr-card__item-medal">
                    {st.rank === 1 ? "🥇" : st.rank === 2 ? "🥈" : "🥉"}
                  </span>
                  <span className="cr-card__item-name">
                    {st.name}
                    {st.isCurrentUser && " (You)"}
                  </span>
                </div>
                <div className="cr-card__item-right">
                  <span className="cr-card__item-score">{st.score.toLocaleString()} pts</span>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="cr-card__footer">
          <button type="button" className="cr-card__view-btn" onClick={onOpenRankings}>
            <TrophyIcon /> View Full Leaderboard →
          </button>
        </div>
      </div>
    </BentoCard>
  );
}

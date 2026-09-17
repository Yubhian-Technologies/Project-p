import { useEffect, useState } from "react";
import { getWellnessData, type WellnessScoreData } from "../../services/wellnessScore";
import { TrophyIcon, FlameIcon, TargetIcon } from "./icons";
import "./WellnessScoreBanner.css";

export function WellnessScoreBanner() {
  const [data, setData] = useState<WellnessScoreData>(getWellnessData);

  useEffect(() => {
    function handleUpdate() {
      setData(getWellnessData());
    }

    window.addEventListener("wellness_score_updated", handleUpdate);
    return () => window.removeEventListener("wellness_score_updated", handleUpdate);
  }, []);

  const completedCount = data.completedChallenges.length;

  return (
    <div className="ws-banner">
      <div className="ws-banner__item ws-banner__item--score">
        <span className="ws-banner__icon"><TrophyIcon /></span>
        <span className="ws-banner__label">Score:</span>
        <strong className="ws-banner__val">{data.score} pts</strong>
      </div>

      <div className="ws-banner__divider" aria-hidden="true" />

      <div className="ws-banner__item ws-banner__item--streak">
        <span className="ws-banner__icon"><FlameIcon /></span>
        <span className="ws-banner__label">Streak:</span>
        <strong className="ws-banner__val">{data.streak} {data.streak === 1 ? "Day" : "Days"}</strong>
      </div>

      <div className="ws-banner__divider" aria-hidden="true" />

      <div className="ws-banner__item ws-banner__item--challenges">
        <span className="ws-banner__icon"><TargetIcon /></span>
        <span className="ws-banner__label">Daily Challenges:</span>
        <strong className="ws-banner__val">{completedCount}/3 Done</strong>
      </div>

      {data.allCompletedBonusClaimed && (
        <span className="ws-banner__badge">All Challenges Done!</span>
      )}
    </div>
  );
}

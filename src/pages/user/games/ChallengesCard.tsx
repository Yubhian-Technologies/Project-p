import { useEffect, useState } from "react";
import { DAILY_CHALLENGES, getWellnessData, type WellnessScoreData } from "../../../services/wellnessScore";
import { TargetIcon, TrophyIcon } from "../../../components/common/icons";
import "./ChallengesCard.css";

export function ChallengesCard() {
  const [data, setData] = useState<WellnessScoreData>(getWellnessData);

  useEffect(() => {
    function handleUpdate() {
      setData(getWellnessData());
    }

    window.addEventListener("wellness_score_updated", handleUpdate);
    return () => window.removeEventListener("wellness_score_updated", handleUpdate);
  }, []);

  const completedCount = data.completedChallenges.length;
  const totalCount = DAILY_CHALLENGES.length;
  const progressPercent = Math.round((completedCount / totalCount) * 100);

  return (
    <div className="challenges-card">
      <div className="challenges-card__top">
        <div>
          <h3 className="challenges-card__title"><TargetIcon /> Daily Wellness Challenges</h3>
          <p className="challenges-card__sub">
            Complete your daily habits to boost your Wellness Score and maintain your streak!
          </p>
        </div>
        <div className="challenges-card__score-box">
          <span className="challenges-card__score-label">Total Score</span>
          <span className="challenges-card__score-val"><TrophyIcon /> {data.score} pts</span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="challenges-card__progress">
        <div className="challenges-card__progress-info">
          <span>Daily Progress ({completedCount}/{totalCount} Completed)</span>
          <span>{progressPercent}%</span>
        </div>
        <div className="challenges-card__progress-bar">
          <div
            className="challenges-card__progress-fill"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Challenge List */}
      <div className="challenges-card__list">
        {DAILY_CHALLENGES.map((challenge) => {
          const isDone = data.completedChallenges.includes(challenge.id);
          return (
            <div
              key={challenge.id}
              className={`challenges-card__item${isDone ? " challenges-card__item--done" : ""}`}
            >
              <div className="challenges-card__item-left">
                <span className="challenges-card__item-icon">{challenge.icon}</span>
                <div>
                  <div className="challenges-card__item-title">{challenge.title}</div>
                  <div className="challenges-card__item-desc">{challenge.description}</div>
                </div>
              </div>
              <div className="challenges-card__item-right">
                <span className="challenges-card__item-pts">+{challenge.points} pts</span>
                <span className={`challenges-card__check${isDone ? " challenges-card__check--done" : ""}`}>
                  {isDone ? "✓ Done" : "In Progress"}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {data.allCompletedBonusClaimed && (
        <div className="challenges-card__bonus-banner">
          All Daily Challenges Completed! You earned +100 Bonus Score Points today!
        </div>
      )}
    </div>
  );
}

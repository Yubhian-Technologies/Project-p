import { useEffect, useState } from "react";
import { BentoCard } from "./BentoCard";
import { FlameIcon, TrophyIcon, CalendarIcon } from "./icons";
import { useAuth } from "../../hooks/useAuth";
import { computeStreakStats, getMoodLogs, logMood } from "../../services/firebase/mood";
import type { MoodType, StreakStats } from "../../types/mood";
import "./MoodTrackerCard.css";

const MOOD_OPTIONS: { type: MoodType; emoji: string; label: string }[] = [
  { type: "amazing", emoji: "🤩", label: "Amazing" },
  { type: "good", emoji: "😊", label: "Good" },
  { type: "okay", emoji: "😐", label: "Okay" },
  { type: "low", emoji: "😔", label: "Low" },
  { type: "stressed", emoji: "😤", label: "Stressed" },
];

export function MoodTrackerCard() {
  const { currentUser } = useAuth();
  const [stats, setStats] = useState<StreakStats | null>(null);
  const [, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedMood, setSelectedMood] = useState<MoodType | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  async function loadData() {
    if (!currentUser) return;
    try {
      const logs = await getMoodLogs(currentUser.uid);
      const computed = computeStreakStats(logs);
      setStats(computed);
      if (computed.todayMood) {
        setSelectedMood(computed.todayMood);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [currentUser]);

  async function handleSelectMood(mood: MoodType) {
    if (!currentUser || submitting) return;
    setSelectedMood(mood);
    setSubmitting(true);
    setFeedback(null);
    try {
      await logMood(currentUser.uid, mood);
      await loadData();
      setFeedback("Today's mood logged! Streak active");
      setTimeout(() => setFeedback(null), 4000);
    } catch (err) {
      console.error("Failed to log mood:", err);
      setFeedback("Failed to save mood. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <BentoCard
      span={4}
      title="Daily Mood & Wellness Streak"
      subtitle="Track how you feel each day to maintain your active wellness streak."
    >
      <div className="mood-tracker">
        {/* Header streak badge */}
        <div className="mood-tracker__header">
          <div className="mood-tracker__streak-badge">
            <span className="mood-tracker__flame"><FlameIcon /></span>
            <span className="mood-tracker__streak-count">
              {stats ? `${stats.currentStreak} Day Streak!` : "0 Day Streak!"}
            </span>
          </div>
          <span className="mood-tracker__sub">
            {stats?.todayLogged
              ? "✅ You've logged your mood today!"
              : "Tap an emoji below to check in today!"}
          </span>
        </div>

        {/* 5 Mood Emoji Buttons */}
        <div className="mood-tracker__options">
          {MOOD_OPTIONS.map((item) => {
            const isSelected = selectedMood === item.type;
            return (
              <button
                key={item.type}
                type="button"
                disabled={submitting}
                className={`mood-tracker__option ${isSelected ? "mood-tracker__option--selected" : ""}`}
                onClick={() => handleSelectMood(item.type)}
                title={item.label}
              >
                <span className="mood-tracker__emoji">{item.emoji}</span>
                <span className="mood-tracker__label">{item.label}</span>
              </button>
            );
          })}
        </div>

        {feedback && <div className="mood-tracker__feedback">{feedback}</div>}

        {/* 7-Day Activity Streak Bar */}
        {stats && (
          <div className="mood-tracker__week-bar">
            <h4 className="mood-tracker__week-title">Past 7 Days Activity</h4>
            <div className="mood-tracker__days">
              {stats.weekDays.map((day) => (
                <div
                  key={day.dateISO}
                  className={`mood-tracker__day-col ${day.isToday ? "mood-tracker__day-col--today" : ""}`}
                >
                  <span className="mood-tracker__day-name">{day.dayLabel}</span>
                  <div
                    className={`mood-tracker__day-badge ${
                      day.logged ? "mood-tracker__day-badge--logged" : ""
                    }`}
                  >
                    {day.logged ? (
                      day.mood ? (
                        MOOD_OPTIONS.find((m) => m.type === day.mood)?.emoji ?? "✓"
                      ) : (
                        "✓"
                      )
                    ) : (
                      "·"
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Stats summary footer */}
        {stats && (
          <div className="mood-tracker__stats-footer">
            <div className="mood-tracker__stat">
              <span className="mood-tracker__stat-val"><FlameIcon /> {stats.currentStreak}</span>
              <span className="mood-tracker__stat-lbl">Current Streak</span>
            </div>
            <div className="mood-tracker__stat">
              <span className="mood-tracker__stat-val"><TrophyIcon /> {stats.longestStreak}</span>
              <span className="mood-tracker__stat-lbl">Best Streak</span>
            </div>
            <div className="mood-tracker__stat">
              <span className="mood-tracker__stat-val"><CalendarIcon /> {stats.totalLoggedDays}</span>
              <span className="mood-tracker__stat-lbl">Active Days</span>
            </div>
          </div>
        )}
      </div>
    </BentoCard>
  );
}

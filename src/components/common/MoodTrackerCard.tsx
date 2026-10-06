import { useEffect, useState } from "react";
import { BentoCard } from "./BentoCard";
import {
  FlameIcon,
  TrophyIcon,
  CalendarIcon,
  CheckCircleIcon,
  MoodAmazingIcon,
  MoodGoodIcon,
  MoodOkayIcon,
  MoodLowIcon,
  MoodStressedIcon,
} from "./icons";
import { useAuth } from "../../hooks/useAuth";
import { computeStreakStats, getMoodLogs, logMood } from "../../services/firebase/mood";
import type { MoodType, StreakStats } from "../../types/mood";
import "./MoodTrackerCard.css";

interface MoodOptionItem {
  type: MoodType;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  accentColor: string;
}

const MOOD_OPTIONS: MoodOptionItem[] = [
  { type: "amazing", label: "Amazing", Icon: MoodAmazingIcon, accentColor: "#F59E0B" },
  { type: "good", label: "Good", Icon: MoodGoodIcon, accentColor: "#0D9488" },
  { type: "okay", label: "Okay", Icon: MoodOkayIcon, accentColor: "#64748B" },
  { type: "low", label: "Low", Icon: MoodLowIcon, accentColor: "#6366F1" },
  { type: "stressed", label: "Stressed", Icon: MoodStressedIcon, accentColor: "#EA580C" },
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
            {stats?.todayLogged ? (
              <span className="mood-tracker__logged-pill">
                <CheckCircleIcon className="mood-tracker__logged-check" />
                <span>You've logged your mood today!</span>
              </span>
            ) : (
              "Select how you're feeling today"
            )}
          </span>
        </div>

        {/* 5 Bespoke Mood UI Icon Buttons */}
        <div className="mood-tracker__options">
          {MOOD_OPTIONS.map((item) => {
            const isSelected = selectedMood === item.type;
            const Icon = item.Icon;
            return (
              <button
                key={item.type}
                type="button"
                disabled={submitting}
                className={`mood-tracker__option mood-tracker__option--${item.type} ${
                  isSelected ? "mood-tracker__option--selected" : ""
                }`}
                onClick={() => handleSelectMood(item.type)}
                title={item.label}
              >
                <span className="mood-tracker__icon-wrap">
                  <Icon className="mood-tracker__icon" />
                </span>
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
              {stats.weekDays.map((day) => {
                const dayMoodOpt = day.mood ? MOOD_OPTIONS.find((m) => m.type === day.mood) : null;
                const DayIcon = dayMoodOpt ? dayMoodOpt.Icon : null;

                return (
                  <div
                    key={day.dateISO}
                    className={`mood-tracker__day-col ${day.isToday ? "mood-tracker__day-col--today" : ""}`}
                  >
                    <span className="mood-tracker__day-name">{day.dayLabel}</span>
                    <div
                      className={`mood-tracker__day-badge ${
                        day.logged ? "mood-tracker__day-badge--logged" : ""
                      } ${dayMoodOpt ? `mood-tracker__day-badge--${dayMoodOpt.type}` : ""}`}
                      title={dayMoodOpt ? `${day.dayLabel}: ${dayMoodOpt.label}` : day.dayLabel}
                    >
                      {day.logged ? (
                        DayIcon ? (
                          <DayIcon className="mood-tracker__day-icon" />
                        ) : (
                          <CheckCircleIcon className="mood-tracker__day-icon" />
                        )
                      ) : (
                        <span className="mood-tracker__day-empty">·</span>
                      )}
                    </div>
                  </div>
                );
              })}
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

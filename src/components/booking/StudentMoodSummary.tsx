import { useEffect, useState } from "react";
import { MoodAmazingIcon, MoodGoodIcon, MoodOkayIcon, MoodLowIcon, MoodStressedIcon } from "../common/icons";
import { computeStreakStats, getStudentMoodLogsForBooking } from "../../services/firebase/mood";
import type { MoodType } from "../../types/mood";
import type { StreakStats } from "../../types/mood";
import "./StudentMoodSummary.css";

const MOOD_META: Record<MoodType, { label: string; Icon: React.ComponentType<{ className?: string }>; color: string }> = {
  amazing: { label: "Amazing", Icon: MoodAmazingIcon, color: "#F59E0B" },
  good: { label: "Good", Icon: MoodGoodIcon, color: "#0D9488" },
  okay: { label: "Okay", Icon: MoodOkayIcon, color: "#64748B" },
  low: { label: "Low", Icon: MoodLowIcon, color: "#6366F1" },
  stressed: { label: "Stressed", Icon: MoodStressedIcon, color: "#EA580C" },
};

interface StudentMoodSummaryProps {
  bookingId: string;
}

/** Shown to the Counsellor/Head who owns this booking, next to the rest of
    the student's details — the Cloud Function backing this verifies that
    relationship server-side, since moodLogs is otherwise fully private.
    Renders nothing if the student has never logged a mood, or the fetch is
    denied/fails (e.g. an offline-imported "client" with no real account). */
export function StudentMoodSummary({ bookingId }: StudentMoodSummaryProps) {
  const [stats, setStats] = useState<StreakStats | null>(null);

  useEffect(() => {
    let active = true;
    setStats(null);
    getStudentMoodLogsForBooking(bookingId)
      .then((entries) => {
        if (!active) return;
        setStats(entries.length > 0 ? computeStreakStats(entries) : null);
      })
      .catch((err) => {
        console.error("Failed to load student mood summary:", err);
      });
    return () => {
      active = false;
    };
  }, [bookingId]);

  if (!stats) return null;

  const todayMeta = stats.todayMood ? MOOD_META[stats.todayMood] : null;
  const TodayIcon = todayMeta?.Icon;

  return (
    <div className="student-mood-summary">
      <div className="student-mood-summary__header">
        <span className="student-mood-summary__title">Student's Mood &amp; Wellness</span>
      </div>
      <div className="student-mood-summary__today">
        {TodayIcon && (
          <span className="student-mood-summary__today-icon" style={{ color: todayMeta!.color }}>
            <TodayIcon />
          </span>
        )}
        <span>{todayMeta ? `Feeling ${todayMeta.label.toLowerCase()} today` : "Hasn't logged a mood today"}</span>
      </div>
      <div className="student-mood-summary__week">
        {stats.weekDays.map((day) => {
          const meta = day.mood ? MOOD_META[day.mood] : null;
          const DayIcon = meta?.Icon;
          return (
            <span
              key={day.dateISO}
              className={`student-mood-summary__day ${day.isToday ? "student-mood-summary__day--today" : ""}`}
              title={meta ? `${day.dayLabel}: ${meta.label}` : day.dayLabel}
              style={meta ? { color: meta.color, borderColor: meta.color } : undefined}
            >
              {DayIcon ? <DayIcon /> : <span className="student-mood-summary__day-dot" />}
            </span>
          );
        })}
      </div>
    </div>
  );
}

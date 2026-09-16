export type MoodType = "amazing" | "good" | "okay" | "low" | "stressed";

export interface MoodEntry {
  dateISO: string; // "YYYY-MM-DD"
  mood: MoodType;
  note?: string;
  createdAt: number;
}

export interface DayStreakItem {
  dateISO: string;
  dayLabel: string;
  isToday: boolean;
  logged: boolean;
  mood: MoodType | null;
}

export interface StreakStats {
  currentStreak: number;
  longestStreak: number;
  totalLoggedDays: number;
  todayLogged: boolean;
  todayMood: MoodType | null;
  weekDays: DayStreakItem[];
}

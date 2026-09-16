import { collection, doc, getDocs, setDoc } from "firebase/firestore";
import { db } from "./config";
import type { DayStreakItem, MoodEntry, MoodType, StreakStats } from "../../types/mood";

export function getTodayISO(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export async function logMood(
  uid: string,
  mood: MoodType,
  note?: string
): Promise<void> {
  const dateISO = getTodayISO();
  const ref = doc(db, "moodLogs", uid, "entries", dateISO);
  const entry: MoodEntry = {
    dateISO,
    mood,
    ...(note ? { note: note.trim() } : {}),
    createdAt: Date.now(),
  };
  await setDoc(ref, entry);
}

export async function getMoodLogs(uid: string): Promise<MoodEntry[]> {
  const colRef = collection(db, "moodLogs", uid, "entries");
  const snapshot = await getDocs(colRef);
  return snapshot.docs.map((d) => d.data() as MoodEntry);
}

export function computeStreakStats(logs: MoodEntry[]): StreakStats {
  const todayISO = getTodayISO();
  const logMap = new Map<string, MoodEntry>();
  logs.forEach((entry) => {
    logMap.set(entry.dateISO, entry);
  });

  const todayEntry = logMap.get(todayISO);
  const todayLogged = !!todayEntry;
  const todayMood = todayEntry?.mood ?? null;

  // Calculate current streak
  let currentStreak = 0;
  const checkDate = new Date();
  
  // If not logged today, start checking from yesterday to see if active streak carries over
  if (!todayLogged) {
    checkDate.setDate(checkDate.getDate() - 1);
  }

  while (true) {
    const pad = (n: number) => String(n).padStart(2, "0");
    const iso = `${checkDate.getFullYear()}-${pad(checkDate.getMonth() + 1)}-${pad(checkDate.getDate())}`;
    if (logMap.has(iso)) {
      currentStreak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }

  // Calculate longest streak
  const sortedDates = Array.from(logMap.keys()).sort();
  let longestStreak = 0;
  let runningStreak = 0;
  let prevDate: Date | null = null;

  sortedDates.forEach((dateStr) => {
    const [y, m, d] = dateStr.split("-").map(Number);
    const currDate = new Date(y, m - 1, d);

    if (prevDate === null) {
      runningStreak = 1;
    } else {
      const diffMs = currDate.getTime() - prevDate.getTime();
      const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
      if (diffDays === 1) {
        runningStreak++;
      } else if (diffDays > 1) {
        runningStreak = 1;
      }
    }
    if (runningStreak > longestStreak) {
      longestStreak = runningStreak;
    }
    prevDate = currDate;
  });

  // Calculate past 7 days (including today)
  const weekDays: DayStreakItem[] = [];
  const now = new Date();
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const pad = (n: number) => String(n).padStart(2, "0");
    const iso = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const loggedEntry = logMap.get(iso);

    weekDays.push({
      dateISO: iso,
      dayLabel: dayNames[d.getDay()],
      isToday: iso === todayISO,
      logged: !!loggedEntry,
      mood: loggedEntry?.mood ?? null,
    });
  }

  return {
    currentStreak,
    longestStreak,
    totalLoggedDays: logMap.size,
    todayLogged,
    todayMood,
    weekDays,
  };
}

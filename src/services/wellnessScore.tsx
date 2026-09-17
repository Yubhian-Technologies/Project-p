import { toIsoDate } from "../utils/dateFormat";
import {
  FlameIcon,
  ClipboardListIcon,
  WindIcon,
} from "../components/common/icons";
import type { ReactNode } from "react";

export interface Challenge {
  id: "streak" | "journal" | "exercise";
  title: string;
  description: string;
  points: number;
  completed: boolean;
  icon: ReactNode;
}

export interface WellnessScoreData {
  score: number;
  streak: number;
  lastActiveDate: string; // YYYY-MM-DD
  completedChallenges: string[];
  allCompletedBonusClaimed?: boolean;
}

const STORAGE_KEY = "vishnu_wellness_score_data";

export const DAILY_CHALLENGES: Omit<Challenge, "completed">[] = [
  {
    id: "streak",
    title: "Daily Login Streak",
    description: "Visit the dashboard daily to keep your wellness streak alive!",
    points: 50,
    icon: <FlameIcon />,
  },
  {
    id: "journal",
    title: "Journal Your Thoughts",
    description: "Write down your thoughts in your Counselling Journal today.",
    points: 50,
    icon: <ClipboardListIcon />,
  },
  {
    id: "exercise",
    title: "Complete a Wellness Exercise",
    description: "Do 4-7-8 Breathing, Box Breathing, Meditation, or any exercise.",
    points: 50,
    icon: <WindIcon />,
  },
];

export function getWellnessData(): WellnessScoreData {
  const today = toIsoDate(new Date());
  const raw = localStorage.getItem(STORAGE_KEY);

  let data: WellnessScoreData = {
    score: 150,
    streak: 1,
    lastActiveDate: today,
    completedChallenges: ["streak"],
    allCompletedBonusClaimed: false,
  };

  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.score === "number") {
        data = parsed;
      }
    } catch {
      // fallback to default
    }
  }

  // Check if date changed
  if (data.lastActiveDate !== today) {
    const lastDate = new Date(data.lastActiveDate);
    const currentDate = new Date(today);
    const diffDays = Math.round((currentDate.getTime() - lastDate.getTime()) / (1000 * 3600 * 24));

    if (diffDays === 1) {
      data.streak += 1;
    } else if (diffDays > 1) {
      data.streak = 1;
    }

    data.lastActiveDate = today;
    data.completedChallenges = ["streak"]; // daily streak completed automatically on login
    data.allCompletedBonusClaimed = false;
    saveWellnessData(data);
  } else if (!data.completedChallenges.includes("streak")) {
    data.completedChallenges.push("streak");
    saveWellnessData(data);
  }

  return data;
}

export function saveWellnessData(data: WellnessScoreData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("wellness_score_updated"));
  }
}

export function completeChallenge(challengeId: "streak" | "journal" | "exercise"): WellnessScoreData {
  const data = getWellnessData();

  if (!data.completedChallenges.includes(challengeId)) {
    data.completedChallenges.push(challengeId);
    const item = DAILY_CHALLENGES.find((c) => c.id === challengeId);
    if (item) {
      data.score += item.points;
    }

    // Check if all 3 challenges completed
    if (
      DAILY_CHALLENGES.every((c) => data.completedChallenges.includes(c.id)) &&
      !data.allCompletedBonusClaimed
    ) {
      data.score += 100; // +100 bonus pts for completing all daily challenges!
      data.allCompletedBonusClaimed = true;
    }

    saveWellnessData(data);
  }

  return data;
}

export function completeExercise(): WellnessScoreData {
  return completeChallenge("exercise");
}

export function completeJournalEntry(): WellnessScoreData {
  return completeChallenge("journal");
}

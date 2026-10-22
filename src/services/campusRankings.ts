import { collection, doc, getDocs, query, updateDoc, where } from "firebase/firestore";
import { db } from "./firebase/config";
import { listCampuses } from "./firebase/campuses";
import { getWellnessData } from "./wellnessScore";
import type { UserProfile } from "../types/user";

export interface CampusStudentRanking {
  uid: string;
  name: string;
  email: string;
  registerNumber?: string;
  branch?: string;
  yearOrBatch?: string;
  score: number;
  streak: number;
  rank: number;
  badge: string;
  isCurrentUser: boolean;
}

export interface CampusLeaderboardResult {
  campusName: string;
  campusId: string;
  totalParticipants: number;
  students: CampusStudentRanking[];
}

const lastSyncedCache = new Map<string, { score: number; streak: number }>();

export async function syncUserScoreToFirestore(uid: string, score: number, streak: number): Promise<void> {
  const cached = lastSyncedCache.get(uid);
  if (cached && cached.score === score && cached.streak === streak) {
    return; // Already in sync, do not trigger Firestore onSnapshot
  }

  try {
    const userRef = doc(db, "users", uid);
    await updateDoc(userRef, {
      wellnessScore: score,
      wellnessStreak: streak,
    });
    lastSyncedCache.set(uid, { score, streak });
  } catch (err) {
    console.warn("Could not sync wellness score to Firestore profile:", err);
  }
}

export async function getCampusStudentRankings(
  campusId?: string,
  currentUser?: UserProfile | null,
): Promise<CampusLeaderboardResult> {
  const userWellness = getWellnessData();
  const campuses = await listCampuses().catch(() => []);
  const targetCampus = campuses.find((c) => c.id === campusId);
  const campusName = targetCampus?.name || (campusId ? "Campus Wellness Hub" : "Your Campus");

  // Sync current user's real wellness score to Firestore ONLY when it changes
  if (currentUser?.uid) {
    const currentScore = (currentUser as unknown as { wellnessScore?: number })?.wellnessScore;
    const currentStreak = (currentUser as unknown as { wellnessStreak?: number })?.wellnessStreak;
    if (currentScore !== userWellness.score || currentStreak !== userWellness.streak) {
      syncUserScoreToFirestore(currentUser.uid, userWellness.score, userWellness.streak);
    }
  }

  const studentsMap = new Map<string, CampusStudentRanking>();

  // 1. Fetch real student users on this campus from Firestore
  if (campusId) {
    try {
      const q = query(
        collection(db, "users"),
        where("campusId", "==", campusId),
        where("role", "==", "user"),
      );
      const snapshot = await getDocs(q);

      snapshot.docs.forEach((docSnap) => {
        const u = docSnap.data() as UserProfile & { wellnessScore?: number; wellnessStreak?: number };
        const isCurrent = currentUser?.uid === u.uid;
        
        // For the current user, always prioritize live local storage wellness score
        const score = isCurrent ? userWellness.score : (u.wellnessScore ?? 0);
        const streak = isCurrent ? userWellness.streak : (u.wellnessStreak ?? 0);

        const name = u.displayName || (u.email ? u.email.split("@")[0] : "Student");

        studentsMap.set(u.uid, {
          uid: u.uid,
          name,
          email: u.email || "",
          registerNumber: u.registerNumber || "",
          branch: u.branch || "",
          yearOrBatch: u.yearOrBatch || "",
          score,
          streak,
          rank: 0,
          badge: "",
          isCurrentUser: isCurrent,
        });
      });
    } catch (err) {
      console.error("Failed to query campus student users from Firestore:", err);
    }
  }

  // 2. Ensure current user is always included in the campus list even if firestore query had delay
  if (currentUser?.uid && !studentsMap.has(currentUser.uid)) {
    const name = currentUser.displayName || (currentUser.email ? currentUser.email.split("@")[0] : "You");
    studentsMap.set(currentUser.uid, {
      uid: currentUser.uid,
      name,
      email: currentUser.email || "",
      registerNumber: currentUser.registerNumber || "",
      branch: currentUser.branch || "",
      yearOrBatch: currentUser.yearOrBatch || "",
      score: userWellness.score,
      streak: userWellness.streak,
      rank: 0,
      badge: "",
      isCurrentUser: true,
    });
  }

  // Convert map to array
  const studentList = Array.from(studentsMap.values());

  // Sort descending by score, then by streak
  studentList.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.streak - a.streak;
  });

  const badges = [
    "Campus Champion 👑",
    "Mindfulness Ace 🥈",
    "Resilience Star 🥉",
    "Wellness Vanguard ⭐",
    "Active Practitioner",
    "Daily Explorer",
  ];

  // Assign 1-indexed ranks and badges
  const rankedStudents = studentList.map((st, idx) => ({
    ...st,
    rank: idx + 1,
    badge: st.score > 0 ? badges[Math.min(idx, badges.length - 1)] : "New Member",
  }));

  return {
    campusName,
    campusId: campusId || "",
    totalParticipants: rankedStudents.length,
    students: rankedStudents,
  };
}

export async function getAllCampusesTopStudents(): Promise<CampusLeaderboardResult[]> {
  const campuses = await listCampuses().catch(() => []);
  const results = await Promise.all(
    campuses.map((c) => getCampusStudentRankings(c.id, null))
  );
  return results;
}


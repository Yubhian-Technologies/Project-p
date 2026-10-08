import { addDoc, collection, getDocs, query, where } from "firebase/firestore";
import { db } from "./config";
import type { SsiSeverity } from "../../config/ssiForm";
import type { SsiAnswerItem } from "./ssiTest";

const COLLECTION = "ssi_college_results";

export interface SsiCollegeResultInput {
  userId: string;
  userEmail: string;
  displayName: string;
  collegeId: string;
  campusId?: string;
  level1: Record<string, string>;
  likertAnswers: SsiAnswerItem[];
  level3Answers: SsiAnswerItem[];
  likertScore: number;
  likertMax: number;
  depressionScore: number;
  anxietyScore: number;
  stressScore: number;
  severity: SsiSeverity;
  whatsappNumber: string;
  consentGiven: boolean;
  consentItems: string[];
}

export interface SsiCollegeResult extends SsiCollegeResultInput {
  id: string;
  submittedAt: number;
}

function toSsiCollegeResult(id: string, data: Record<string, unknown>): SsiCollegeResult {
  return {
    id,
    userId: (data.userId as string) ?? "",
    userEmail: (data.userEmail as string) ?? "",
    displayName: (data.displayName as string) ?? "",
    collegeId: (data.collegeId as string) ?? "",
    campusId: data.campusId as string | undefined,
    level1: (data.level1 as Record<string, string>) ?? {},
    likertAnswers: (data.likertAnswers as SsiAnswerItem[]) ?? [],
    level3Answers: (data.level3Answers as SsiAnswerItem[]) ?? [],
    likertScore: (data.likertScore as number) ?? 0,
    likertMax: (data.likertMax as number) ?? 0,
    depressionScore: (data.depressionScore as number) ?? 0,
    anxietyScore: (data.anxietyScore as number) ?? 0,
    stressScore: (data.stressScore as number) ?? 0,
    severity: (data.severity as SsiSeverity) ?? "normal",
    whatsappNumber: (data.whatsappNumber as string) ?? "",
    consentGiven: (data.consentGiven as boolean) ?? false,
    consentItems: (data.consentItems as string[]) ?? [],
    submittedAt:
      (data.submittedAt as { toMillis?: () => number })?.toMillis?.() ??
      (data.submittedAt as number) ??
      Date.now(),
  };
}

/** Submits a standalone (no-booking) SSI check-in, scoped to the student's own college. */
export async function submitSsiCollegeResult(input: SsiCollegeResultInput): Promise<void> {
  const payload: Record<string, unknown> = { ...input, submittedAt: Date.now() };
  // Firestore rejects `undefined` field values outright — campusId is optional
  // on the profile, so only include it when the student actually has one.
  if (payload.campusId === undefined) delete payload.campusId;
  await addDoc(collection(db, COLLECTION), payload);
}

/** A student's own standalone SSI submission history. */
export async function listSsiCollegeResultsForUser(uid: string): Promise<SsiCollegeResult[]> {
  const q = query(collection(db, COLLECTION), where("userId", "==", uid));
  const snap = await getDocs(q);
  return snap.docs.map((d) => toSsiCollegeResult(d.id, d.data()));
}

/** Every standalone SSI submission for a college — used by that college's own counsellors. */
export async function listSsiCollegeResultsForCollege(collegeId: string): Promise<SsiCollegeResult[]> {
  const q = query(collection(db, COLLECTION), where("collegeId", "==", collegeId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => toSsiCollegeResult(d.id, d.data()));
}

/** Every standalone SSI submission across a whole campus — used by that campus's
    Head, who oversees every college in it, not just their own one college
    (unlike a Counsellor, who only ever sees their own college's submissions). */
export async function listSsiCollegeResultsForCampus(campusId: string): Promise<SsiCollegeResult[]> {
  const q = query(collection(db, COLLECTION), where("campusId", "==", campusId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => toSsiCollegeResult(d.id, d.data()));
}

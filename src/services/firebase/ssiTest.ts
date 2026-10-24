import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
} from "firebase/firestore";
import { db } from "./config";
import { createNotification } from "./notifications";
import {
  SSI_LIKERT_MAX,
  SSI_LIKERT_OPTIONS,
  SSI_LIKERT_QUESTIONS,
  type SsiDomain,
} from "../../config/ssiForm";

export interface SsiAnswerItem {
  id: string;
  label: string;
  answer: string;
  kind: "likert" | "text" | "choice";
  value?: number;
}

export interface SsiResultInput {
  bookingId: string;
  userId: string;
  userEmail: string;
  counsellorId: string;
  counsellorEmail: string;
  level1: Record<string, string>;
  likertAnswers: SsiAnswerItem[];
  level3Answers: SsiAnswerItem[];
  likertScore: number;
  likertMax: number;
  physicalScore?: number;
  interpersonalScore?: number;
  academicScore?: number;
  environmentalScore?: number;
  depressionScore?: number;
  anxietyScore?: number;
  stressScore?: number;
  whatsappNumber: string;
  consentGiven: boolean;
  consentItems: string[];
}

export interface SsiResult extends SsiResultInput {
  id: string;
  submittedAt: number;
}

export interface SsiLikertResult {
  items: SsiAnswerItem[];
  score: number;
  max: number;
  physical: number;
  interpersonal: number;
  academic: number;
  environmental: number;
}

const COLLECTION = "ssi_results";

function toSsiResult(id: string, data: Record<string, unknown>): SsiResult {
  return {
    id,
    bookingId: (data.bookingId as string) ?? "",
    userId: (data.userId as string) ?? "",
    userEmail: (data.userEmail as string) ?? "",
    counsellorId: (data.counsellorId as string) ?? "",
    counsellorEmail: (data.counsellorEmail as string) ?? "",
    level1: (data.level1 as Record<string, string>) ?? {},
    likertAnswers: (data.likertAnswers as SsiAnswerItem[]) ?? [],
    level3Answers: (data.level3Answers as SsiAnswerItem[]) ?? [],
    likertScore: (data.likertScore as number) ?? 0,
    likertMax: (data.likertMax as number) ?? 63,
    physicalScore: data.physicalScore as number | undefined,
    interpersonalScore: data.interpersonalScore as number | undefined,
    academicScore: data.academicScore as number | undefined,
    environmentalScore: data.environmentalScore as number | undefined,
    depressionScore: data.depressionScore as number | undefined,
    anxietyScore: data.anxietyScore as number | undefined,
    stressScore: data.stressScore as number | undefined,
    whatsappNumber: (data.whatsappNumber as string) ?? "",
    consentGiven: (data.consentGiven as boolean) ?? false,
    consentItems: (data.consentItems as string[]) ?? [],
    submittedAt:
      (data.submittedAt as { toMillis?: () => number })?.toMillis?.() ??
      (data.submittedAt as number) ??
      Date.now(),
  };
}

/** A student's own SSI results across all their bookings (to flag completed tests). */
export async function listSsiResultsForUser(uid: string): Promise<SsiResult[]> {
  const q = query(collection(db, COLLECTION), where("userId", "==", uid));
  const snap = await getDocs(q);
  return snap.docs.map((d) => toSsiResult(d.id, d.data()));
}

/** One SSI result for a specific booking (doc id IS the booking id). */
export async function getSsiResult(bookingId: string): Promise<SsiResult | null> {
  const ref = doc(db, COLLECTION, bookingId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return toSsiResult(snap.id, snap.data());
}

/**
 * Submits the SSI test for a booking. The doc id equals the booking id, so a
 * second submission is a create conflict — enforcing one attempt per booking.
 * After saving, the assigned counsellor is notified.
 */
export async function submitSsiResult(input: SsiResultInput): Promise<void> {
  await setDoc(doc(db, COLLECTION, input.bookingId), {
    ...input,
    submittedAt: Date.now(),
  });
  await createNotification({
    recipientId: input.counsellorId,
    type: "ssi_test",
    bookingId: input.bookingId,
    title: "SSI test submitted",
    message: `${input.userEmail} completed the SSI test — review the result before your session.`,
  });
}

/**
 * Builds the likert answer items + score from a raw {questionId: optionValue}
 * map, so the UI stays dumb and scoring stays centralised.
 */
export function buildLikertResult(
  answers: Record<string, number>,
): SsiLikertResult {
  const optionByValue = new Map(SSI_LIKERT_OPTIONS.map((o) => [o.value, o.label]));
  let score = 0;
  const domainScores: Record<SsiDomain, number> = {
    physical: 0,
    interpersonal: 0,
    academic: 0,
    environmental: 0,
  };
  const items = SSI_LIKERT_QUESTIONS.map((q) => {
    const value = answers[q.id];
    const item = {
      id: q.id,
      label: q.label,
      answer: optionByValue.get(value) ?? "—",
      kind: "likert" as const,
      value: value ?? 0,
    };
    score += value ?? 0;
    domainScores[q.domain] += value ?? 0;
    return item;
  });
  return { items, score, max: SSI_LIKERT_MAX, ...domainScores };
}
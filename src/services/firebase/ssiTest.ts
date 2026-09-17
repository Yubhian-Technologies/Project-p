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
  depressionScore: number;
  anxietyScore: number;
  stressScore: number;
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
  depression: number;
  anxiety: number;
  stress: number;
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
    likertMax: (data.likertMax as number) ?? SSI_LIKERT_MAX,
    depressionScore: (data.depressionScore as number) ?? 0,
    anxietyScore: (data.anxietyScore as number) ?? 0,
    stressScore: (data.stressScore as number) ?? 0,
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
  let depression = 0;
  let anxiety = 0;
  let stress = 0;
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
    if (q.scale === "d") depression += value ?? 0;
    else if (q.scale === "a") anxiety += value ?? 0;
    else stress += value ?? 0;
    return item;
  });
  return { items, score, max: SSI_LIKERT_MAX, depression, anxiety, stress };
}
import { collection, doc, getDoc, getDocs, query, setDoc, where } from "firebase/firestore";
import { db } from "./config";
import type { SessionFeedback, FeedbackAnswer } from "../../types/feedback";
import type { Booking } from "../../types/booking";
import { createNotification } from "./notifications";
import { listUsersByRole } from "./firestore";

export interface CounsellorFeedbackAggregate {
  counsellorId: string;
  count: number;
  average: number;
  /** Star-level distribution — index 0 is 1-star … index 4 is 5-star. */
  distribution: number[];
  /**
   * Average for each numeric-scored question across all feedback for the
   * counsellor (text answers are skipped).
   */
  perQuestion: { label: string; average: number; count: number }[];
  feedback: SessionFeedback[];
}

const feedbackCollection = collection(db, "sessionFeedback");

function toSessionFeedback(id: string, data: Record<string, unknown>): SessionFeedback {
  return { ...(data as unknown as SessionFeedback), bookingId: id };
}

export async function getFeedbackForBooking(bookingId: string): Promise<SessionFeedback | null> {
  const snapshot = await getDoc(doc(db, "sessionFeedback", bookingId));
  return snapshot.exists() ? toSessionFeedback(snapshot.id, snapshot.data()) : null;
}

export async function listFeedbackForUser(userId: string): Promise<SessionFeedback[]> {
  const q = query(feedbackCollection, where("userId", "==", userId));
  const snapshot = await getDocs(q);
  return snapshot.docs
    .map((d) => toSessionFeedback(d.id, d.data()))
    .sort((a, b) => b.submittedAt - a.submittedAt);
}

/**
 * Writes one feedback doc for a completed session. The doc id IS the booking
 * id, so submitting twice throws (create conflict) — the UI hides the button
 * once feedback exists, and Firestore rules reject a second write anyway.
 * Returns the created booking id.
 */
export async function createSessionFeedback(
  booking: Booking,
  rating: number,
  answers: FeedbackAnswer[],
): Promise<string> {
  await setDoc(doc(db, "sessionFeedback", booking.id), {
    bookingId: booking.id,
    userId: booking.userId,
    userEmail: booking.userEmail,
    counsellorId: booking.counsellorId,
    counsellorEmail: booking.counsellorEmail,
    campusId: booking.campusId ?? "",
    rating,
    answers,
    submittedAt: Date.now(),
  });

  notifyFeedbackSubmitted(booking, rating);
  return booking.id;
}

/** Alerts the session's counsellor (and the campus head, when one exists). */
async function notifyFeedbackSubmitted(booking: Booking, rating: number): Promise<void> {
  const ratingLabel = `${rating}/5`;
  try {
    await createNotification({
      recipientId: booking.counsellorId,
      type: "feedback_submitted",
      bookingId: booking.id,
      title: "New session feedback",
      message: `A student rated your session ${ratingLabel}. View it in My Feedback.`,
    });

    const heads = booking.campusId
      ? (await listUsersByRole("head")).filter((h) => h.campusId === booking.campusId)
      : [];
    await Promise.all(
      heads.map((head) =>
        createNotification({
          recipientId: head.uid,
          type: "feedback_submitted",
          bookingId: booking.id,
          title: "New session feedback",
          message: `New feedback (${ratingLabel}) recorded for ${booking.counsellorEmail}.`,
        }),
      ),
    );
  } catch (error) {
    console.error("Failed to send feedback notifications", error);
  }
}

export async function listFeedbackForCounsellor(counsellorId: string): Promise<SessionFeedback[]> {
  const q = query(feedbackCollection, where("counsellorId", "==", counsellorId));
  const snapshot = await getDocs(q);
  return snapshot.docs
    .map((d) => toSessionFeedback(d.id, d.data()))
    .sort((a, b) => b.submittedAt - a.submittedAt);
}

export async function getAllFeedback(campusId?: string): Promise<SessionFeedback[]> {
  // Scoped to one campus server-side whenever possible — this collection
  // only grows (one doc per rated session), so fetching every campus's
  // feedback just to filter it client-side got slower every month. The
  // unfiltered path stays for callers that genuinely need every campus
  // (e.g. Admin's "All campuses" view).
  const snapshot = await getDocs(
    campusId === undefined ? feedbackCollection : query(feedbackCollection, where("campusId", "==", campusId)),
  );
  return snapshot.docs
    .map((d) => toSessionFeedback(d.id, d.data()))
    .sort((a, b) => b.submittedAt - a.submittedAt);
}

function isNumericAnswer(value: string): boolean {
  const n = Number(value);
  return value.trim() !== "" && Number.isFinite(n);
}

/** Aggregates one counsellor's feedback from an already-fetched list. */
export function aggregateCounsellorFeedback(
  counsellorId: string,
  feedbackList: SessionFeedback[],
): CounsellorFeedbackAggregate | null {
  const own = feedbackList.filter((f) => f.counsellorId === counsellorId);
  if (own.length === 0) return null;

  const distribution = [0, 0, 0, 0, 0];
  for (const f of own) {
    const rating = Math.max(1, Math.min(5, Math.round(f.rating)));
    distribution[rating - 1] += 1;
  }

  const questionAverages = new Map<string, { sum: number; count: number }>();
  for (const f of own) {
    for (const answer of f.answers ?? []) {
      if (!isNumericAnswer(answer.value)) continue;
      const entry = questionAverages.get(answer.label) ?? { sum: 0, count: 0 };
      entry.sum += Number(answer.value);
      entry.count += 1;
      questionAverages.set(answer.label, entry);
    }
  }
  const perQuestion = Array.from(questionAverages.entries()).map(([label, { sum, count }]) => ({
    label,
    average: sum / count,
    count,
  }));

  const average = own.reduce((sum, f) => sum + f.rating, 0) / own.length;

  const feedback = [...own].sort((a, b) => b.submittedAt - a.submittedAt);

  return { counsellorId, count: own.length, average, distribution, perQuestion, feedback };
}

/** Aggregates feedback for every counsellor from an already-fetched list. */
export function aggregateAllCounsellorFeedback(
  feedbackList: SessionFeedback[],
): CounsellorFeedbackAggregate[] {
  const byCounsellor = new Map<string, SessionFeedback[]>();
  for (const f of feedbackList) {
    const list = byCounsellor.get(f.counsellorId) ?? [];
    list.push(f);
    byCounsellor.set(f.counsellorId, list);
  }

  const aggregates: CounsellorFeedbackAggregate[] = [];
  for (const [counsellorId, list] of byCounsellor) {
    const agg = aggregateCounsellorFeedback(counsellorId, list);
    if (agg) aggregates.push(agg);
  }

  return aggregates.sort((a, b) => b.average - a.average || b.count - a.count);
}
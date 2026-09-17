export interface FeedbackAnswer {
  label: string;
  value: string;
}

/**
 * One feedback entry per held session, written by the in-app feedback form.
 * One doc per booking — the document id IS the booking id, which also makes
 * "one feedback per booking" structurally enforced (submitting twice conflicts
 * on the same doc id).
 */
export interface SessionFeedback {
  bookingId: string;
  userId: string;
  userEmail?: string;
  counsellorId: string;
  counsellorEmail: string;
  campusId?: string;
  /** Overall rating (1–5). */
  rating: number;
  /** Answers to the additional questions (label = question title, value = response). */
  answers?: FeedbackAnswer[];
  submittedAt: number;
}
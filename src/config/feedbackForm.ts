export type FeedbackQuestionKind = "rating" | "choice" | "text";

export interface FeedbackQuestion {
  /** Stable id used to key the student's answer while filling the form. */
  id: string;
  label: string;
  kind: FeedbackQuestionKind;
  required?: boolean;
  /** For kind === "rating" — lower bound of the scale (1). */
  min?: number;
  /** For kind === "rating" — upper bound of the scale (5). */
  max?: number;
  /** For kind === "choice" — the selectable options (shown as pill buttons). */
  options?: string[];
  /** For kind === "text" — placeholder shown in the textarea. */
  placeholder?: string;
}

export interface FeedbackFormConfig {
  title: string;
  intro: string;
  submitLabel: string;
  questions: FeedbackQuestion[];
}

/**
 * Post-session feedback form rendered inside the app ("Take Feedback" flow).
 * The "overall" rating question (id === "overall") is stored both in
 * `sessionFeedback.rating` (drives the aggregate counsellor score) and inside
 * `answers`. All remaining answers are stored under `sessionFeedback.answers` —
 * numeric (star) ones surface as per-question averages in the Admin ratings
 * view, text one as-is.
 */
export const FEEDBACK_FORM: FeedbackFormConfig = {
  title: "Rate your session",
  intro: "A few quick questions help your counsellor and our wellness team improve every session.",
  submitLabel: "Submit feedback",
  questions: [
    {
      id: "objectives",
      label: "The objectives of the session were clearly explained.",
      kind: "rating",
      required: true,
      min: 1,
      max: 5,
    },
    {
      id: "interactive",
      label: "The session was interactive and engaging.",
      kind: "rating",
      required: true,
      min: 1,
      max: 5,
    },
    {
      id: "relevant",
      label: "The session content was relevant and useful and the examples & activities helped me understand the topic.",
      kind: "rating",
      required: true,
      min: 1,
      max: 5,
    },
    {
      id: "skills",
      label: "I gained useful knowledge or skills from this session.",
      kind: "rating",
      required: true,
      min: 1,
      max: 5,
    },
    {
      id: "overall",
      label: "Overall, how would you rate this session?",
      kind: "rating",
      required: true,
      min: 1,
      max: 5,
    },
    {
      id: "felt-heard",
      label: "I felt heard and understood by my counsellor.",
      kind: "rating",
      required: true,
      min: 1,
      max: 5,
    },
    {
      id: "felt-comfortable",
      label: "I felt comfortable talking about what was on my mind.",
      kind: "rating",
      required: true,
      min: 1,
      max: 5,
    },
    {
      id: "recommend",
      label: "I would recommend counselling to a friend who needed it.",
      kind: "rating",
      required: true,
      min: 1,
      max: 5,
    },
    {
      id: "connect",
      label: "Would you like to approach your counsellor after this session?",
      kind: "choice",
      required: true,
      options: [
        "Yes, I would like to connect with a counsellor.",
        "Maybe, I may need support in the future.",
        "No, I do not require support at this time.",
      ],
    },
    {
      id: "more-sessions",
      label: "Would you like more sessions from our wellness team?",
      kind: "choice",
      required: true,
      options: ["Yes", "No", "Maybe"],
    },
    {
      id: "topics",
      label: "If yes, what topics would you like us to cover?",
      kind: "text",
      placeholder: "Share the topics you'd like us to cover…",
    },
  ],
};
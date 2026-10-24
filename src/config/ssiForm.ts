/**
 * SSI (Pre-Session Assessment) test configuration.
 *
 * The test is a 4-page wizard shown to a student once their booking has been
 * accepted by the counsellor (before the session starts):
 *
 *   Page 1 — Mandatory Student Wellbeing Screening form header + basic details
 *   Page 2 — the 40-item SSI inventory (all share the same 1-4 rating scale)
 *   Page 3 — important questions (blanks + option marking)
 *   Page 4 — contact (WhatsApp) + consent tick-boxes, then submit
 *
 * Institution & campus details are NOT asked here — they are shared with the
 * counsellor automatically from the details set at sign-up.
 *
 * Every page shows its consent/instruction text and a short "how to answer"
 * guidance line, exactly as the spec requires.
 */

export interface SsiLevelIntro {
  id: number;
  title: string;
  consent: string;
  guidance: string;
}

export const SSI_FORM_TITLE = "Vishnu Wellness Centre — Mandatory Student Wellbeing Screening Form";

export const SSI_LEVELS: SsiLevelIntro[] = [
  {
    id: 1,
    title: "Page 1 · About You",
    consent:
      "This questionnaire helps us understand how you have been feeling lately. Please answer HONESTLY — there are no RIGHT or WRONG answers. Your responses are CONFIDENTIAL and will help us provide you with the best and free psychological support possible.",
    guidance: "Time needed: 2-3 minutes only. Fill in the details below.",
  },
  {
    id: 2,
    title: "Page 2 · Student Stress Inventory",
    consent: "Your responses are CONFIDENTIAL and are seen only by your authorised wellness counsellor.",
    guidance:
      "This inventory measures stresses you have experienced in your study and everyday campus life over this semester. There are no right or wrong answers. Read each statement and choose one response: Never (1), Somewhat frequent (2), Frequent (3), or Always (4).",
  },
  {
    id: 3,
    title: "Page 3 · Important Questions",
    consent: "These questions are very important. Your answers stay confidential and help your counsellor keep you safe and supported.",
    guidance: "Please answer honestly.",
  },
  {
    id: 4,
    title: "Page 4 · My Consent",
    consent:
      "Your participation in this wellness screening is Mandatory. The information you provide will be used only by the Vishnu Wellness Centre to understand your well-being and determine whether you may benefit from counselling or other support services.\n\nYour responses will be kept strictly confidential and will only be accessed by your respective authorised Wellness Counsellor. Completing this form does not mean that you have a psychological condition or diagnosis.\n\nIf you are experiencing a psychological emergency or are at risk of harming yourself or others, please contact the Wellness counsellor directly, inform a trusted person, or seek immediate emergency assistance.",
    guidance: "Tick each box to give your consent, then submit.",
  },
];

// ── Page 1: basic student details ─────────────────────────────────────────────
export interface SsiLevel1Field {
  id: string;
  label: string;
  kind: "text" | "select";
  options?: string[];
  required?: boolean;
}

export const SSI_LEVEL1_FIELDS: SsiLevel1Field[] = [
  { id: "department", label: "Department", kind: "text", required: true },
  { id: "year", label: "Year", kind: "text", required: true },
  { id: "hostelOrDayScholar", label: "Hostel / Day Scholar", kind: "select", options: ["Hostel", "Day Scholar"], required: true },
];

export function ssiPage1Note(studentOrProfessional?: "student" | "professional"): string {
  const base =
    "Your Institution and campus details will automatically be shared with the counsellor, as they were set at the time of sign-up.";
  if (studentOrProfessional === "professional") {
    return `${base} Department and Age are pre-filled from your profile's bio data where available — please correct them here if anything has changed.`;
  }
  return `${base} Department, Year and Hostel/Day Scholar are pre-filled from your profile where available — please correct them here if anything has changed. Age is calculated automatically from your Date of Birth in your Profile's bio data.`;
}

// ── Page 2: SSI inventory rating scale + statements ──────────────────────────
export interface SsiLikertOption {
  /** Short label shown on the in-question choice buttons. */
  short: string;
  /** Full label shown in the scale legend and stored in the result. */
  label: string;
  value: number;
}

export type SsiDomain = "physical" | "interpersonal" | "academic" | "environmental";

export interface SsiLikertQuestion {
  id: string;
  label: string;
  domain: SsiDomain;
}

export const SSI_LIKERT_OPTIONS: SsiLikertOption[] = [
  { short: "1", label: "1 – Never (N)", value: 1 },
  { short: "2", label: "2 – Somewhat frequent (SF)", value: 2 },
  { short: "3", label: "3 – Frequent (F)", value: 3 },
  { short: "4", label: "4 – Always (A)", value: 4 },
];

export const SSI_LIKERT_QUESTIONS: SsiLikertQuestion[] = [
  { id: "l2_q1", domain: "physical", label: "Headaches" },
  { id: "l2_q2", domain: "physical", label: "Back pain" },
  { id: "l2_q3", domain: "physical", label: "Sleep problem" },
  { id: "l2_q4", domain: "physical", label: "Difficulty breathing" },
  { id: "l2_q5", domain: "physical", label: "Excessive worry" },
  { id: "l2_q6", domain: "physical", label: "Stomach pain/nausea" },
  { id: "l2_q7", domain: "physical", label: "Constant tiredness/fatigue" },
  { id: "l2_q8", domain: "physical", label: "Sweating/sweaty hands" },
  { id: "l2_q9", domain: "physical", label: "Frequent cold/flu/fever" },
  { id: "l2_q10", domain: "physical", label: "Drastic weight loss" },
  { id: "l2_q11", domain: "interpersonal", label: "I find difficult to meet my high parent’s expectation" },
  { id: "l2_q12", domain: "interpersonal", label: "My parents treat me as a helpless person" },
  { id: "l2_q13", domain: "interpersonal", label: "I feel guilty if I fail to fulfill my parent’s hope" },
  { id: "l2_q14", domain: "interpersonal", label: "My parents wish only for my success" },
  { id: "l2_q15", domain: "interpersonal", label: "I find difficult to get along with groupmates in doing academic task" },
  { id: "l2_q16", domain: "interpersonal", label: "My friends did not care about me" },
  { id: "l2_q17", domain: "interpersonal", label: "I feel disturbed when having problem with my boyfriend/girlfriend" },
  { id: "l2_q18", domain: "interpersonal", label: "My families are not supportive" },
  { id: "l2_q19", domain: "interpersonal", label: "My lecturers/ teachers are not supportive" },
  { id: "l2_q20", domain: "interpersonal", label: "I feel frustrated by the lack of faculty management" },
  { id: "l2_q21", domain: "academic", label: "I have a financial problem because of the expenses of the university" },
  { id: "l2_q22", domain: "academic", label: "I find difficult to juggle time between study and social activity" },
  { id: "l2_q23", domain: "academic", label: "I feel nervous delivering the class presentation" },
  { id: "l2_q24", domain: "academic", label: "I feel stressed as submission deadline neared" },
  { id: "l2_q25", domain: "academic", label: "I feel stressed to sit for examination" },
  { id: "l2_q26", domain: "academic", label: "I find difficult to juggle time between study and society involvement" },
  { id: "l2_q27", domain: "academic", label: "I loss interest towards courses" },
  { id: "l2_q28", domain: "academic", label: "I feel burden of academic workloads" },
  { id: "l2_q29", domain: "academic", label: "I feel stressed dealing with difficult subject" },
  { id: "l2_q30", domain: "academic", label: "I feel difficult in handling my academic problem" },
  { id: "l2_q31", domain: "environmental", label: "I have transportation problem" },
  { id: "l2_q32", domain: "environmental", label: "I feel stressed with bad living condition of hostel" },
  { id: "l2_q33", domain: "environmental", label: "Surrounding noise distracted me" },
  { id: "l2_q34", domain: "environmental", label: "Pollution make me uneasy" },
  { id: "l2_q35", domain: "environmental", label: "Hot weather make me avoid to go out" },
  { id: "l2_q36", domain: "environmental", label: "Messy living conditions distracted me" },
  { id: "l2_q37", domain: "environmental", label: "I feel frustrated of inadequate campus facilities" },
  { id: "l2_q38", domain: "environmental", label: "Crowding make me feel uneasy" },
  { id: "l2_q39", domain: "environmental", label: "Waited in a long line make me feel uneasy" },
  { id: "l2_q40", domain: "environmental", label: "I feel scared being at the insecure place" },
];

export const SSI_LIKERT_MIN = SSI_LIKERT_QUESTIONS.length;
export const SSI_LIKERT_MAX = 4 * SSI_LIKERT_QUESTIONS.length;
export const SSI_DOMAIN_MIN = 10;
export const SSI_DOMAIN_MAX = 4 * SSI_DOMAIN_MIN;

export const SSI_DOMAIN_LABELS: Record<SsiDomain, string> = {
  physical: "Physical",
  interpersonal: "Interpersonal Relationship",
  academic: "Academic",
  environmental: "Environmental",
};

// ── Page 3: important questions (blanks + option-marking) ─────────────────────
export interface SsiLevel3Question {
  id: string;
  label: string;
  kind: "text" | "choice";
  options?: string[];
  required?: boolean;
}

export const SSI_LEVEL3_QUESTIONS: SsiLevel3Question[] = [
  {
    id: "l3_q1",
    label:
      'During the past 2 weeks, have you had thoughts that life is not worth living or thoughts of harming yourself?\n(గత రెండు వారాల్లో, "బ్రతకడం అనవసరమని" లేదా "నాకు నేనే హాని చేసుకోవాలనే" ఆలోచనలు మీకు వచ్చాయా?)',
    kind: "choice",
    options: ["Yes", "No", "Maybe"],
    required: true,
  },
  {
    id: "l3_q2",
    label:
      "Have you experienced or witnessed any traumatic or very upsetting events recently?\n(మీరు ఈ మధ్య కాలంలో ఏమైనా బాధను కలిగించేది లేదా మనశ్శాంతి కోల్పోయేలా చేసిన సంఘటనలు అనుభవించారా లేదా చూసారా?)",
    kind: "choice",
    options: ["Yes", "No"],
    required: true,
  },
  {
    id: "l3_q3",
    label: "Any issue you want to mention: (optional)",
    kind: "text",
    required: false,
  },
  {
    id: "l3_q4",
    label: "If you require personal support, may we contact you?",
    kind: "choice",
    options: [
      "Yes, I would like to receive support from my wellness counsellor",
      "Not at the moment.",
      "I may need support in the future.",
    ],
    required: true,
  },
];

// ── Page 4: consent tick-boxes + contact details ──────────────────────────────
export const SSI_CONSENT_ITEMS: string[] = [
  "The information provided is confidential.",
  "My age is above 18 and I consent to seek help",
  "Agree to my counsellor to approach me for free psychological support",
  "In case of emergencies, I should seek immediate help.",
];

export const SSI_WHATSAPP_NOTE =
  "Only your wellness counsellor will contact you. Your details will be kept confidential and your number will be under our records safely.";

// ── Severity bands (Page 2 SSI total + Page 3 safety questions) ───────────────
export type SsiSeverity = "normal" | "medium" | "severe";

export function computeSsiSeverity(input: {
  score: number;
  selfHarmAnswer?: string; // l3_q1
  traumaAnswer?: string; // l3_q2
}): SsiSeverity {
  const selfHarm = input.selfHarmAnswer === "Yes" || input.selfHarmAnswer === "Maybe";
  if (selfHarm || input.score >= 122) return "severe";
  if (input.score >= 81 || input.traumaAnswer === "Yes") return "medium";
  return "normal";
}

export const SSI_SEVERITY_LABELS: Record<SsiSeverity, string> = {
  severe: "Severe stress",
  medium: "Moderate stress",
  normal: "Mild stress",
};

export function ssiSeverityLabel(severity: SsiSeverity, likertMax: number): string {
  if (likertMax !== SSI_LIKERT_MAX) {
    if (severity === "severe") return "Needs a session or action immediately";
    if (severity === "medium") return "Recommend scheduling a session soon";
    return "No immediate concern";
  }
  return SSI_SEVERITY_LABELS[severity];
}
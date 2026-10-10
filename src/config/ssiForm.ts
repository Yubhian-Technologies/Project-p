/**
 * SSI (Pre-Session Assessment) test configuration.
 *
 * The test is a 4-page wizard shown to a student once their booking has been
 * accepted by the counsellor (before the session starts):
 *
 *   Page 1 — Mandatory Student Wellbeing Screening form header + basic details
 *   Page 2 — the DASS-21 statements (all share the same 0-3 rating scale)
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
    title: "Page 2 · How you felt this past week",
    consent: "Your responses are CONFIDENTIAL and are seen only by your authorised wellness counsellor.",
    guidance:
      "Remember how you have felt over the past week and answer each statement as best you can.\n(గత ఒక వారం రోజులలో మీకు ఎలా అనిపించిందో గుర్తు చేసుకుని, ప్రతి ప్రశ్నకు మీకు సరిపోయే సమాధానాన్ని ఎంచుకోండి)\n\nPlease read each statement and choose the number 0, 1, 2 or 3 which indicates how much the statement applied to you over the past week.\n\nThere are no right or wrong answers. Do not spend too much time on any one statement.",
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
  { id: "section", label: "Section", kind: "text", required: true },
  { id: "hostelOrDayScholar", label: "Hostel / Day Scholar", kind: "select", options: ["Hostel", "Day Scholar"], required: true },
  { id: "age", label: "Age", kind: "text", required: true },
];

export const SSI_PAGE1_NOTE =
  "Your Institution and campus details will automatically be shared with the counsellor, as they were set at the time of sign-up. Department, Year and Age are pre-filled from your profile — please correct them here if anything has changed.";

// ── Page 2: DASS-21 rating scale + statements ─────────────────────────────────
export interface SsiLikertOption {
  /** Short label shown on the in-question choice buttons. */
  short: string;
  /** Full label shown in the scale legend and stored in the result. */
  label: string;
  value: number;
}

export type SsiSubscale = "d" | "a" | "s";

export interface SsiLikertQuestion {
  id: string;
  label: string;
  /** DASS-21 subscale: d = depression, a = anxiety, s = stress. */
  scale: SsiSubscale;
}

export const SSI_LIKERT_OPTIONS: SsiLikertOption[] = [
  {
    short: "0",
    label: "0 – Did not apply to me at all (నాకు అసలు వర్తించలేదు)",
    value: 0,
  },
  {
    short: "1",
    label: "1 – Applied to me to some degree, or some of the time (కొంతవరకు లేదా కొన్నిసార్లు నాకు ఇలా అనిపించింది)",
    value: 1,
  },
  {
    short: "2",
    label: "2 – Applied to me to a considerable degree or a good part of the time (చాలా వరకు లేదా ఎక్కువ సమయం నాకు ఇలా అనిపించింది)",
    value: 2,
  },
  {
    short: "3",
    label: "3 – Applied to me very much or most of the time (దాదాపు ఎప్పుడూ లేదా ఎక్కువగా నాకు ఇలా అనిపించింది)",
    value: 3,
  },
];

export const SSI_LIKERT_QUESTIONS: SsiLikertQuestion[] = [
  {
    id: "l2_q1",
    scale: "s",
    label: "I found it hard to wind down (ఎంత ప్రయత్నించినా నా మనసు కుదుటపడలేదు. నాకు ప్రశాంతంగా ఉండటం కష్టమైపోయింది.)",
  },
  {
    id: "l2_q2",
    scale: "a",
    label: "I was aware of dryness of my mouth (నా నోరు పొడారడం/ఎండిపోవడం నాకు తెలుస్తుంది)",
  },
  {
    id: "l2_q3",
    scale: "d",
    label: "I couldn't seem to experience any positive feeling at all (పరిస్థితుల నుండి మంచి అనుభవాలు పొందలేకున్నాను)",
  },
  {
    id: "l2_q4",
    scale: "a",
    label: "I experienced breathing difficulty (e.g. excessively rapid breathing, breathlessness in the absence of physical exertion) (నాకు శ్వాస తీసుకోవడం ఇబ్బందిగావుంది (ఉదా: శారీరక శ్రమ లేకపోయినా ఆయాసపడటం))",
  },
  {
    id: "l2_q5",
    scale: "d",
    label: "I found it difficult to work up the initiative to do things (నాకు ఒక కొత్త పని మొదలుపెట్టడానికి కష్టంగావుంది/ఉత్సాహంగా లేదు)",
  },
  {
    id: "l2_q6",
    scale: "s",
    label: "I tended to over-react to situations (నేను పరిస్థితులకు అతిగా స్పందిస్తున్నాను)",
  },
  {
    id: "l2_q7",
    scale: "a",
    label: "I experienced trembling (e.g. in the hands) (నాకు శరీరం వణుకుతున్నట్లు అనిపిస్తోంది (ఉదా: చేతులు వణకడం))",
  },
  {
    id: "l2_q8",
    scale: "s",
    label: "I felt that I was using a lot of nervous energy (నేను ఆందోళన చెందటం వలన చాలా శక్తిని ఖర్చుచేస్తున్నాను అని నాకు అనిపిస్తుంది)",
  },
  {
    id: "l2_q9",
    scale: "a",
    label: "I was worried about situations in which I might panic and make a fool of myself (నేను కొన్ని పరిస్థితులలో భయపడి నవ్వులపాలు అవుతానేమో అని చింతిస్తున్నాను)",
  },
  {
    id: "l2_q10",
    scale: "d",
    label: "I felt that I had nothing to look forward to (నా జీవితంలో ఎదురు చూసేలా ఏమి లేదని నాకు అనిపిస్తోంది)",
  },
  {
    id: "l2_q11",
    scale: "s",
    label: "I found myself getting agitated (నేను అసహనానికి లోనవుతున్నాను అని అనిపిస్తోంది)",
  },
  {
    id: "l2_q12",
    scale: "s",
    label: "I found it difficult to relax (నేను విశ్రాంతి తీసుకోవడానికి ఇబ్బంది పడుతున్నాను)",
  },
  {
    id: "l2_q13",
    scale: "d",
    label: "I felt down-hearted and blue (నాకు చాలా బాధగా, నిరాశగా అనిపిస్తోంది)",
  },
  {
    id: "l2_q14",
    scale: "s",
    label: "I was intolerant of anything that kept me from getting on with what I was doing (నేను చేసే పనిని చేయనీకుండా చేసే/ఆపే దేనినైనా నేను సహించలేకపోతున్నాను)",
  },
  {
    id: "l2_q15",
    scale: "a",
    label: "I felt I was close to panic (నేను భయాందోళనకు గురవుతున్నానేమో అని అనిపిస్తోంది)",
  },
  {
    id: "l2_q16",
    scale: "d",
    label: "I was unable to become enthusiastic about anything (నేను దేనిగురించీ ఆసక్తిగా, ఉత్సాహంగా ఉండలేకపోతున్నాను)",
  },
  {
    id: "l2_q17",
    scale: "d",
    label: "I felt I wasn't worth much as a person (నాకు నా పట్ల విలువ లేదనిపిస్తోంది)",
  },
  {
    id: "l2_q18",
    scale: "s",
    label: "I felt that I was rather touchy (నాకు చిన్న విషయాలకు చిరాకు వస్తోంది)",
  },
  {
    id: "l2_q19",
    scale: "a",
    label: "I was aware of the action of my heart in the absence of physical exertion (e.g. sense of heart rate increase, heart missing a beat) (నాకు శారీరక శ్రమ లేకపోయినా గుండె దడగా వుంటోంది (గుబులు, ఆందోళన))",
  },
  {
    id: "l2_q20",
    scale: "a",
    label: "I felt scared without any good reason (సరియైన కారణం లేకుండానే భయపడుతున్నాను)",
  },
  {
    id: "l2_q21",
    scale: "d",
    label: "I felt that life was meaningless (నా జీవితం అర్ధవంతంగా లేనిది/వ్యర్థం అని అనిపిస్తోంది)",
  },
];

/** Each subscale has 7 of the 21 statements; maximum per subscale = 3 × 7 = 21. */
export const SSI_LIKERT_MAX = 3 * SSI_LIKERT_QUESTIONS.length;
export const SSI_SUBSCALE_MAX = 3 * 7;

export const SSI_SUBSCALE_LABELS: Record<SsiSubscale, string> = {
  d: "Depression",
  a: "Anxiety",
  s: "Stress",
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

// ── Severity tiering (Page 2 DASS-21 subscales + Page 3 safety questions) ─────
export type SsiSeverity = "normal" | "medium" | "severe";

/**
 * Standard published DASS-21 per-subscale severity bands (raw 7-item sums,
 * 0-21 each), combined with the Page 3 safety questions:
 *  - Severe overrides everything: self-harm ideation answered "Yes"/"Maybe",
 *    or any subscale is in the clinical Severe/Extremely-Severe band.
 *  - Medium: a subscale in the Moderate band, or a "Yes" on the traumatic
 *    event question.
 */
export function computeSsiSeverity(input: {
  depression: number;
  anxiety: number;
  stress: number;
  selfHarmAnswer?: string; // l3_q1
  traumaAnswer?: string; // l3_q2
}): SsiSeverity {
  const selfHarm = input.selfHarmAnswer === "Yes" || input.selfHarmAnswer === "Maybe";
  const severeBand = input.depression >= 11 || input.anxiety >= 8 || input.stress >= 13;
  if (selfHarm || severeBand) return "severe";

  const moderateBand =
    (input.depression >= 7 && input.depression <= 10) ||
    (input.anxiety >= 6 && input.anxiety <= 7) ||
    (input.stress >= 10 && input.stress <= 12);
  if (moderateBand || input.traumaAnswer === "Yes") return "medium";

  return "normal";
}

export const SSI_SEVERITY_LABELS: Record<SsiSeverity, string> = {
  severe: "Needs a session or action immediately",
  medium: "Recommend scheduling a session soon",
  normal: "No immediate concern",
};
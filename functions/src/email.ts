import { createHash, randomUUID } from "node:crypto";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { defineSecret, defineString } from "firebase-functions/params";
import { getFirestore } from "firebase-admin/firestore";

/** Resend API key — set with: firebase functions:secrets:set RESEND_API_KEY */
const resendApiKey = defineSecret("RESEND_API_KEY");

/** Sender address. Must be on a domain verified in Resend. */
const emailFrom = defineString("EMAIL_FROM", {
  default: "Vishnu Wellness Centre <notifications@vishnuwellnesscentre.in>",
});
/** notifications@ has no real inbox behind it — a reply to it would just
    bounce. This address gets the reply instead. */
const emailReplyTo = defineString("EMAIL_REPLY_TO", {
  default: "vishnuwellnesscentre@gmail.com",
});
const referralEmailTo = defineString("REFERRAL_EMAIL_TO", {
  default: "vishnuwellnesscentre@gmail.com",
});

const referralPersonTypes = ["Student", "Working professional", "Other"];
const referralRelationships = [
  "Faculty member",
  "Parent / guardian",
  "Fellow student / colleague",
  "Non-teaching staff",
  "Other",
];
const referralConcerns = [
  "Academic stress or exam pressure",
  "Work-related stress or burnout",
  "Anxiety, worry or overthinking",
  "Low mood, withdrawal or loss of interest",
  "Behavioural or emotional changes",
  "Relationship or interpersonal concerns",
  "Attendance, adjustment or engagement concerns",
  "Sleep or lifestyle difficulties",
  "Concern about safety or self-harm",
  "Other / unsure",
];
const referralDurations = ["Within the last few days", "Several weeks", "Several months", "Not sure"];
const referralPriorities = [
  "Routine — general wellbeing concern",
  "Priority — concern is affecting daily functioning",
  "Urgent — immediate assessment is needed",
];
const referralAwareness = ["Yes, the person is aware", "No, the person is not aware", "Not sure"];
const referralAgreements = ["Yes", "Not yet discussed", "Not sure"];
const referralFollowUps = ["WhatsApp", "Phone call", "Institutional email"];

interface WellnessReferral {
  referrerName: string;
  referrerContact: string;
  personType: string;
  personTypeOther: string;
  relationship: string;
  relationshipOther: string;
  personName: string;
  institution: string;
  department: string;
  personContact: string;
  concerns: string[];
  description: string;
  duration: string;
  priority: string;
  awareness: string;
  agreement: string;
  followUp: string;
  confirmation: boolean;
  website: string;
}

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch]);
}

function requiredReferralText(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== "string") {
    throw new HttpsError("invalid-argument", `Invalid ${field}.`);
  }
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength) {
    throw new HttpsError("invalid-argument", `Invalid ${field}.`);
  }
  return normalized;
}

function optionalReferralText(value: unknown, field: string, maxLength: number): string {
  if (value === undefined || value === null || value === "") return "Not provided";
  return requiredReferralText(value, field, maxLength);
}

function referralChoice(value: unknown, field: string, choices: string[]): string {
  const choice = requiredReferralText(value, field, 120);
  if (!choices.includes(choice)) {
    throw new HttpsError("invalid-argument", `Invalid ${field}.`);
  }
  return choice;
}

function buildStudentReferral(data: WellnessReferral): { subject: string; text: string; html: string } {
  const fields: Array<[string, string]> = [
    ["Referrer name", data.referrerName],
    ["Referrer contact", data.referrerContact],
    ["Referrer's relationship to the person", data.relationship],
    ["Person's role", data.personType === "Other" ? data.personTypeOther : data.personType],
    ["Relationship details", data.relationship === "Other" ? data.relationshipOther : "Not applicable"],
    ["Person's full name", data.personName],
    ["Institution / campus", data.institution],
    ["Department / year of study / designation", data.department],
    ["Person's contact details", data.personContact],
    ["Observed concern(s)", data.concerns.join(", ")],
    ["Brief description", data.description],
    ["How long noticed", data.duration],
    ["Priority", data.priority],
    ["Person aware of referral", data.awareness],
    ["Person agreed to be contacted", data.agreement],
    ["Preferred referrer follow-up", data.followUp],
  ];
  const text = [
    "Confidential wellness support referral",
    "",
    ...fields.map(([label, value]) => `${label}: ${value}`),
  ].join("\n");
  const htmlFields = fields.map(([label, value]) =>
    `<tr><th style="padding:8px;text-align:left;vertical-align:top;border-bottom:1px solid #e2e8f0">${escapeHtml(label)}</th><td style="padding:8px;white-space:pre-wrap;border-bottom:1px solid #e2e8f0">${escapeHtml(value)}</td></tr>`,
  ).join("");
  return {
    subject: "Confidential wellness support referral",
    text,
    html: `<div style="font-family:Arial,Helvetica,sans-serif;color:#0f172a;max-width:720px;margin:0 auto;padding:24px"><h2>Confidential wellness support referral</h2><table style="width:100%;border-collapse:collapse">${htmlFields}</table><p style="margin-top:20px;color:#64748b;font-size:12px">Handle this referral information as confidential.</p></div>`,
  };
}

export const submitStudentReferral = onCall<WellnessReferral>(
  { secrets: [resendApiKey], maxInstances: 3 },
  async (request) => {
    const raw = request.data;
    if (!raw || typeof raw !== "object") {
      throw new HttpsError("invalid-argument", "Referral details are required.");
    }
    if (typeof raw.website === "string" && raw.website.trim()) {
      return { submitted: true };
    }

    const concerns = Array.isArray(raw.concerns) ? raw.concerns : [];
    const validConcerns = concerns.filter(
      (concern): concern is string => typeof concern === "string" && referralConcerns.includes(concern),
    );
    if (concerns.length === 0 || concerns.length > referralConcerns.length || validConcerns.length !== concerns.length) {
      throw new HttpsError("invalid-argument", "Select at least one valid concern.");
    }
    if (raw.confirmation !== true) {
      throw new HttpsError("invalid-argument", "Referral confirmation is required.");
    }

    const relationship = referralChoice(raw.relationship, "relationship", referralRelationships);
    const personType = referralChoice(raw.personType, "person's role", referralPersonTypes);
    const referral: WellnessReferral = {
      referrerName: requiredReferralText(raw.referrerName, "referrer name", 120),
      referrerContact: requiredReferralText(raw.referrerContact, "referrer contact", 80),
      personType,
      personTypeOther: personType === "Other"
        ? requiredReferralText(raw.personTypeOther, "person's role details", 80)
        : "Not applicable",
      relationship,
      relationshipOther: relationship === "Other"
        ? requiredReferralText(raw.relationshipOther, "relationship details", 80)
        : "Not provided",
      personName: requiredReferralText(raw.personName, "person's full name", 120),
      institution: requiredReferralText(raw.institution, "institution", 180),
      department: optionalReferralText(raw.department, "department", 120),
      personContact: requiredReferralText(raw.personContact, "person's contact details", 120),
      concerns: validConcerns,
      description: optionalReferralText(raw.description, "description", 2000),
      duration: referralChoice(raw.duration, "duration", referralDurations),
      priority: referralChoice(raw.priority, "priority", referralPriorities),
      awareness: referralChoice(raw.awareness, "person awareness", referralAwareness),
      agreement: referralChoice(raw.agreement, "student agreement", referralAgreements),
      followUp: referralChoice(raw.followUp, "follow-up method", referralFollowUps),
      confirmation: true,
      website: "",
    };

    const ip = request.rawRequest.ip;
    if (!ip) {
      throw new HttpsError("unavailable", "Unable to securely process the referral. Please contact the Wellness Centre.");
    }
    const rateLimitId = createHash("sha256").update(ip).digest("hex");
    const rateLimitRef = getFirestore().collection("publicReferralRateLimits").doc(rateLimitId);
    const now = Date.now();
    const windowMs = 60 * 60 * 1000;
    const maxSubmissions = 3;
    const allowed = await getFirestore().runTransaction(async (transaction) => {
      const snapshot = await transaction.get(rateLimitRef);
      const startedAt = snapshot.get("startedAt") as number | undefined;
      const count = snapshot.get("count") as number | undefined;
      if (startedAt && now - startedAt < windowMs && (count ?? 0) >= maxSubmissions) return false;
      if (startedAt && now - startedAt < windowMs) {
        transaction.update(rateLimitRef, { count: (count ?? 0) + 1 });
      } else {
        transaction.set(rateLimitRef, { startedAt: now, count: 1 });
      }
      return true;
    });
    if (!allowed) {
      throw new HttpsError("resource-exhausted", "Too many referrals were submitted. Please try again later or contact the Wellness Centre.");
    }

    const { subject, text, html } = buildStudentReferral(referral);
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey.value()}`,
        "Content-Type": "application/json",
        "Idempotency-Key": randomUUID(),
      },
      body: JSON.stringify({
        from: emailFrom.value(),
        to: [referralEmailTo.value()],
        reply_to: emailReplyTo.value(),
        subject,
        text,
        html,
      }),
    });
    if (!response.ok) {
      console.error("Resend rejected wellness referral", response.status, await response.text());
      throw new HttpsError("unavailable", "The referral could not be sent right now. Please try again or contact the Wellness Centre.");
    }
    return { submitted: true };
  },
);

// Crisis SOS campus-staff email alerts live in appointmentEmails.ts
// (emailOnEmergencySosDispatch) — a richer, booking-detail email triggered
// directly off the booking's creation, replacing what used to be a generic
// title/message mirror of the "emergency_sos" notification.

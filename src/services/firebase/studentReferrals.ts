import { FirebaseError } from "firebase/app";
import { httpsCallable } from "firebase/functions";
import { functions } from "./config";

export interface StudentReferralSubmission {
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

export async function submitStudentReferral(referral: StudentReferralSubmission): Promise<void> {
  const submitReferral = httpsCallable<StudentReferralSubmission, { submitted: boolean }>(
    functions,
    "submitStudentReferral",
  );
  const result = await submitReferral(referral);
  if (!result.data.submitted) {
    throw new Error("The referral email was not accepted.");
  }
}

export function studentReferralErrorMessage(error: unknown): string {
  if (error instanceof FirebaseError) {
    if (error.code === "functions/not-found") {
      return "The referral service is not available yet. Please try again later or contact the Wellness Centre.";
    }
    if (error.code === "functions/internal") {
      return "The referral service encountered an internal error. Please try again later or contact the Wellness Centre.";
    }
    if (error.code === "functions/unavailable") {
      return error.message || "The referral service is temporarily unavailable. Please try again later.";
    }
    if (error.code === "functions/resource-exhausted") {
      return error.message || "Too many referrals were submitted. Please try again later.";
    }
    if (error.code.startsWith("functions/")) {
      return error.message;
    }
  }
  return "The referral could not be sent. Please check your connection and try again, or contact the Wellness Centre.";
}

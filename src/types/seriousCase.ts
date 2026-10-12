export type SeriousCaseTargetTier = "principal-vp" | "management-fallback" | "global-fallback";

export interface SeriousCaseEscalationEntry {
  type: "re-notified" | "delay-reason";
  at: number;
  text?: string; // only for "delay-reason"
  byUid?: string;
  byEmail?: string;
}

export interface SeriousCaseActionTaken {
  text: string;
  byUid: string;
  byEmail: string;
  at: number;
}

// One case per booking (doc id === bookingId) — filed by the counsellor/head
// handling a Crisis SOS case, or one they judge a normal session to be
// serious, to escalate it to the right Admin(s) for that student's college.
export interface SeriousCase {
  id: string; // === bookingId
  bookingId: string;
  studentId: string;
  studentEmail: string;
  campusId: string;
  collegeId: string | null; // null if the student profile had none set
  isEmergency: boolean; // which trigger originated this: SOS vs flagged-normal session
  originRole: "counsellor" | "head";
  authorUid: string;
  authorEmail: string;
  note: string;
  notifiedHeadUid?: string; // set only when originRole === "counsellor"; informational, no SLA
  targetAdminUids: string[]; // the admin(s) who own the 24h SLA and can resolve
  targetTier: SeriousCaseTargetTier;
  status: "open" | "resolved";
  actionTaken?: SeriousCaseActionTaken; // presence + status:"resolved" is what stops escalation
  escalations: SeriousCaseEscalationEntry[];
  escalationCount: number;
  lastEscalatedAt: number; // == createdAt initially; bumped by escalateSeriousCases every 24h
  createdAt: number;
  updatedAt: number;
}

export type EventCategory = "main-program" | "group-session";

export type EventPhase = "scheduled" | "completed" | "not-conducted";

export interface EventReschedule {
  type: "postponed" | "preponed";
  previousDate: number;
  note?: string;
}

export interface EventProgram {
  id: string;
  campusId: string;
  collegeId: string;
  calendarYearId: string;
  calendarMonthId: string;
  category: EventCategory;
  sessionYears?: string[]; // which years/audience this targets: "1"-"4" or "faculty"
  title: string;
  description: string;
  targetGroup?: string;
  residenceTarget?: ("hostel" | "dayscholar")[]; // who this is for by residence — both allowed, empty/unset means everyone
  importantDay?: string;
  organizerIds: string[];
  organizerNames: string[];
  eventDate: number;
  attendeeCount: number;
  phase: EventPhase;
  reschedule?: EventReschedule;
  notConductedReason?: string;
  reportUrl?: string;
  reportFileName?: string;
  reportUploadedAt?: number;
  posterUrl?: string;
  posterFileName?: string;
  todayNotifSentOn?: string; // IST date key "YYYY-MM-DD" — dedup guard for the daily "event today" reminder
  createdBy: string;
  createdAt: number;
  updatedAt: number;
}

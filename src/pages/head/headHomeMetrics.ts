import type { Booking, ConcernCategory } from "../../types/booking";
import { CONCERN_CATEGORY_LABELS } from "../../types/booking";
import type { UserProfile } from "../../types/user";
import type { College } from "../../types/college";
import type { EventProgram } from "../../types/event";
import type { CounsellorMonthlyReport } from "../../services/firebase/counsellorMonthlyReports";
import type { SsiCollegeResult } from "../../services/firebase/ssiCollegeResults";
import type { SessionFeedback } from "../../types/feedback";
import { FEEDBACK_FORM } from "../../config/feedbackForm";

export type HomePeriod = "week" | "month" | "semester" | "year";

export const PERIOD_LABELS: Record<HomePeriod, string> = {
  week: "This Week",
  month: "This Month",
  semester: "This Semester",
  year: "Academic Year",
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** Semester is approximated as the last six months, and the academic year as
    running from 1 June — the app has no semester calendar yet. */
export function periodStart(period: HomePeriod, now: Date): number {
  if (period === "week") return now.getTime() - 7 * DAY_MS;
  if (period === "month") return new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  if (period === "semester") return new Date(now.getFullYear(), now.getMonth() - 5, 1).getTime();
  const academicYearStartYear = now.getMonth() >= 5 ? now.getFullYear() : now.getFullYear() - 1;
  return new Date(academicYearStartYear, 5, 1).getTime();
}

const SESSION_STATUSES: Booking["status"][] = ["accepted", "scheduled", "completed"];

function bookingTime(b: Booking): number {
  return b.scheduledAt ?? b.createdAt;
}

function istDateKey(ms: number): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(ms));
  const p = (t: string) => parts.find((x) => x.type === t)?.value ?? "";
  return `${p("year")}-${p("month")}-${p("day")}`;
}

function isSession(b: Booking): boolean {
  return SESSION_STATUSES.includes(b.status);
}

function isMissed(b: Booking): boolean {
  return b.status === "completed" && b.outcome === "missed";
}

function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / previous) * 100);
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}`;
}

export interface CounsellorWorkloadRow {
  uid: string;
  name: string;
  collegeName: string;
  /** All-time accepted/scheduled/completed bookings for this person — not
      scoped to any period, and not meant to equal completed + upcoming +
      pending + missed on its own: it also includes past accepted/scheduled
      bookings that were never closed out (not yet marked completed or
      missed), which don't show up as a single bucket elsewhere. */
  total: number;
  /** Status "completed" with outcome NOT "missed" — a missed booking still
      has status "completed" in the data model, so this explicitly excludes
      those to keep "completed" and "missed" mutually exclusive everywhere. */
  completed: number;
  missed: number;
  upcoming: number;
  pending: number;
  /** All-time bookings for this person flagged isEmergency (Crisis SOS). */
  crisisSos: number;
  workload: "Light" | "Balanced" | "High";
  role?: "counsellor" | "head";
}

export interface InstitutionRow {
  id: string;
  name: string;
  students: number;
  sessions: number;
  utilisation: "High" | "Medium" | "Low" | "—";
}

export interface ReportStatusRow {
  uid: string;
  name: string;
  submitted: boolean;
}

export interface HomeMetrics {
  kpis: {
    students: number;
    sessions: number;
    activeCounsellors: number;
    pendingRequests: number;
    completionPct: number | null;
    institutionsCovered: number;
  };
  centre: {
    studentsChangePct: number | null;
    sessionsChangePct: number | null;
    noShowRatePct: number | null;
    returningStudentsPct: number | null;
    sessionsByMonth: { label: string; count: number }[];
  };
  team: CounsellorWorkloadRow[];
  severity: { healthy: number; mild: number; higher: number; total: number };
  concernCategories: { category: ConcernCategory; label: string; count: number; pct: number }[];
  concernCategoriesTotal: number;
  institutions: InstitutionRow[];
  today: { total: number; completed: number; upcoming: number; pending: number; cancelled: number; noShow: number };
  actions: {
    pendingRequests: number;
    followUpsAwaiting: number;
    highWorkloadCounsellors: number;
    reportsMissingThisMonth: number;
    pendingTransfers: number;
    risingInstitution: { name: string; changePct: number } | null;
  };
  programs: { title: string; collegeName: string; eventDate: number }[];
  feedback: {
    averageRating: number | null;
    ratedCount: number;
    /** % derived from the 1–5 "felt heard" question's average, or null if unanswered so far. */
    feltHeardPct: number | null;
    feltComfortablePct: number | null;
    wouldRecommendPct: number | null;
  };
  reports: ReportStatusRow[];
}

export interface HomeInput {
  bookings: Booking[];
  counsellors: UserProfile[];
  colleges: College[];
  events: EventProgram[];
  reports: CounsellorMonthlyReport[];
  transfers: Booking[];
  ssiResults: SsiCollegeResult[];
  feedbackList: SessionFeedback[];
  period: HomePeriod;
  now: Date;
}

/** Average of a rating question's numeric answers (matched by label), scaled to a 0–100%. */
function ratingAnswerPct(feedbackList: SessionFeedback[], questionId: string): number | null {
  const label = FEEDBACK_FORM.questions.find((q) => q.id === questionId)?.label;
  if (!label) return null;
  const values = feedbackList
    .flatMap((f) => f.answers ?? [])
    .filter((a) => a.label === label)
    .map((a) => Number(a.value))
    .filter((n) => Number.isFinite(n));
  if (values.length === 0) return null;
  const average = values.reduce((sum, n) => sum + n, 0) / values.length;
  return Math.round((average / 5) * 100);
}

export function computeHomeMetrics(input: HomeInput): HomeMetrics {
  const { bookings, counsellors, colleges, events, reports, transfers, ssiResults, feedbackList, period, now } = input;
  const nowMs = now.getTime();
  const startMs = periodStart(period, now);

  const collegeName = new Map(colleges.map((c) => [c.id, c.name]));
  const counsellorById = new Map(counsellors.map((c) => [c.uid, c]));
  const counsellorCollege = (uid: string) => {
    const p = counsellorById.get(uid);
    if (!p) return "Unassigned";
    const cName = p.collegeId ? collegeName.get(p.collegeId) : null;
    if (p.role === "head") {
      return cName ? `${cName} • Campus Head` : "Campus Head";
    }
    return cName ?? "Unassigned";
  };
  const displayName = (p: UserProfile) => p.displayName || p.email;

  const inPeriod = bookings.filter((b) => bookingTime(b) >= startMs);
  const periodSessions = inPeriod.filter(isSession);

  // ── KPIs ───────────────────────────────────────────────────────────
  const periodStudents = new Set(periodSessions.map((b) => b.userId)).size;
  const completed = periodSessions.filter((b) => b.status === "completed").length;
  const scheduledOrAccepted = periodSessions.filter((b) => b.status !== "completed").length;
  const completionPct =
    completed + scheduledOrAccepted > 0 ? Math.round((completed / (completed + scheduledOrAccepted)) * 100) : null;
  const institutionsCovered = new Set(periodSessions.map((b) => counsellorById.get(b.counsellorId)?.collegeId).filter(Boolean)).size;

  // ── Centre performance ──────────────────────────────────────────────
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const sessionsIn = (month: Date) =>
    bookings.filter((b) => isSession(b) && monthKey(new Date(bookingTime(b))) === monthKey(month));
  const studentsIn = (month: Date) => new Set(sessionsIn(month).map((b) => b.userId)).size;
  const sessionsByMonth = Array.from({ length: 6 }, (_, i) => {
    const month = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    return {
      label: month.toLocaleString("en-US", { month: "short" }),
      count: sessionsIn(month).length,
    };
  });
  const allSessions = bookings.filter(isSession);
  const missedCount = allSessions.filter(isMissed).length;
  const completedAll = allSessions.filter((b) => b.status === "completed").length;
  const studentCounts = new Map<string, number>();
  for (const b of allSessions) studentCounts.set(b.userId, (studentCounts.get(b.userId) ?? 0) + 1);
  const returning = [...studentCounts.values()].filter((n) => n > 1).length;

  // ── Team pulse ──────────────────────────────────────────────────────
  const counsellorRows = counsellors
    .filter((p) => p.role === "counsellor" || p.role === "head")
    .map((p): CounsellorWorkloadRow => {
      const mine = bookings.filter((b) => b.counsellorId === p.uid);
      const upcoming = mine.filter((b) => ["accepted", "scheduled"].includes(b.status) && (b.scheduledAt ?? 0) >= nowMs).length;
      const pending = mine.filter((b) => b.status === "pending").length;
      const load = upcoming + pending;
      return {
        uid: p.uid,
        name: displayName(p),
        collegeName: counsellorCollege(p.uid),
        total: mine.filter(isSession).length,
        completed: mine.filter((b) => b.status === "completed" && !isMissed(b)).length,
        missed: mine.filter(isMissed).length,
        upcoming,
        pending,
        crisisSos: mine.filter((b) => b.isEmergency).length,
        workload: load === 0 ? "Light" : load >= 8 ? "High" : "Balanced",
        role: p.role as "counsellor" | "head",
      };
    })
    .sort((a, b) => {
      if (a.role === "head" && b.role !== "head") return -1;
      if (b.role === "head" && a.role !== "head") return 1;
      return a.name.localeCompare(b.name);
    });

  // ── Wellness check-in severity (aggregated, de-identified) ─────────────
  const severityTotal = ssiResults.length;
  const severityCount = (s: SsiCollegeResult["severity"]) => ssiResults.filter((r) => r.severity === s).length;
  const pct = (n: number) => (severityTotal > 0 ? Math.round((n / severityTotal) * 100) : 0);
  const severity = {
    healthy: pct(severityCount("normal")),
    mild: pct(severityCount("medium")),
    higher: pct(severityCount("severe")),
    total: severityTotal,
  };

  // ── What students are coming in with (student-chosen at booking time) ──
  const concernCounts = new Map<ConcernCategory, number>();
  let concernTaggedBookings = 0;
  for (const b of bookings) {
    if (!b.concernCategories?.length) continue;
    concernTaggedBookings += 1;
    for (const c of b.concernCategories) concernCounts.set(c, (concernCounts.get(c) ?? 0) + 1);
  }
  const concernCategories = (Object.keys(CONCERN_CATEGORY_LABELS) as ConcernCategory[])
    .map((category) => {
      const count = concernCounts.get(category) ?? 0;
      return {
        category,
        label: CONCERN_CATEGORY_LABELS[category],
        count,
        pct: concernTaggedBookings > 0 ? Math.round((count / concernTaggedBookings) * 100) : 0,
      };
    })
    .filter((row) => row.count > 0)
    .sort((a, b) => b.count - a.count);

  // ── Institutions ─────────────────────────────────────────────────────
  const instStats = new Map<string, { students: Set<string>; sessions: number }>();
  for (const b of periodSessions) {
    const collegeId = counsellorById.get(b.counsellorId)?.collegeId;
    if (!collegeId) continue;
    const stat = instStats.get(collegeId) ?? { students: new Set<string>(), sessions: 0 };
    stat.students.add(b.userId);
    stat.sessions += 1;
    instStats.set(collegeId, stat);
  }
  const maxSessions = Math.max(0, ...[...instStats.values()].map((s) => s.sessions));
  const institutions: InstitutionRow[] = colleges.map((c) => {
    const stat = instStats.get(c.id);
    const sessions = stat?.sessions ?? 0;
    const utilisation: InstitutionRow["utilisation"] =
      !stat || maxSessions === 0
        ? "—"
        : sessions >= maxSessions * 0.75
          ? "High"
          : sessions >= maxSessions * 0.4
            ? "Medium"
            : "Low";
    return { id: c.id, name: c.name, students: stat?.students.size ?? 0, sessions, utilisation };
  });

  // Request growth per institution this month vs last month.
  const requestsIn = (month: Date) => {
    const counts = new Map<string, number>();
    for (const b of bookings) {
      if (monthKey(new Date(b.createdAt)) !== monthKey(month)) continue;
      const collegeId = counsellorById.get(b.counsellorId)?.collegeId;
      if (collegeId) counts.set(collegeId, (counts.get(collegeId) ?? 0) + 1);
    }
    return counts;
  };
  const thisRequests = requestsIn(thisMonth);
  const lastRequests = requestsIn(lastMonth);
  let risingInstitution: HomeMetrics["actions"]["risingInstitution"] = null;
  for (const [collegeId, count] of thisRequests) {
    const change = percentChange(count, lastRequests.get(collegeId) ?? 0);
    if (change !== null && change > 0 && (!risingInstitution || change > risingInstitution.changePct)) {
      risingInstitution = { name: collegeName.get(collegeId) ?? "Unassigned", changePct: change };
    }
  }

  // ── Today ───────────────────────────────────────────────────────────
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const today = bookings.filter((b) => b.scheduledAt !== undefined && b.scheduledAt >= startOfToday && b.scheduledAt < startOfToday + DAY_MS);
  const todayStats = {
    total: today.length,
    completed: today.filter((b) => b.status === "completed" && b.outcome !== "missed").length,
    upcoming: today.filter((b) => ["accepted", "scheduled"].includes(b.status) && (b.scheduledAt ?? 0) >= nowMs).length,
    pending: today.filter((b) => b.status === "pending").length,
    cancelled: today.filter((b) => b.status === "cancelled").length,
    noShow: today.filter(isMissed).length,
  };

  // ── Action required ──────────────────────────────────────────────────
  const pendingRequests = bookings.filter((b) => b.status === "pending").length;
  const followedUp = new Set(bookings.map((b) => b.followUpOfBookingId).filter(Boolean));
  const followUpsAwaiting = bookings.filter(
    (b) => b.status === "completed" && b.outcome === "followup" && !followedUp.has(b.id),
  ).length;
  const highWorkloadCounsellors = counsellorRows.filter((r) => r.workload === "High").length;
  const reportsThisMonth = reports.filter(
    (r) => r.month === now.getMonth() + 1 && r.year === now.getFullYear(),
  );
  const submittedUids = new Set(reportsThisMonth.map((r) => r.uploadedByUid));
  const reportRows: ReportStatusRow[] = counsellors
    .filter((p) => p.role === "counsellor")
    .map((p) => ({ uid: p.uid, name: displayName(p), submitted: submittedUids.has(p.uid) }));
  const reportsMissingThisMonth = reportRows.filter((r) => !r.submitted).length;

  // ── Programs ─────────────────────────────────────────────────────────
  // Compared by IST calendar day, not exact timestamp — otherwise a today's
  // event with a morning time slot would drop off this list the moment that
  // time passed, even though it's still today.
  const todayKey = istDateKey(nowMs);
  const programs = events
    .filter((e) => e.phase === "scheduled" && istDateKey(e.eventDate) >= todayKey)
    .sort((a, b) => a.eventDate - b.eventDate)
    .slice(0, 4)
    .map((e) => ({ title: e.title, collegeName: collegeName.get(e.collegeId) ?? "Unassigned", eventDate: e.eventDate }));

  // ── Feedback ─────────────────────────────────────────────────────────
  const ratings = feedbackList.map((f) => f.rating).filter((r): r is number => typeof r === "number");
  const averageRating = ratings.length > 0 ? Math.round((ratings.reduce((s, r) => s + r, 0) / ratings.length) * 10) / 10 : null;
  const feltHeardPct = ratingAnswerPct(feedbackList, "felt-heard");
  const feltComfortablePct = ratingAnswerPct(feedbackList, "felt-comfortable");
  const wouldRecommendPct = ratingAnswerPct(feedbackList, "recommend");

  return {
    kpis: {
      students: periodStudents,
      sessions: periodSessions.length,
      activeCounsellors: counsellors.filter((p) => p.role === "counsellor" && p.available).length,
      pendingRequests,
      completionPct,
      institutionsCovered,
    },
    centre: {
      studentsChangePct: percentChange(studentsIn(thisMonth), studentsIn(lastMonth)),
      sessionsChangePct: percentChange(sessionsIn(thisMonth).length, sessionsIn(lastMonth).length),
      noShowRatePct: completedAll > 0 ? Math.round((missedCount / completedAll) * 100) : null,
      returningStudentsPct: studentCounts.size > 0 ? Math.round((returning / studentCounts.size) * 100) : null,
      sessionsByMonth,
    },
    team: counsellorRows,
    severity,
    concernCategories,
    concernCategoriesTotal: concernTaggedBookings,
    institutions,
    today: todayStats,
    actions: {
      pendingRequests,
      followUpsAwaiting,
      highWorkloadCounsellors,
      reportsMissingThisMonth,
      pendingTransfers: transfers.length,
      risingInstitution,
    },
    programs,
    feedback: { averageRating, ratedCount: ratings.length, feltHeardPct, feltComfortablePct, wouldRecommendPct },
    reports: reportRows,
  };
}

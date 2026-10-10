import type { SsiCollegeResult } from "../services/firebase/ssiCollegeResults";
import { periodLabel, periodStart } from "../pages/head/headHomeMetrics";
import { toIsoDate } from "./dateFormat";

export type SsiAnalyticsPeriod = "today" | "week" | "month" | "all";

export const SSI_ANALYTICS_PERIODS: SsiAnalyticsPeriod[] = ["today", "week", "month", "all"];

/** "Today" / "2nd Week Oct" / "October" / "All Time" — reuses the same
    calendar-grounded week/month labels already established by the Head's
    Home dashboard (headHomeMetrics.ts), so "week"/"month" mean the same
    thing everywhere in this app. */
export function ssiAnalyticsPeriodLabel(period: SsiAnalyticsPeriod, now: Date): string {
  if (period === "today") return "Today";
  if (period === "all") return "All Time";
  return periodLabel(period, now);
}

export function filterSsiResultsByPeriod(
  results: SsiCollegeResult[],
  period: SsiAnalyticsPeriod,
  now: Date,
): SsiCollegeResult[] {
  if (period === "all") return results;
  if (period === "today") {
    const todayKey = toIsoDate(now);
    return results.filter((r) => toIsoDate(new Date(r.submittedAt)) === todayKey);
  }
  const start = periodStart(period, now);
  return results.filter((r) => r.submittedAt >= start);
}

export interface SsiAnalyticsSummary {
  total: number;
  normal: number;
  medium: number;
  severe: number;
  /** medium + severe — the check-ins that warrant a follow-up. */
  actionNeeded: number;
  /** Of actionNeeded, how many have been marked as followed up on. */
  actionTaken: number;
}

export function computeSsiAnalyticsSummary(results: SsiCollegeResult[]): SsiAnalyticsSummary {
  const normal = results.filter((r) => r.severity === "normal").length;
  const medium = results.filter((r) => r.severity === "medium").length;
  const severe = results.filter((r) => r.severity === "severe").length;
  const actionTaken = results.filter((r) => r.severity !== "normal" && r.actionTaken).length;
  return {
    total: results.length,
    normal,
    medium,
    severe,
    actionNeeded: medium + severe,
    actionTaken,
  };
}

import { listBookingsForCounsellor } from "../services/firebase/bookings";

// Same IST-date-key + week-of-month convention already used by
// SessionReportsSection.tsx, so these numbers line up with what that
// screen already shows for the same person/month.
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

function getWeekOfMonth(day: number): number {
  if (day <= 7) return 0;
  if (day <= 14) return 1;
  if (day <= 21) return 2;
  if (day <= 28) return 3;
  return 4;
}

export interface WeekSessionRow {
  label: string; // "Week 1"
  dateRangeLabel: string; // "01-08-2026 to 07-08-2026"
  sessions: number;
}

export interface MonthlySessionData {
  weeks: WeekSessionRow[];
  total: number;
}

function formatDMY(year: number, monthIdx: number, day: number): string {
  return `${String(day).padStart(2, "0")}-${String(monthIdx + 1).padStart(2, "0")}-${year}`;
}

export async function gatherMonthlySessionData(uid: string, year: number, monthIdx: number): Promise<MonthlySessionData> {
  const bookings = await listBookingsForCounsellor(uid);
  const monthStartKey = `${year}-${String(monthIdx + 1).padStart(2, "0")}-01`;
  const lastDay = new Date(year, monthIdx + 1, 0).getDate();
  const monthEndKey = `${year}-${String(monthIdx + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  const weekCounts = [0, 0, 0, 0, 0];
  for (const b of bookings) {
    if (b.status !== "completed" || b.outcome === "missed") continue;
    const key = istDateKey(b.createdAt);
    if (key < monthStartKey || key > monthEndKey) continue;
    const day = Number(key.split("-")[2]);
    weekCounts[getWeekOfMonth(day)] += 1;
  }

  const starts = [1, 8, 15, 22, 29];
  const weeks: WeekSessionRow[] = starts
    .map((start, i) => {
      const end = i === 4 ? lastDay : start + 6;
      if (start > lastDay) return null;
      return {
        label: `Week ${i + 1}`,
        dateRangeLabel: `${formatDMY(year, monthIdx, start)} to ${formatDMY(year, monthIdx, Math.min(end, lastDay))}`,
        sessions: weekCounts[i],
      };
    })
    .filter((w): w is WeekSessionRow => w !== null);

  return { weeks, total: weekCounts.reduce((a, b) => a + b, 0) };
}

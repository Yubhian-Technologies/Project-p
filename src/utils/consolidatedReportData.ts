import { listCampusLogins } from "../services/firebase/firestore";
import { listColleges } from "../services/firebase/colleges";
import { listBookingsForCounsellor } from "../services/firebase/bookings";
import { listEventsForCampus } from "../services/firebase/events";

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

export interface InstitutionSessionRow {
  collegeId: string;
  collegeName: string;
  counsellorNames: string[];
  sessions: number;
}

export interface ConsolidatedReportData {
  institutions: InstitutionSessionRow[];
  totalSessions: number;
  institutionsCovered: number;
  groupSessionsCount: number;
}

// Every counsellor/head on the campus, each one's own sessions-taken count
// for the month (same predicate as the Monthly Report), grouped by college —
// computed fresh from `bookings` each time, not read from anyone's
// already-generated report (nothing is persisted anywhere in this feature).
export async function gatherConsolidatedReportData(
  campusId: string,
  year: number,
  monthIdx: number,
): Promise<ConsolidatedReportData> {
  const monthStartKey = `${year}-${String(monthIdx + 1).padStart(2, "0")}-01`;
  const lastDay = new Date(year, monthIdx + 1, 0).getDate();
  const monthEndKey = `${year}-${String(monthIdx + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  const [staff, colleges, events] = await Promise.all([
    listCampusLogins(campusId),
    listColleges(campusId),
    listEventsForCampus(campusId),
  ]);
  const collegeName = (id?: string) => colleges.find((c) => c.id === id)?.name ?? "Unassigned";

  const rowsByCollege = new Map<string, InstitutionSessionRow>();
  for (const college of colleges) {
    rowsByCollege.set(college.id, { collegeId: college.id, collegeName: college.name, counsellorNames: [], sessions: 0 });
  }

  let totalSessions = 0;
  await Promise.all(
    staff.map(async (person) => {
      const bookings = await listBookingsForCounsellor(person.uid);
      let count = 0;
      for (const b of bookings) {
        if (b.status !== "completed" || b.outcome === "missed") continue;
        const key = istDateKey(b.createdAt);
        if (key < monthStartKey || key > monthEndKey) continue;
        count += 1;
      }
      if (count === 0) return;
      totalSessions += count;
      const collegeId = person.collegeId ?? "unassigned";
      const existing = rowsByCollege.get(collegeId) ?? {
        collegeId,
        collegeName: collegeName(person.collegeId),
        counsellorNames: [],
        sessions: 0,
      };
      existing.counsellorNames.push(person.displayName || person.email);
      existing.sessions += count;
      rowsByCollege.set(collegeId, existing);
    }),
  );

  const institutions = Array.from(rowsByCollege.values())
    .filter((row) => row.sessions > 0 || staff.some((p) => p.collegeId === row.collegeId))
    .sort((a, b) => b.sessions - a.sessions);

  const groupSessionsCount = events.filter((e) => {
    if (e.category !== "group-session" || e.phase !== "completed") return false;
    const key = istDateKey(e.eventDate);
    return key >= monthStartKey && key <= monthEndKey;
  }).length;

  return {
    institutions,
    totalSessions,
    institutionsCovered: new Set(staff.map((p) => p.collegeId).filter(Boolean)).size,
    groupSessionsCount,
  };
}

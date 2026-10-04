import type { Booking } from "../../types/booking";
import type { EventProgram } from "../../types/event";
import type { UserProfile } from "../../types/user";
import type { WorkloadRow } from "../../types/workloadSheet";

export interface CampusPerson {
  uid: string;
  name: string;
  role: UserProfile["role"];
}

export interface CampusWorkloadInput {
  now: Date;
  events: EventProgram[];
  bookings: Booking[];
  people: CampusPerson[];
  rowsByOwner: Record<string, WorkloadRow[]>;
}

export interface CampusWorkloadAnalytics {
  events: {
    total: number;
    scheduled: number;
    completed: number;
    notConducted: number;
    upcoming: number;
    past: number;
    completionPct: number | null;
  };
  sessions: {
    booked: number;
    completed: number;
    missed: number;
    completionPct: number | null;
  };
  counsellorWorkload: {
    uid: string;
    name: string;
    upcoming: number;
    pending: number;
    label: "Light" | "Balanced" | "High";
  }[];
  sheets: {
    people: {
      uid: string;
      name: string;
      rows: number;
      donePct: number | null;
      attendance: number;
      feedbackYesPct: number | null;
    }[];
    totalRows: number;
    donePct: number | null;
    totalAttendance: number;
    feedbackYesPct: number | null;
  };
}

const SESSION_STATUSES: Booking["status"][] = ["accepted", "scheduled", "completed"];

function pct(part: number, whole: number): number | null {
  return whole > 0 ? Math.round((part / whole) * 100) : null;
}

/** Pure aggregation over one campus's events, bookings, and workload sheets.
    Mirrors the session definitions used by the Head home (headHomeMetrics.ts). */
export function computeCampusWorkloadAnalytics(input: CampusWorkloadInput): CampusWorkloadAnalytics {
  const { now, events, bookings, people, rowsByOwner } = input;
  const nowMs = now.getTime();

  // Events & programs
  const eventCount = (phase: EventProgram["phase"]) => events.filter((e) => e.phase === phase).length;
  const pastEvents = events.filter((e) => e.eventDate < nowMs);
  const completedEvents = eventCount("completed");
  const eventsBlock = {
    total: events.length,
    scheduled: eventCount("scheduled"),
    completed: completedEvents,
    notConducted: eventCount("not-conducted"),
    upcoming: events.filter((e) => e.eventDate >= nowMs && e.phase === "scheduled").length,
    past: pastEvents.length,
    completionPct: pct(completedEvents, pastEvents.length),
  };

  // Sessions
  const sessions = bookings.filter((b) => SESSION_STATUSES.includes(b.status));
  const completedSessions = sessions.filter((b) => b.status === "completed").length;
  const missedSessions = sessions.filter((b) => b.status === "completed" && b.outcome === "missed").length;
  const sessionsBlock = {
    booked: sessions.length,
    completed: completedSessions,
    missed: missedSessions,
    completionPct: pct(completedSessions, sessions.length),
  };

  // Counsellor workload
  const counsellorWorkload = people
    .filter((p) => p.role === "counsellor")
    .map((p) => {
      const mine = bookings.filter((b) => b.counsellorId === p.uid);
      const upcoming = mine.filter((b) => ["accepted", "scheduled"].includes(b.status) && (b.scheduledAt ?? 0) >= nowMs).length;
      const pending = mine.filter((b) => b.status === "pending").length;
      const load = upcoming + pending;
      return {
        uid: p.uid,
        name: p.name,
        upcoming,
        pending,
        label: load === 0 ? ("Light" as const) : load >= 8 ? ("High" as const) : ("Balanced" as const),
      };
    });

  // Workload sheets
  const perPerson = people.map((p) => {
    const rows = rowsByOwner[p.uid] ?? [];
    const done = rows.filter((r) => r.status === "done").length;
    const answered = rows.filter((r) => r.feedback).length;
    const yes = rows.filter((r) => r.feedback === "yes").length;
    return {
      summary: {
        uid: p.uid,
        name: p.name,
        rows: rows.length,
        donePct: pct(done, rows.length),
        attendance: rows.reduce((sum, r) => sum + (r.attendance ?? 0), 0),
        feedbackYesPct: pct(yes, answered),
      },
      done,
      answered,
      yes,
    };
  });
  const sheetPeople = perPerson.map((x) => x.summary);
  const allRows = sheetPeople.reduce((sum, p) => sum + p.rows, 0);
  const allDone = perPerson.reduce((sum, x) => sum + x.done, 0);
  const allAnswered = perPerson.reduce((sum, x) => sum + x.answered, 0);
  const allYes = perPerson.reduce((sum, x) => sum + x.yes, 0);

  return {
    events: eventsBlock,
    sessions: sessionsBlock,
    counsellorWorkload,
    sheets: {
      people: sheetPeople,
      totalRows: allRows,
      donePct: pct(allDone, allRows),
      totalAttendance: sheetPeople.reduce((sum, p) => sum + p.attendance, 0),
      feedbackYesPct: pct(allYes, allAnswered),
    },
  };
}

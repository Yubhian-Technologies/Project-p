import { listAllBookingsForStats } from "../services/firebase/bookings";
import { listCampuses } from "../services/firebase/campuses";
import { listColleges } from "../services/firebase/colleges";
import { listEventsForCampus } from "../services/firebase/events";
import { listCampusLogins } from "../services/firebase/firestore";

function istDateKey(ms: number): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(ms));
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export interface StaffActivityRow {
  uid: string;
  name: string;
  role: "counsellor" | "head";
  collegeId: string | null;
  collegeName: string;
  individualSessions: number;
  followUpSessions: number;
  crisisSosCases: number;
  totalSessions: number;
  eventsAndPrograms: number;
  groupSessions: number;
}

export interface CampusActivitySummary {
  individualSessions: number;
  followUpSessions: number;
  crisisSosCases: number;
  totalSessions: number;
  eventsAndPrograms: number;
  groupSessions: number;
  staffCount: number;
  collegesCovered: number;
}

export interface ConsolidatedReportData {
  campusName: string;
  campus: CampusActivitySummary;
  staffRows: StaffActivityRow[];
}

export async function gatherConsolidatedReportData(
  campusId: string,
  year: number,
  monthIdx: number,
): Promise<ConsolidatedReportData> {
  const monthStartKey = `${year}-${String(monthIdx + 1).padStart(2, "0")}-01`;
  const lastDay = new Date(year, monthIdx + 1, 0).getDate();
  const monthEndKey = `${year}-${String(monthIdx + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  const isInMonth = (timestamp: number) => {
    const key = istDateKey(timestamp);
    return key >= monthStartKey && key <= monthEndKey;
  };

  const [staff, colleges, events, campuses] = await Promise.all([
    listCampusLogins(campusId),
    listColleges(campusId),
    listEventsForCampus(campusId),
    listCampuses(),
  ]);
  const staffUids = staff.map((person) => person.uid);
  const bookings = await listAllBookingsForStats(campusId, staffUids);
  const staffByUid = new Map(staff.map((person) => [person.uid, person]));
  const collegeNames = new Map(colleges.map((college) => [college.id, college.name]));

  const rowsByUid = new Map<string, StaffActivityRow>(
    staff.map((person) => {
      const collegeId = person.collegeId ?? null;
      return [
        person.uid,
        {
          uid: person.uid,
          name: person.displayName || person.email,
          role: person.role === "head" ? "head" : "counsellor",
          collegeId,
          collegeName: collegeId ? collegeNames.get(collegeId) ?? "Unknown college" : "College not assigned",
          individualSessions: 0,
          followUpSessions: 0,
          crisisSosCases: 0,
          totalSessions: 0,
          eventsAndPrograms: 0,
          groupSessions: 0,
        },
      ];
    }),
  );

  for (const booking of bookings) {
    const owner = rowsByUid.get(booking.counsellorId);
    if (!owner) continue;

    if (booking.isEmergency) {
      if (isInMonth(booking.createdAt)) owner.crisisSosCases += 1;
      continue;
    }

    const sessionDate = booking.scheduledAt ?? booking.createdAt;
    if (
      booking.status !== "completed" ||
      booking.outcome === "missed" ||
      !isInMonth(sessionDate)
    ) {
      continue;
    }

    if (booking.followUpOfBookingId) owner.followUpSessions += 1;
    else owner.individualSessions += 1;
  }

  let eventsAndPrograms = 0;
  let groupSessions = 0;
  for (const event of events) {
    if (event.phase !== "completed" || !isInMonth(event.eventDate)) continue;
    if (event.category === "main-program") eventsAndPrograms += 1;
    if (event.category === "group-session") groupSessions += 1;

    for (const organizerUid of event.organizerIds) {
      const organizer = staffByUid.get(organizerUid);
      const row = rowsByUid.get(organizerUid);
      if (!organizer || !row) continue;
      if (event.category === "main-program") row.eventsAndPrograms += 1;
      if (event.category === "group-session") row.groupSessions += 1;
    }
  }

  const staffRows = Array.from(rowsByUid.values())
    .map((row) => ({
      ...row,
      totalSessions: row.individualSessions + row.followUpSessions + row.crisisSosCases,
    }))
    .sort((a, b) =>
      a.collegeName.localeCompare(b.collegeName) || a.name.localeCompare(b.name),
    );
  const campusMonthBookings = bookings.filter((booking) => {
    if (booking.isEmergency) return isInMonth(booking.createdAt);
    return (
      booking.status === "completed" &&
      booking.outcome !== "missed" &&
      isInMonth(booking.scheduledAt ?? booking.createdAt)
    );
  });
  const individualSessions = campusMonthBookings.filter(
    (booking) => !booking.isEmergency && !booking.followUpOfBookingId,
  ).length;
  const followUpSessions = campusMonthBookings.filter(
    (booking) => !booking.isEmergency && Boolean(booking.followUpOfBookingId),
  ).length;
  const crisisSosCases = campusMonthBookings.filter((booking) => booking.isEmergency).length;
  const totalSessions = individualSessions + followUpSessions + crisisSosCases;

  return {
    campusName: campuses.find((campus) => campus.id === campusId)?.name ?? "Campus",
    campus: {
      individualSessions,
      followUpSessions,
      crisisSosCases,
      totalSessions,
      eventsAndPrograms,
      groupSessions,
      staffCount: staff.length,
      collegesCovered: new Set(staff.map((person) => person.collegeId).filter(Boolean)).size,
    },
    staffRows,
  };
}

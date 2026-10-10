import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, query, updateDoc, where } from "firebase/firestore";
import { db } from "./config";
import type { EventProgram } from "../../types/event";
import { createNotification } from "./notifications";
import { listUsersByRole, listCampusLogins } from "./firestore";

const eventsCollection = collection(db, "events");

// Same IST-date-key convention used throughout this app (e.g.
// SessionReportsSection.tsx) — "today" is always computed in IST.
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

function isTodayIST(ms: number): boolean {
  return istDateKey(ms) === istDateKey(Date.now());
}

function toEvent(id: string, data: Record<string, unknown>): EventProgram {
  return { id, ...data } as EventProgram;
}

export async function listEventsForCampus(campusId: string): Promise<EventProgram[]> {
  const q = query(eventsCollection, where("campusId", "==", campusId));
  const snapshot = await getDocs(q);
  return snapshot.docs
    .map((d) => toEvent(d.id, d.data()))
    .sort((a, b) => b.eventDate - a.eventDate);
}

export async function listEventsForCollege(collegeId: string): Promise<EventProgram[]> {
  const q = query(eventsCollection, where("collegeId", "==", collegeId));
  const snapshot = await getDocs(q);
  return snapshot.docs
    .map((d) => toEvent(d.id, d.data()))
    .sort((a, b) => b.eventDate - a.eventDate);
}

export async function createEvent(
  input: Omit<EventProgram, "id" | "createdAt" | "updatedAt">,
): Promise<string> {
  const now = Date.now();
  const docRef = await addDoc(eventsCollection, { ...input, createdAt: now, updatedAt: now });

  // Platform-level alert for admins whenever a campus schedules a new event —
  // skip a campus-restricted admin whose adminAccess doesn't cover this
  // campus; a legacy/global admin (no adminAccess, or scope "global") always
  // gets it, same as before this restriction existed.
  const campusName = await getCampusName(input.campusId);
  const allAdmins = await listUsersByRole("admin");
  const admins = allAdmins.filter(
    (admin) =>
      !admin.adminAccess ||
      admin.adminAccess.scope === "global" ||
      (admin.adminAccess.campusIds ?? []).includes(input.campusId),
  );
  const campusLabel = campusName ? `${campusName} campus` : "A campus";
  await Promise.all(
    admins.map((admin) =>
      createNotification({
        recipientId: admin.uid,
        type: "event_added",
        title: "New event scheduled",
        message: `${campusLabel} has a new event: ${input.title} (${
          input.category === "group-session" ? "Group Session" : "Events & Programs"
        }).`,
      }),
    ),
  );

  // The scheduled sendEventTodayReminders Cloud Function only runs once a
  // day at 7 AM IST — an event created for today *after* that already ran
  // would otherwise never notify anyone, since tomorrow's run no longer
  // covers today's date. This covers that gap immediately at creation time;
  // the scheduled function still handles events whose day arrives later.
  if (isTodayIST(input.eventDate)) {
    const [students, staff] = await Promise.all([
      listUsersByRole("user"),
      listCampusLogins(input.campusId),
    ]);
    const recipientUids = [
      ...students.filter((u) => u.campusId === input.campusId).map((u) => u.uid),
      ...staff.map((u) => u.uid),
    ];
    await Promise.all(
      recipientUids.map((uid) =>
        createNotification({
          recipientId: uid,
          type: "event_today",
          title: "Event today",
          message: `${input.title} is happening today on your campus.`,
        }),
      ),
    );
  }

  return docRef.id;
}

export async function updateEvent(
  id: string,
  updates: Partial<
    Pick<
      EventProgram,
      | "title"
      | "description"
      | "category"
      | "sessionYears"
      | "targetGroup"
      | "residenceTarget"
      | "importantDay"
      | "organizerIds"
      | "organizerNames"
      | "eventDate"
      | "attendeeCount"
      | "phase"
      | "reschedule"
      | "notConductedReason"
      | "reportUrl"
      | "reportFileName"
      | "reportUploadedAt"
      | "posterUrl"
      | "posterFileName"
      | "todayNotifSentOn"
    >
  >,
): Promise<void> {
  await updateDoc(doc(db, "events", id), { ...updates, updatedAt: Date.now() });
}

export async function deleteEvent(id: string): Promise<void> {
  await deleteDoc(doc(db, "events", id));
}

async function getCampusName(campusId: string): Promise<string> {
  try {
    const snap = await getDoc(doc(db, "campuses", campusId));
    return (snap.data() as { name?: string } | undefined)?.name ?? "";
  } catch {
    return "";
  }
}

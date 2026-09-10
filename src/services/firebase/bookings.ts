import {
  addDoc,
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "./config";
import type { UserProfile } from "../../types/user";
import type { Booking, BookingIntake, BookingOutcome } from "../../types/booking";
import { createNotification } from "./notifications";
import type { OfflineSessionRow } from "../../utils/offlineSessionImport";
import { clientDisplayLabel, syntheticClientId } from "../../utils/offlineSessionImport";

export const SESSION_DURATION_MINUTES = 90;
export const SESSION_DURATION_LABEL = `${Math.floor(SESSION_DURATION_MINUTES / 60)}h ${SESSION_DURATION_MINUTES % 60}m`;

const bookingsCollection = collection(db, "bookings");

function intakeDocRef(bookingId: string) {
  return doc(db, "bookings", bookingId, "private", "details");
}

export async function listBookableProfiles(): Promise<UserProfile[]> {
  const q = query(collection(db, "users"), where("role", "in", ["counsellor", "head"]));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => d.data() as UserProfile);
}

export async function createBooking(
  user: { uid: string; email: string },
  counsellor: { uid: string; email: string },
  intake: BookingIntake,
  proposedSlots: [number, number],
  campusId?: string,
): Promise<string> {
  const now = Date.now();
  const docRef = await addDoc(bookingsCollection, {
    userId: user.uid,
    userEmail: user.email,
    counsellorId: counsellor.uid,
    counsellorEmail: counsellor.email,
    status: "pending",
    durationMinutes: SESSION_DURATION_MINUTES,
    proposedSlots,
    ...(campusId ? { campusId } : {}),
    createdAt: now,
    updatedAt: now,
  });
  await setDoc(intakeDocRef(docRef.id), intake);
  await createNotification({
    recipientId: counsellor.uid,
    type: "booking_requested",
    bookingId: docRef.id,
    title: "New session request",
    message: `${user.email} requested a session with you`,
  });
  return docRef.id;
}

/**
 * Crisis SOS: creates an emergency booking with no intake form required, and
 * notifies every Head and Counsellor on the student's own campus immediately
 * — not just one. There is no on-call schedule in this app's data model, so
 * the *assigned* target (who the booking is formally addressed to, for the
 * normal accept/schedule flow) is still a best-effort pick — the user's most
 * recent counsellor if they have one, otherwise the first available
 * counsellor on their campus — but everyone else on campus is also alerted
 * so nobody has to rely on exactly one person seeing it in time.
 */
export async function createEmergencySosBooking(
  user: { uid: string; email: string },
  profile: {
    displayName?: string;
    whatsappNumber?: string;
    studentOrProfessional?: "student" | "professional";
    campusId?: string;
  },
): Promise<string> {
  if (!profile.campusId) {
    throw new Error("Your account isn't assigned to a campus yet — contact a Super Admin.");
  }

  const [priorBookings, allBookableProfiles] = await Promise.all([
    listBookingsForUser(user.uid),
    listBookableProfiles(),
  ]);
  const campusStaff = allBookableProfiles.filter((p) => p.campusId === profile.campusId);
  if (campusStaff.length === 0) {
    throw new Error("No head or counsellor is set up on your campus yet to receive an emergency request.");
  }

  const priorCounsellor = priorBookings
    .map((b) => campusStaff.find((p) => p.uid === b.counsellorId))
    .find((p) => p !== undefined);
  const availableCounsellor = campusStaff.find((p) => p.role === "counsellor" && p.available);
  const target = priorCounsellor ?? availableCounsellor ?? campusStaff[0];

  const now = Date.now();
  const docRef = await addDoc(bookingsCollection, {
    userId: user.uid,
    userEmail: user.email,
    counsellorId: target.uid,
    counsellorEmail: target.email,
    status: "pending",
    durationMinutes: SESSION_DURATION_MINUTES,
    isEmergency: true,
    campusId: profile.campusId,
    createdAt: now,
    updatedAt: now,
  });
  await setDoc(intakeDocRef(docRef.id), {
    username: profile.displayName || user.email,
    occupation: profile.studentOrProfessional ?? "student",
    whatsappNumber: profile.whatsappNumber ?? "",
    issue: "Crisis SOS — immediate assistance requested.",
  });

  const message = `${user.email} has dispatched an emergency SOS and needs immediate attention.`;
  await Promise.all(
    campusStaff.map((staff) =>
      createNotification({
        recipientId: staff.uid,
        type: "emergency_sos",
        bookingId: docRef.id,
        title: "Emergency SOS",
        message,
      }),
    ),
  );
  return docRef.id;
}

export async function listEmergencyBookingsForCampus(campusId: string): Promise<Booking[]> {
  const q = query(bookingsCollection, where("campusId", "==", campusId), where("isEmergency", "==", true));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => toBooking(d.id, d.data())).sort((a, b) => b.createdAt - a.createdAt);
}

/**
 * Claims a still-pending emergency SOS booking for the claiming Head/Counsellor,
 * reassigning it to them and accepting it in one step. Unlike the normal
 * acceptBooking flow (which only the already-assigned party can use), this lets
 * ANY Head/Counsellor on the same campus respond first — in a crisis, speed
 * matters more than the original best-guess assignment.
 */
export async function claimEmergencyBooking(booking: Booking, staff: { uid: string; email: string }): Promise<void> {
  await updateDoc(doc(db, "bookings", booking.id), {
    counsellorId: staff.uid,
    counsellorEmail: staff.email,
    status: "accepted",
    updatedAt: Date.now(),
  });
  await createNotification({
    recipientId: booking.userId,
    type: "booking_accepted",
    bookingId: booking.id,
    title: "Request accepted",
    message: `${staff.email} accepted your session request`,
  });
}

export async function getBookingIntake(bookingId: string): Promise<BookingIntake | null> {
  const snapshot = await getDoc(intakeDocRef(bookingId));
  return snapshot.exists() ? (snapshot.data() as BookingIntake) : null;
}

export async function getBooking(id: string): Promise<Booking | null> {
  const snapshot = await getDoc(doc(db, "bookings", id));
  return snapshot.exists() ? toBooking(snapshot.id, snapshot.data()) : null;
}

export async function getFollowUpHistory(
  bookingId: string,
): Promise<{ scheduledAt?: number; summary?: string }[]> {
  const history: { scheduledAt?: number; summary?: string }[] = [];
  let current = await getBooking(bookingId);
  while (current?.followUpOfBookingId) {
    const parent = await getBooking(current.followUpOfBookingId);
    if (!parent) break;
    const intake = await getBookingIntake(parent.id);
    history.push({ scheduledAt: parent.scheduledAt, summary: intake?.summary });
    current = parent;
  }
  return history;
}

export async function saveSessionSummary(bookingId: string, summary: string): Promise<void> {
  await setDoc(intakeDocRef(bookingId), { summary }, { merge: true });
}

function toBooking(id: string, data: Record<string, unknown>): Booking {
  return { id, ...data } as Booking;
}

export async function listBookingsForUser(userId: string): Promise<Booking[]> {
  const q = query(bookingsCollection, where("userId", "==", userId));
  const snapshot = await getDocs(q);
  return snapshot.docs
    .map((d) => toBooking(d.id, d.data()))
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function listBookingsForCounsellor(counsellorId: string): Promise<Booking[]> {
  const q = query(bookingsCollection, where("counsellorId", "==", counsellorId));
  const snapshot = await getDocs(q);
  return snapshot.docs
    .map((d) => toBooking(d.id, d.data()))
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function listAllBookingsForStats(): Promise<Booking[]> {
  const snapshot = await getDocs(bookingsCollection);
  return snapshot.docs.map((d) => toBooking(d.id, d.data()));
}

export async function listScheduledBookings(): Promise<Booking[]> {
  const q = query(bookingsCollection, where("status", "==", "scheduled"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => toBooking(d.id, d.data()));
}

export async function acceptBooking(booking: Booking): Promise<void> {
  await updateDoc(doc(db, "bookings", booking.id), { status: "accepted", updatedAt: Date.now() });
  await createNotification({
    recipientId: booking.userId,
    type: "booking_accepted",
    bookingId: booking.id,
    title: "Request accepted",
    message: `${booking.counsellorEmail} accepted your session request`,
  });
}

export async function rejectBooking(booking: Booking): Promise<void> {
  await updateDoc(doc(db, "bookings", booking.id), { status: "rejected", updatedAt: Date.now() });
  await createNotification({
    recipientId: booking.userId,
    type: "booking_rejected",
    bookingId: booking.id,
    title: "Request rejected",
    message: `${booking.counsellorEmail} rejected your session request`,
  });
}

export async function scheduleBooking(booking: Booking, scheduledAt: number): Promise<void> {
  await updateDoc(doc(db, "bookings", booking.id), {
    status: "scheduled",
    scheduledAt,
    updatedAt: Date.now(),
  });
  await createNotification({
    recipientId: booking.userId,
    type: "booking_scheduled",
    bookingId: booking.id,
    title: "Session scheduled",
    message: `Your session with ${booking.counsellorEmail} is scheduled for ${new Date(scheduledAt).toLocaleString()}`,
  });
}

/** Counsellor accepting one of the two time slots the student proposed at request time. */
export async function acceptProposedSlot(booking: Booking, chosenAt: number): Promise<void> {
  await updateDoc(doc(db, "bookings", booking.id), {
    status: "scheduled",
    scheduledAt: chosenAt,
    updatedAt: Date.now(),
  });
  await createNotification({
    recipientId: booking.userId,
    type: "booking_scheduled",
    bookingId: booking.id,
    title: "Session scheduled",
    message: `Your session with ${booking.counsellorEmail} is scheduled for ${new Date(chosenAt).toLocaleString()}`,
  });
}

/**
 * Either party proposing a new time for an already-scheduled session. Neither
 * side can silently overwrite a confirmed time — the other party must Accept
 * or counter-propose via this same function (with proposedBy flipped).
 */
export async function requestReschedule(
  booking: Booking,
  proposedBy: "user" | "counsellor",
  proposedAt: number,
  reason?: string,
): Promise<void> {
  const now = Date.now();
  await updateDoc(doc(db, "bookings", booking.id), {
    rescheduleProposal: {
      proposedBy,
      proposedAt,
      createdAt: now,
      ...(reason ? { reason } : {}),
    },
    updatedAt: now,
  });
  const recipientId = proposedBy === "user" ? booking.counsellorId : booking.userId;
  const proposerLabel = proposedBy === "user" ? booking.userEmail : booking.counsellorEmail;
  await createNotification({
    recipientId,
    type: "reschedule_requested",
    bookingId: booking.id,
    title: "Reschedule requested",
    message: `${proposerLabel} proposed a new time: ${new Date(proposedAt).toLocaleString()}`,
  });
}

/** The other party accepting the currently active reschedule proposal. */
export async function acceptRescheduleProposal(booking: Booking): Promise<void> {
  const proposal = booking.rescheduleProposal;
  if (!proposal) return;
  await updateDoc(doc(db, "bookings", booking.id), {
    scheduledAt: proposal.proposedAt,
    rescheduleProposal: deleteField(),
    updatedAt: Date.now(),
  });
  const recipientId = proposal.proposedBy === "user" ? booking.userId : booking.counsellorId;
  await createNotification({
    recipientId,
    type: "reschedule_accepted",
    bookingId: booking.id,
    title: "Reschedule accepted",
    message: `Your proposed time was accepted: ${new Date(proposal.proposedAt).toLocaleString()}`,
  });
}

export async function cancelBooking(
  booking: Booking,
  cancelledBy: "user" | "counsellor",
  reason: string,
): Promise<void> {
  await updateDoc(doc(db, "bookings", booking.id), {
    status: "cancelled",
    cancelledBy,
    cancellationReason: reason,
    updatedAt: Date.now(),
  });
  const recipientId = cancelledBy === "user" ? booking.counsellorId : booking.userId;
  await createNotification({
    recipientId,
    type: "booking_cancelled",
    bookingId: booking.id,
    title: "Session cancelled",
    message: `Session cancelled by ${cancelledBy === "user" ? booking.userEmail : booking.counsellorEmail}: ${reason}`,
  });
}

export async function transferBooking(
  booking: Booking,
  newCounsellor: { uid: string; email: string },
  previousCounsellorId: string,
): Promise<void> {
  await updateDoc(doc(db, "bookings", booking.id), {
    status: "pending",
    counsellorId: newCounsellor.uid,
    counsellorEmail: newCounsellor.email,
    transferredFrom: previousCounsellorId,
    cancelledBy: deleteField(),
    cancellationReason: deleteField(),
    updatedAt: Date.now(),
  });
  await createNotification({
    recipientId: newCounsellor.uid,
    type: "booking_transferred",
    bookingId: booking.id,
    title: "New session request assigned",
    message: `A session request from ${booking.userEmail} has been assigned to you`,
  });
  await createNotification({
    recipientId: booking.userId,
    type: "booking_transferred",
    bookingId: booking.id,
    title: "Request reassigned",
    message: `Your session request was reassigned to ${newCounsellor.email}`,
  });
}

/**
 * A Counsellor no longer transfers a booking directly — they can only request
 * that their campus Head do it. The Head reviews and either approves (picking
 * who it goes to) or declines.
 */
export async function requestBookingTransfer(
  booking: Booking,
  requester: { uid: string; email: string },
  headId: string,
  reason: string,
  suggestedTarget?: { uid: string; email: string },
): Promise<void> {
  const now = Date.now();
  await updateDoc(doc(db, "bookings", booking.id), {
    transferRequest: {
      requestedBy: requester.uid,
      requestedByEmail: requester.email,
      reason,
      status: "pending",
      createdAt: now,
      ...(suggestedTarget
        ? { suggestedTargetId: suggestedTarget.uid, suggestedTargetEmail: suggestedTarget.email }
        : {}),
    },
    updatedAt: now,
  });
  await createNotification({
    recipientId: headId,
    type: "transfer_requested",
    bookingId: booking.id,
    title: "Transfer request",
    message: `${requester.email} requested to transfer a session with ${booking.userEmail}: ${reason}`,
  });
}

/**
 * Head approving a transfer request. Notifies the original requester FIRST,
 * while they're still `counsellorId` (a party to the booking) — the
 * notifications security rule's party-check needs that to still be true when
 * this write is evaluated, so it must happen before the reassignment below
 * changes counsellorId out from under them.
 */
export async function approveBookingTransfer(
  booking: Booking,
  head: { uid: string },
  target: { uid: string; email: string },
): Promise<void> {
  if (!booking.transferRequest) return;
  await createNotification({
    recipientId: booking.transferRequest.requestedBy,
    type: "booking_transferred",
    bookingId: booking.id,
    title: "Transfer approved",
    message: `Your transfer request for ${booking.userEmail}'s session was approved — reassigned to ${target.email}`,
  });
  await transferBooking(booking, target, booking.counsellorId);
  await updateDoc(doc(db, "bookings", booking.id), {
    "transferRequest.status": "approved",
    "transferRequest.decidedBy": head.uid,
    updatedAt: Date.now(),
  });
}

export async function declineBookingTransfer(
  booking: Booking,
  head: { uid: string },
  note?: string,
): Promise<void> {
  if (!booking.transferRequest) return;
  await updateDoc(doc(db, "bookings", booking.id), {
    "transferRequest.status": "declined",
    "transferRequest.decidedBy": head.uid,
    ...(note ? { "transferRequest.decisionNote": note } : {}),
    updatedAt: Date.now(),
  });
  await createNotification({
    recipientId: booking.transferRequest.requestedBy,
    type: "transfer_declined",
    bookingId: booking.id,
    title: "Transfer request declined",
    message: `Your transfer request for ${booking.userEmail}'s session was declined${note ? `: ${note}` : ""}`,
  });
}

export async function listPendingTransferRequestsForCampus(campusId: string): Promise<Booking[]> {
  const q = query(bookingsCollection, where("transferRequest.status", "==", "pending"));
  const snapshot = await getDocs(q);
  return snapshot.docs
    .map((d) => toBooking(d.id, d.data()))
    .filter((b) => b.campusId === campusId)
    .sort((a, b) => (b.transferRequest?.createdAt ?? 0) - (a.transferRequest?.createdAt ?? 0));
}

export async function listCompletedBookingsForCounsellor(counsellorId: string): Promise<Booking[]> {
  const q = query(bookingsCollection, where("counsellorId", "==", counsellorId));
  const snapshot = await getDocs(q);
  return snapshot.docs
    .map((d) => toBooking(d.id, d.data()))
    .filter((b) => b.status === "completed");
}

export async function listCompletedBookings(): Promise<Booking[]> {
  const q = query(bookingsCollection, where("status", "==", "completed"));
  const snapshot = await getDocs(q);
  return snapshot.docs
    .map((d) => toBooking(d.id, d.data()))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function rateCounsellor(bookingId: string, rating: number, reviewText?: string): Promise<void> {
  await updateDoc(doc(db, "bookings", bookingId), {
    userRatingOfCounsellor: rating,
    ...(reviewText ? { userReviewText: reviewText } : {}),
    updatedAt: Date.now(),
  });
}

export async function rateUser(bookingId: string, rating: number, note?: string): Promise<void> {
  await updateDoc(doc(db, "bookings", bookingId), {
    counsellorRatingOfUser: rating,
    ...(note ? { counsellorNoteOnUser: note } : {}),
    updatedAt: Date.now(),
  });
}

export async function listCancelledBookings(): Promise<Booking[]> {
  const q = query(bookingsCollection, where("status", "==", "cancelled"));
  const snapshot = await getDocs(q);
  return snapshot.docs
    .map((d) => toBooking(d.id, d.data()))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function closeBooking(booking: Booking, outcome: BookingOutcome): Promise<void> {
  await updateDoc(doc(db, "bookings", booking.id), {
    status: "completed",
    outcome,
    updatedAt: Date.now(),
  });
  if (outcome === "completed") {
    await createNotification({
      recipientId: booking.userId,
      type: "booking_completed",
      bookingId: booking.id,
      title: "Session completed",
      message: `Your session with ${booking.counsellorEmail} is complete`,
    });
  }
}

export async function closeMissedSession(booking: Booking, reason: string): Promise<void> {
  await updateDoc(doc(db, "bookings", booking.id), {
    status: "completed",
    outcome: "missed",
    missedReason: reason,
    updatedAt: Date.now(),
  });
  await createNotification({
    recipientId: booking.userId,
    type: "booking_missed",
    bookingId: booking.id,
    title: "Session not held",
    message: `Your scheduled session with ${booking.counsellorEmail} did not take place: ${reason}`,
  });
}

/**
 * A "scheduled" booking whose end time (scheduledAt + duration) has already
 * passed with no closing action taken — i.e. it should show as missed even
 * though nobody has written a reason yet.
 */
export function isSessionEndedPending(booking: Booking): boolean {
  return (
    booking.status === "scheduled" &&
    booking.scheduledAt !== undefined &&
    Date.now() >= booking.scheduledAt + booking.durationMinutes * 60000
  );
}

/**
 * One-time reminder to the counsellor themselves that a session needs to be
 * marked. Does not change status/outcome — the booking stays "scheduled"
 * until the counsellor actually writes a reason via closeMissedSession.
 *
 * Uses a transaction (rather than a plain read-then-write) because this gets
 * called from refresh(), which can run more than once in quick succession
 * (e.g. React StrictMode's double-invoked effects) — a transaction guarantees
 * only one of those concurrent calls actually flips missedNotified and sends
 * the notification, instead of both racing past the same stale flag value.
 */
export async function flagMissedSessionPending(booking: Booking): Promise<void> {
  const bookingRef = doc(db, "bookings", booking.id);
  const shouldNotify = await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(bookingRef);
    if (!snap.exists() || snap.data().missedNotified) return false;
    transaction.update(bookingRef, { missedNotified: true });
    return true;
  });
  if (!shouldNotify) return;
  await createNotification({
    recipientId: booking.counsellorId,
    type: "session_needs_review",
    bookingId: booking.id,
    title: "Session needs review",
    message: `Your session with ${booking.userEmail} was scheduled to end and hasn't been marked yet — let us know what happened.`,
  });
}

export async function createFollowUpBooking(
  original: Booking,
  intake: BookingIntake,
  scheduledAt: number,
): Promise<string> {
  const now = Date.now();
  const docRef = await addDoc(bookingsCollection, {
    userId: original.userId,
    userEmail: original.userEmail,
    counsellorId: original.counsellorId,
    counsellorEmail: original.counsellorEmail,
    status: "scheduled",
    scheduledAt,
    durationMinutes: SESSION_DURATION_MINUTES,
    followUpOfBookingId: original.id,
    createdAt: now,
    updatedAt: now,
  });
  const { username, occupation, whatsappNumber, issue } = intake;
  await setDoc(intakeDocRef(docRef.id), { username, occupation, whatsappNumber, issue });
  await createNotification({
    recipientId: original.userId,
    type: "followup_scheduled",
    bookingId: docRef.id,
    title: "Follow-up session scheduled",
    message: `A follow-up session with ${original.counsellorEmail} is scheduled for ${new Date(scheduledAt).toLocaleString()}`,
  });
  return docRef.id;
}

/**
 * Imports one row from an offline (in-person) session log directly as a
 * completed booking — skips the pending/accepted/scheduled state machine and
 * skips notifications entirely, since this is a historical record, not a live
 * event. Sequential addDoc then setDoc (not writeBatch): a security rule's
 * get() on the parent booking must see it as already committed when the
 * private/details write is evaluated, which sequential awaited writes
 * guarantee and a batch does not.
 */
export async function importOfflineSession(
  counsellor: { uid: string; email: string },
  row: OfflineSessionRow,
): Promise<string> {
  const userId = syntheticClientId(row.clientEmail, row.whatsappNumber);
  const userEmail = clientDisplayLabel(row.clientName, row.whatsappNumber);

  const docRef = await addDoc(bookingsCollection, {
    userId,
    userEmail,
    counsellorId: counsellor.uid,
    counsellorEmail: counsellor.email,
    status: "completed",
    outcome: "completed",
    sessionMode: "offline",
    scheduledAt: row.scheduledAt,
    durationMinutes: row.durationMinutes,
    createdAt: row.scheduledAt,
    updatedAt: row.scheduledAt,
    ...(row.userRating !== undefined ? { userRatingOfCounsellor: row.userRating } : {}),
    ...(row.counsellorRating !== undefined ? { counsellorRatingOfUser: row.counsellorRating } : {}),
    ...(row.counsellorNote ? { counsellorNoteOnUser: row.counsellorNote } : {}),
  });

  await setDoc(intakeDocRef(docRef.id), {
    username: row.clientName,
    occupation: row.occupation,
    whatsappNumber: row.whatsappNumber,
    issue: row.issue,
    ...(row.summary ? { summary: row.summary } : {}),
  });

  return docRef.id;
}

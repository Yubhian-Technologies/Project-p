import {
  addDoc,
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  query,
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
): Promise<string> {
  const now = Date.now();
  const docRef = await addDoc(bookingsCollection, {
    userId: user.uid,
    userEmail: user.email,
    counsellorId: counsellor.uid,
    counsellorEmail: counsellor.email,
    status: "pending",
    durationMinutes: SESSION_DURATION_MINUTES,
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

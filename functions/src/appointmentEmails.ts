import { onDocumentCreated, onDocumentUpdated } from "firebase-functions/v2/firestore";
import { defineSecret, defineString } from "firebase-functions/params";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const resendApiKey = defineSecret("RESEND_API_KEY");
const emailFrom = defineString("EMAIL_FROM", {
  default: "Vishnu Wellness Centre <notifications@vishnuwellnesscentre.in>",
});
/** notifications@ has no real inbox behind it — a reply to it would just
    bounce. This address gets the reply instead, with no change needed on
    the recipient's end: clicking "Reply" in their mail client addresses it
    here automatically. */
const emailReplyTo = defineString("EMAIL_REPLY_TO", {
  default: "vishnuwellnesscentre@gmail.com",
});

const DISPLAY_TIMEZONE = "Asia/Kolkata";

interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch]);
}

function formatDate(ms: number): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: DISPLAY_TIMEZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(ms);
}

function formatTime(ms: number): string {
  return `${new Intl.DateTimeFormat("en-IN", {
    timeZone: DISPLAY_TIMEZONE,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(ms)} IST`;
}

function renderEmail(opts: {
  subject: string;
  heading: string;
  intro: string;
  rows: [string, string][];
}): RenderedEmail {
  const rowsHtml = opts.rows
    .map(
      ([label, value]) => `
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #EEF2F6;color:#64748B;font-size:13px;width:40%;vertical-align:top">${escapeHtml(label)}</td>
          <td style="padding:10px 0;border-bottom:1px solid #EEF2F6;color:#0F172A;font-size:15px;font-weight:600;vertical-align:top">${escapeHtml(value)}</td>
        </tr>`,
    )
    .join("");

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#F8FAFC;font-family:Arial,Helvetica,sans-serif;color:#0F172A">
    <div style="max-width:560px;margin:0 auto;padding:24px 16px">
      <div style="background:#FFFFFF;border:1px solid #E2E8F0;border-radius:16px;padding:24px">
        <h2 style="margin:0 0 8px;font-size:20px;color:#0B193C">${escapeHtml(opts.heading)}</h2>
        <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#334155">${escapeHtml(opts.intro)}</p>
        <table role="presentation" style="width:100%;border-collapse:collapse">${rowsHtml}
        </table>
      </div>
      <p style="margin:16px 0 0;font-size:12px;line-height:1.5;color:#94A3B8;text-align:center">
        Vishnu Wellness Centre &middot; You're receiving this because of a session booked through the app.
      </p>
    </div>
  </body>
</html>`;

  const text = [
    opts.heading,
    "",
    opts.intro,
    "",
    ...opts.rows.map(([label, value]) => `${label}: ${value}`),
    "",
    "Vishnu Wellness Center",
  ].join("\n");

  return { subject: opts.subject, html, text };
}

interface BookingEmailContext {
  userName: string;
  userEmail: string;
  userWhatsapp: string;
  counsellorName: string;
  counsellorEmail: string;
  counsellorWhatsapp: string;
  /** The session's current scheduled time — absent for a cancellation of a
      booking that never made it to "scheduled" in the first place. */
  scheduledAt?: number;
  /** Set by the counsellor/head when they confirm the time — absent until
      then, and for any booking scheduled before this existed. */
  venue?: string;
  cancelledBy?: "user" | "counsellor";
  cancellationReason?: string;
}

/** Pure, side-effect-free builder — both emails for a newly scheduled session. */
export function buildAppointmentEmails(
  d: BookingEmailContext & { scheduledAt: number },
): { user: RenderedEmail; counsellor: RenderedEmail } {
  const date = formatDate(d.scheduledAt);
  const time = formatTime(d.scheduledAt);

  const venueRow: [string, string][] = d.venue ? [["Venue", d.venue]] : [];

  const user = renderEmail({
    subject: `Your session is confirmed — ${date}, ${time}`,
    heading: "Your session is confirmed",
    intro: `Hi ${d.userName}, your session has been scheduled. Here are the details.`,
    rows: [
      ["Counsellor", d.counsellorName],
      ["Date", date],
      ["Time", time],
      ...venueRow,
      ["Counsellor WhatsApp", d.counsellorWhatsapp || "Not provided — please contact us through the app"],
    ],
  });

  const counsellor = renderEmail({
    subject: `New confirmed session — ${date}, ${time}`,
    heading: "A session has been confirmed",
    intro: `Hi ${d.counsellorName}, a session has been scheduled with you. Here are the details.`,
    rows: [
      ["Student", d.userName],
      ["Date", date],
      ["Time", time],
      ...venueRow,
      ["Student WhatsApp", d.userWhatsapp || "Not provided"],
    ],
  });

  return { user, counsellor };
}

/** Both emails for a session whose confirmed time just changed — same shape
    as buildAppointmentEmails, but calls out that it's a change rather than a
    first confirmation, and shows the previous time when it's known. */
export function buildRescheduledEmails(
  d: BookingEmailContext & { scheduledAt: number },
  previousScheduledAt?: number,
): { user: RenderedEmail; counsellor: RenderedEmail } {
  const date = formatDate(d.scheduledAt);
  const time = formatTime(d.scheduledAt);
  const previousRow: [string, string][] =
    typeof previousScheduledAt === "number"
      ? [["Previously", `${formatDate(previousScheduledAt)}, ${formatTime(previousScheduledAt)}`]]
      : [];
  const venueRow: [string, string][] = d.venue ? [["Venue", d.venue]] : [];

  const user = renderEmail({
    subject: `Your session time has changed — ${date}, ${time}`,
    heading: "Your session time has changed",
    intro: `Hi ${d.userName}, your session with ${d.counsellorName} has been moved. Here are the updated details.`,
    rows: [
      ["Counsellor", d.counsellorName],
      ...previousRow,
      ["New date", date],
      ["New time", time],
      ...venueRow,
      ["Counsellor WhatsApp", d.counsellorWhatsapp || "Not provided — please contact us through the app"],
    ],
  });

  const counsellor = renderEmail({
    subject: `Session time changed — ${date}, ${time}`,
    heading: "A session time has changed",
    intro: `Hi ${d.counsellorName}, your session with ${d.userName} has been moved. Here are the updated details.`,
    rows: [
      ["Student", d.userName],
      ...previousRow,
      ["New date", date],
      ["New time", time],
      ...venueRow,
      ["Student WhatsApp", d.userWhatsapp || "Not provided"],
    ],
  });

  return { user, counsellor };
}

interface SosEmailContext {
  studentName: string;
  studentEmail: string;
  studentWhatsapp: string;
  campusName: string;
  issue: string;
  dispatchedAt: number;
}

/** One alert email, sent identically to every Head/Counsellor on the
    student's campus — unlike the per-recipient appointment emails above,
    there's no "your session" framing here, just an urgent shared alert. */
export function buildEmergencySosEmail(d: SosEmailContext): RenderedEmail {
  const date = formatDate(d.dispatchedAt);
  const time = formatTime(d.dispatchedAt);
  return renderEmail({
    subject: `URGENT: Crisis SOS dispatched — ${d.studentName}`,
    heading: "Crisis SOS — immediate attention needed",
    intro: `${d.studentName} has dispatched a Crisis SOS on ${d.campusName} and needs immediate attention. Open the app now to respond — any Head or Counsellor on campus can accept it.`,
    rows: [
      ["Student", d.studentName],
      ["Email", d.studentEmail],
      ["WhatsApp", d.studentWhatsapp || "Not provided"],
      ["Campus", d.campusName],
      ["Dispatched", `${date}, ${time}`],
      ["Note", d.issue],
    ],
  });
}

/** Only one of these two is actually sent — to whichever party didn't do the
    cancelling, same as the in-app notification this mirrors. Both are built
    regardless since that's cheap and keeps this symmetric with the other
    builders above. */
export function buildCancellationEmails(d: BookingEmailContext): { user: RenderedEmail; counsellor: RenderedEmail } {
  const timeRows: [string, string][] =
    typeof d.scheduledAt === "number"
      ? [["Was scheduled for", `${formatDate(d.scheduledAt)}, ${formatTime(d.scheduledAt)}`]]
      : [];
  const reasonRow: [string, string][] = [["Reason", d.cancellationReason || "No reason given"]];

  const user = renderEmail({
    subject: "Your session was cancelled",
    heading: "Your session was cancelled",
    intro: `Hi ${d.userName}, your session with ${d.counsellorName} has been cancelled.`,
    rows: [["Counsellor", d.counsellorName], ...timeRows, ...reasonRow],
  });

  const counsellor = renderEmail({
    subject: "A session was cancelled",
    heading: "A session was cancelled",
    intro: `Hi ${d.counsellorName}, your session with ${d.userName} has been cancelled.`,
    rows: [["Student", d.userName], ...timeRows, ...reasonRow],
  });

  return { user, counsellor };
}

/** Booking-level events that trigger an email. */
type AppointmentEmailEvent = "scheduled" | "rescheduled" | "cancelled" | "emergency";

interface DetectedEvent {
  event: AppointmentEmailEvent;
  /** Only set for "rescheduled" — the time being replaced, so the email can
      show "previously X, now Y" when it's known. */
  previousScheduledAt?: number;
}

function detectEvent(
  before: FirebaseFirestore.DocumentData,
  after: FirebaseFirestore.DocumentData,
): DetectedEvent | null {
  // Crisis SOS is handled immediately, never scheduled/rescheduled/cancelled
  // the normal way — no appointment emails apply to it.
  if (after.isEmergency) return null;

  if (after.status === "scheduled" && before.status !== "scheduled" && typeof after.scheduledAt === "number") {
    return { event: "scheduled" };
  }
  if (after.status === "cancelled" && before.status !== "cancelled") {
    return { event: "cancelled" };
  }
  if (
    after.status === "scheduled" &&
    before.status === "scheduled" &&
    typeof after.scheduledAt === "number" &&
    typeof before.scheduledAt === "number" &&
    after.scheduledAt !== before.scheduledAt
  ) {
    return { event: "rescheduled", previousScheduledAt: before.scheduledAt };
  }
  return null;
}

/**
 * Claims the right to send an event's emails for this booking, in a
 * transaction so concurrent or repeated updates can't both claim it.
 */
async function claimEvent(bookingId: string, event: AppointmentEmailEvent): Promise<boolean> {
  const db = getFirestore();
  const ref = db.collection("bookings").doc(bookingId);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.data();
    if (!data) return false;
    if (data.emailEvents?.[event]) return false;
    tx.update(ref, { [`emailEvents.${event}`]: Date.now() });
    return true;
  });
}

async function releaseEvent(bookingId: string, event: AppointmentEmailEvent): Promise<void> {
  const db = getFirestore();
  await db
    .collection("bookings")
    .doc(bookingId)
    .update({ [`emailEvents.${event}`]: FieldValue.delete() });
}

async function sendEmail(
  to: string,
  email: RenderedEmail,
  idempotencyKey: string,
): Promise<void> {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey.value()}`,
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify({
      from: emailFrom.value(),
      to: [to],
      reply_to: emailReplyTo.value(),
      subject: email.subject,
      html: email.html,
      text: email.text,
    }),
  });
  if (!response.ok) {
    throw new Error(`Resend rejected email (${response.status}): ${await response.text()}`);
  }
}

async function loadEmailContext(bookingId: string): Promise<BookingEmailContext | null> {
  const db = getFirestore();
  const bookingSnap = await db.collection("bookings").doc(bookingId).get();
  const booking = bookingSnap.data();
  if (!booking) return null;

  const [userSnap, counsellorSnap, intakeSnap] = await Promise.all([
    db.collection("users").doc(booking.userId as string).get(),
    db.collection("users").doc(booking.counsellorId as string).get(),
    db.collection("bookings").doc(bookingId).collection("private").doc("details").get(),
  ]);
  const user = userSnap.data() ?? {};
  const counsellor = counsellorSnap.data() ?? {};
  const intake = intakeSnap.data() ?? {};

  const userEmail = (booking.userEmail as string) || (user.email as string) || "";
  const counsellorEmail = (booking.counsellorEmail as string) || (counsellor.email as string) || "";

  return {
    userName: (intake.username as string) || (user.displayName as string) || userEmail,
    userEmail,
    userWhatsapp: (intake.whatsappNumber as string) || (user.whatsappNumber as string) || "",
    counsellorName: (counsellor.displayName as string) || counsellorEmail,
    counsellorEmail,
    counsellorWhatsapp: (counsellor.whatsappNumber as string) || "",
    scheduledAt: typeof booking.scheduledAt === "number" ? (booking.scheduledAt as number) : undefined,
    venue: (booking.venue as string | undefined) || undefined,
    cancelledBy: booking.cancelledBy as "user" | "counsellor" | undefined,
    cancellationReason: booking.cancellationReason as string | undefined,
  };
}

export const sendAppointmentEmails = onDocumentUpdated(
  { document: "bookings/{bookingId}", secrets: [resendApiKey] },
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after) return;

    const detected = detectEvent(before, after);
    if (!detected) return;
    const { event: appointmentEvent, previousScheduledAt } = detected;

    const bookingId = event.params.bookingId;
    const claimed = await claimEvent(bookingId, appointmentEvent);
    if (!claimed) return;

    try {
      const data = await loadEmailContext(bookingId);
      if (!data) return;

      const sends: Promise<void>[] = [];

      if (appointmentEvent === "cancelled") {
        // Only the party who didn't cancel it gets told — the canceller
        // already knows, same as the in-app notification this mirrors.
        const emails = buildCancellationEmails(data);
        if (data.cancelledBy === "user" && data.counsellorEmail) {
          sends.push(sendEmail(data.counsellorEmail, emails.counsellor, `${bookingId}:cancelled:counsellor`));
        } else if (data.cancelledBy !== "user" && data.userEmail) {
          sends.push(sendEmail(data.userEmail, emails.user, `${bookingId}:cancelled:user`));
        }
      } else if (typeof data.scheduledAt === "number") {
        const withScheduledAt = { ...data, scheduledAt: data.scheduledAt };
        const emails =
          appointmentEvent === "scheduled"
            ? buildAppointmentEmails(withScheduledAt)
            : buildRescheduledEmails(withScheduledAt, previousScheduledAt);

        if (data.userEmail) {
          sends.push(sendEmail(data.userEmail, emails.user, `${bookingId}:${appointmentEvent}:user`));
        } else {
          console.warn("Skipping student email: no address on booking", bookingId);
        }
        if (data.counsellorEmail) {
          sends.push(sendEmail(data.counsellorEmail, emails.counsellor, `${bookingId}:${appointmentEvent}:counsellor`));
        } else {
          console.warn("Skipping counsellor email: no address on booking", bookingId);
        }
      }

      await Promise.all(sends);
    } catch (err) {
      // Release the claim so a retry can go out — Resend's Idempotency-Key
      // stops any recipient that already got their copy from getting it twice.
      await releaseEvent(bookingId, appointmentEvent);
      throw err;
    }
  },
);

/**
 * Crisis SOS alert emails, dispatched to every Head/Counsellor on the
 * student's campus the moment the booking is created — the in-app
 * "emergency_sos" notification (see createEmergencySosBooking) already
 * reaches the same people instantly, but a login email can't be missed
 * just because nobody has the app open right then. A dedicated onCreate
 * trigger rather than reusing sendAppointmentEmails: detectEvent()
 * deliberately excludes isEmergency bookings (there's no "scheduled" time
 * to report), and this needs a rich, campus-staff-fanout email, not the
 * single to/counsellor shape the appointment builders assume.
 */
export const emailOnEmergencySosDispatch = onDocumentCreated(
  { document: "bookings/{bookingId}", secrets: [resendApiKey] },
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;
    const booking = snapshot.data();
    if (!booking?.isEmergency) return;

    const bookingId = event.params.bookingId;
    const claimed = await claimEvent(bookingId, "emergency");
    if (!claimed) return;

    try {
      const db = getFirestore();
      const campusId = booking.campusId as string | undefined;
      const [intakeSnap, campusSnap, staffSnap] = await Promise.all([
        db.collection("bookings").doc(bookingId).collection("private").doc("details").get(),
        campusId ? db.collection("campuses").doc(campusId).get() : Promise.resolve(null),
        // A single where("role","in",...) filter only needs Firestore's
        // automatic single-field index — combining it server-side with a
        // second where("campusId","==",...) would need a composite index
        // that doesn't exist, so campus/active filtering happens in memory
        // below instead, same as listBookableProfiles()'s client callers do.
        db.collection("users").where("role", "in", ["counsellor", "head"]).get(),
      ]);
      const intake = intakeSnap.data() ?? {};
      const campusName = (campusSnap?.data()?.name as string | undefined) || "your campus";
      const studentEmail = (booking.userEmail as string) || "";
      const studentName = (intake.username as string) || studentEmail || "A student";

      const email = buildEmergencySosEmail({
        studentName,
        studentEmail,
        studentWhatsapp: (intake.whatsappNumber as string) || "",
        campusName,
        issue: (intake.issue as string) || "Crisis SOS — immediate assistance requested.",
        dispatchedAt: typeof booking.createdAt === "number" ? booking.createdAt : Date.now(),
      });

      const sends: Promise<void>[] = [];
      staffSnap.docs.forEach((staffDoc) => {
        const staff = staffDoc.data();
        if (staff.campusId !== campusId || staff.active === false) return;
        const to = staff.email as string | undefined;
        if (!to) {
          console.warn("Skipping SOS email: staff has no address", staffDoc.id);
          return;
        }
        sends.push(sendEmail(to, email, `${bookingId}:emergency:${staffDoc.id}`));
      });

      if (sends.length === 0) {
        console.warn("No campus staff emails to send Crisis SOS alert to", bookingId);
      }
      await Promise.all(sends);
    } catch (err) {
      await releaseEvent(bookingId, "emergency");
      throw err;
    }
  },
);

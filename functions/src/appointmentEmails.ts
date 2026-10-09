import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import { defineSecret, defineString } from "firebase-functions/params";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const resendApiKey = defineSecret("RESEND_API_KEY");
const emailFrom = defineString("EMAIL_FROM", {
  default: "Vishnu Wellness Center <onboarding@resend.dev>",
});

const DISPLAY_TIMEZONE = "Asia/Kolkata";

export interface AppointmentEmailData {
  userName: string;
  userEmail: string;
  userWhatsapp: string;
  counsellorName: string;
  counsellorEmail: string;
  counsellorWhatsapp: string;
  startsAt: number;
}

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
        Vishnu Wellness Center &middot; You're receiving this because of a session booked through the app.
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

/** Pure, side-effect-free builder — both emails for a newly scheduled session. */
export function buildAppointmentEmails(d: AppointmentEmailData): { user: RenderedEmail; counsellor: RenderedEmail } {
  const date = formatDate(d.startsAt);
  const time = formatTime(d.startsAt);

  const user = renderEmail({
    subject: `Your session is confirmed — ${date}, ${time}`,
    heading: "Your session is confirmed",
    intro: `Hi ${d.userName}, your session has been scheduled. Here are the details.`,
    rows: [
      ["Counsellor", d.counsellorName],
      ["Date", date],
      ["Time", time],
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
      ["Student WhatsApp", d.userWhatsapp || "Not provided"],
    ],
  });

  return { user, counsellor };
}

/** Booking-level event that triggers emails. Rescheduling/cancellation can be added here. */
type AppointmentEmailEvent = "scheduled";

function detectEvent(
  before: FirebaseFirestore.DocumentData,
  after: FirebaseFirestore.DocumentData,
): AppointmentEmailEvent | null {
  if (after.isEmergency) return null;
  if (after.status === "scheduled" && before.status !== "scheduled" && typeof after.scheduledAt === "number") {
    return "scheduled";
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
    if (!data || data.status !== "scheduled") return false;
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
      subject: email.subject,
      html: email.html,
      text: email.text,
    }),
  });
  if (!response.ok) {
    throw new Error(`Resend rejected email (${response.status}): ${await response.text()}`);
  }
}

async function loadEmailData(bookingId: string): Promise<AppointmentEmailData | null> {
  const db = getFirestore();
  const bookingSnap = await db.collection("bookings").doc(bookingId).get();
  const booking = bookingSnap.data();
  if (!booking || typeof booking.scheduledAt !== "number") return null;

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
    startsAt: booking.scheduledAt as number,
  };
}

export const sendAppointmentEmails = onDocumentUpdated(
  { document: "bookings/{bookingId}", secrets: [resendApiKey] },
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after) return;

    const appointmentEvent = detectEvent(before, after);
    if (!appointmentEvent) return;

    const bookingId = event.params.bookingId;
    const claimed = await claimEvent(bookingId, appointmentEvent);
    if (!claimed) return;

    try {
      const data = await loadEmailData(bookingId);
      if (!data) return;
      const emails = buildAppointmentEmails(data);

      const sends: Promise<void>[] = [];
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
      await Promise.all(sends);
    } catch (err) {
      // Release the claim so a retry can go out — Resend's Idempotency-Key
      // stops any recipient that already got their copy from getting it twice.
      await releaseEvent(bookingId, appointmentEvent);
      throw err;
    }
  },
);

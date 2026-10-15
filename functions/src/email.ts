import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { defineSecret, defineString } from "firebase-functions/params";
import { getFirestore } from "firebase-admin/firestore";

/** Resend API key — set with: firebase functions:secrets:set RESEND_API_KEY */
const resendApiKey = defineSecret("RESEND_API_KEY");

/** Sender address. Must be on a domain verified in Resend. */
const emailFrom = defineString("EMAIL_FROM", {
  default: "Vishnu Wellness Centre <notifications@vishnuwellnesscentre.in>",
});
/** notifications@ has no real inbox behind it — a reply to it would just
    bounce. This address gets the reply instead. */
const emailReplyTo = defineString("EMAIL_REPLY_TO", {
  default: "vishnuwellnesscentre@gmail.com",
});

interface NotificationDoc {
  recipientId: string;
  type: string;
  title: string;
  message: string;
  bookingId?: string;
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

export function buildNotificationEmail(n: NotificationDoc): { subject: string; text: string; html: string } {
  const subject = n.title;
  const text = `${n.title}\n\n${n.message}\n\nOpen Vishnu Wellness Centre to see the details.`;
  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;color:#2E2B27;max-width:560px;margin:0 auto;padding:24px">
      <h2 style="margin:0 0 12px;font-size:20px">${escapeHtml(n.title)}</h2>
      <p style="margin:0 0 20px;font-size:15px;line-height:1.6">${escapeHtml(n.message)}</p>
      <p style="margin:0;font-size:12px;color:#8A8375">
        You're receiving this because of activity on your Vishnu Wellness Centre account.
      </p>
    </div>`;
  return { subject, text, html };
}

/** Every head/counsellor on a campus already gets an in-app "emergency_sos"
    notification the moment a student dispatches a Crisis SOS (see
    createEmergencySosBooking) — this mirrors that same notification to each
    of their login emails too, so it can't be missed just because nobody has
    the app open right then. Scoped to this one notification type on purpose:
    emailing on every notification (chat messages, routine booking updates,
    etc.) would be far too noisy. Errors are logged rather than rethrown, so
    a provider outage can't cause the same alert to be emailed again on retry. */
export const emailOnEmergencySos = onDocumentCreated(
  { document: "notifications/{notificationId}", secrets: [resendApiKey] },
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;
    const notification = snapshot.data() as NotificationDoc;
    if (notification.type !== "emergency_sos") return;

    const userSnap = await getFirestore().collection("users").doc(notification.recipientId).get();
    const to = userSnap.get("email") as string | undefined;
    if (!to) {
      console.warn("Skipping email: recipient has no email", notification.recipientId);
      return;
    }

    const { subject, text, html } = buildNotificationEmail(notification);
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey.value()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: emailFrom.value(),
          to: [to],
          reply_to: emailReplyTo.value(),
          subject,
          html,
          text,
        }),
      });
      if (!response.ok) {
        console.error("Resend rejected email", response.status, await response.text());
      }
    } catch (err) {
      console.error("Failed to send notification email", err);
    }
  },
);

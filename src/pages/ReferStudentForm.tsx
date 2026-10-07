import { useState } from "react";
import type { FormEvent } from "react";
import { Select } from "../components/common/Select";
import "./ReferStudentForm.css";

const REFERRAL_EMAIL = "vishnuwellnesscentre@gmail.com";

const RELATIONSHIP_OPTIONS = ["Faculty", "Staff", "Student / Peer", "Parent / Guardian", "Other"];
const URGENCY_OPTIONS = ["Not urgent — general concern", "Needs attention soon", "Urgent — immediate concern"];

/** Builds a pre-filled mailto: draft rather than sending anything server-side —
    this app has no working email-sending backend yet (the Cloud Function
    groundwork in functions/src/appointmentEmails.ts is still unfinished,
    pending an email-provider API key), so the visitor's own mail app sends it. */
export function ReferStudentForm() {
  const [referrerName, setReferrerName] = useState("");
  const [referrerWhatsapp, setReferrerWhatsapp] = useState("");
  const [relationship, setRelationship] = useState(RELATIONSHIP_OPTIONS[0]);
  const [studentName, setStudentName] = useState("");
  const [campusOrCollege, setCampusOrCollege] = useState("");
  const [urgency, setUrgency] = useState(URGENCY_OPTIONS[0]);
  const [reason, setReason] = useState("");
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();

    const subject = `Student Referral: ${studentName.trim()}`;
    const bodyLines = [
      `Referred by: ${referrerName.trim()} (${relationship})`,
      `Referrer WhatsApp number: ${referrerWhatsapp.trim()}`,
      "",
      `Student: ${studentName.trim()}`,
      campusOrCollege.trim() ? `Campus / College: ${campusOrCollege.trim()}` : null,
      `Urgency: ${urgency}`,
      "",
      "Reason for referral:",
      reason.trim(),
    ].filter((line): line is string => line !== null);

    const mailtoUrl = `mailto:${REFERRAL_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyLines.join("\n"))}`;
    window.location.href = mailtoUrl;
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="refer-student-form__done">
        <p>
          Your email app should now have a draft addressed to <strong>{REFERRAL_EMAIL}</strong> with these
          details filled in — please review it and hit <strong>Send</strong> to complete the referral.
        </p>
        <p className="refer-student-form__done-hint">
          Nothing opened? Check for a blocked pop-up, or email {REFERRAL_EMAIL} directly with the same details.
        </p>
      </div>
    );
  }

  return (
    <form className="refer-student-form" onSubmit={handleSubmit}>
      <p className="refer-student-form__intro">
        Share a few details below — submitting opens a pre-filled email to the Wellness Centre team so they
        can follow up.
      </p>

      <div className="refer-student-form__row">
        <label className="refer-student-form__field">
          <span>Your name</span>
          <input type="text" required value={referrerName} onChange={(e) => setReferrerName(e.target.value)} />
        </label>
        <label className="refer-student-form__field">
          <span>Your WhatsApp number</span>
          <input
            type="tel"
            required
            value={referrerWhatsapp}
            onChange={(e) => setReferrerWhatsapp(e.target.value)}
          />
        </label>
      </div>

      <div className="refer-student-form__field">
        <label htmlFor="refer-relationship">Your relationship to the student</label>
        <Select id="refer-relationship" value={relationship} onChange={setRelationship}>
          {RELATIONSHIP_OPTIONS.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </Select>
      </div>

      <label className="refer-student-form__field">
        <span>Student's name</span>
        <input type="text" required value={studentName} onChange={(e) => setStudentName(e.target.value)} />
      </label>

      <label className="refer-student-form__field">
        <span>Campus / College (optional)</span>
        <input type="text" value={campusOrCollege} onChange={(e) => setCampusOrCollege(e.target.value)} />
      </label>

      <div className="refer-student-form__field">
        <label htmlFor="refer-urgency">Urgency</label>
        <Select id="refer-urgency" value={urgency} onChange={setUrgency}>
          {URGENCY_OPTIONS.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </Select>
      </div>

      <label className="refer-student-form__field">
        <span>What have you noticed? Why are you referring this student?</span>
        <textarea rows={4} required value={reason} onChange={(e) => setReason(e.target.value)} />
      </label>

      <button type="submit" className="refer-student-form__submit">
        Submit referral
      </button>
    </form>
  );
}

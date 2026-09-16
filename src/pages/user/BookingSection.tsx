import { useEffect, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import {
  listBookableProfiles,
  listBookingsForUser,
  listScheduledBookings,
  createBooking,
  cancelBooking,
  requestReschedule,
  acceptRescheduleProposal,
  isSessionEndedPending,
  rateCounsellor,
  SESSION_DURATION_LABEL,
} from "../../services/firebase/bookings";
import type { UserProfile } from "../../types/user";
import type { Booking, BookingIntake } from "../../types/booking";
import { computeLiveStatus } from "../../utils/counsellorStatus";
import { CounsellorCard } from "../../components/booking/CounsellorCard";
import { CounsellorProfileModal } from "../../components/booking/CounsellorProfileModal";
import { Card } from "../../components/common/Card";
import { Button } from "../../components/common/Button";
import { Modal } from "../../components/common/Modal";
import { Select } from "../../components/common/Select";
import { StarRating } from "../../components/common/StarRating";
import { DateTimePicker } from "../../components/common/DateTimePicker";
import "./BookingSection.css";

function nowValue(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const ACTIVE_STATUSES = ["pending", "accepted", "scheduled"];

function statusLabel(booking: Booking): string {
  if (booking.status === "scheduled" && isSessionEndedPending(booking)) {
    return "Missed — the scheduled time has passed";
  }
  switch (booking.status) {
    case "pending":
      return "Pending";
    case "accepted":
      return "Accepted — time coming soon";
    case "scheduled":
      return `Scheduled for ${booking.scheduledAt ? new Date(booking.scheduledAt).toLocaleString() : "—"} (${SESSION_DURATION_LABEL})`;
    case "rejected":
      return "Rejected";
    case "cancelled":
      return `Cancelled by ${booking.cancelledBy === "user" ? "you" : "the counsellor"}${booking.cancellationReason ? `: ${booking.cancellationReason}` : ""}`;
    case "completed":
      if (booking.outcome === "missed") {
        return `Missed${booking.missedReason ? `: ${booking.missedReason}` : ""}`;
      }
      return booking.outcome === "followup" ? "Completed — follow-up scheduled" : "Completed";
  }
}

function statusClass(booking: Booking): string {
  if (booking.status === "scheduled" && isSessionEndedPending(booking)) return "missed";
  if (booking.status === "completed" && booking.outcome === "missed") return "missed";
  return booking.status;
}

export function BookingSection() {
  const { currentUser, profile } = useAuth();
  const [counsellors, setCounsellors] = useState<UserProfile[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [scheduledBookings, setScheduledBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewingProfile, setViewingProfile] = useState<UserProfile | null>(null);
  const [target, setTarget] = useState<UserProfile | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [bookingStep, setBookingStep] = useState<"terms" | "form">("terms");
  const [submitting, setSubmitting] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<Booking | null>(null);
  const [cancelReasonField, setCancelReasonField] = useState("");
  const [cancelling, setCancelling] = useState(false);

  const [nameField, setNameField] = useState("");
  const [occupationField, setOccupationField] = useState<"student" | "professional">("student");
  const [whatsappField, setWhatsappField] = useState("");
  const [issueField, setIssueField] = useState("");
  const [slot1Field, setSlot1Field] = useState("");
  const [slot2Field, setSlot2Field] = useState("");

  const [rescheduleTarget, setRescheduleTarget] = useState<Booking | null>(null);
  const [rescheduleTimeField, setRescheduleTimeField] = useState("");
  const [rescheduleReasonField, setRescheduleReasonField] = useState("");
  const [requestingReschedule, setRequestingReschedule] = useState(false);
  const [acceptingRescheduleId, setAcceptingRescheduleId] = useState<string | null>(null);

  const [ratingTarget, setRatingTarget] = useState<Booking | null>(null);
  const [ratingValue, setRatingValue] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [submittingRating, setSubmittingRating] = useState(false);

  async function refresh() {
    if (!currentUser) return;
    const [profiles, userBookings, liveBookings] = await Promise.all([
      listBookableProfiles(),
      listBookingsForUser(currentUser.uid),
      listScheduledBookings(),
    ]);
    setCounsellors(profiles);
    setBookings(userBookings);
    setScheduledBookings(liveBookings);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, [currentUser]);

  const activeBooking = bookings.find((b) => ACTIVE_STATUSES.includes(b.status) && !isSessionEndedPending(b));

  function openConsent(counsellor: UserProfile) {
    setViewingProfile(null);
    setTarget(counsellor);
    setAgreed(false);
    setBookingStep("terms");
    setNameField(profile?.displayName ?? "");
    setOccupationField(profile?.studentOrProfessional ?? "student");
    setWhatsappField(profile?.whatsappNumber ?? "");
    setIssueField("");
    setSlot1Field("");
    setSlot2Field("");
  }

  const formValid =
    nameField.trim() &&
    whatsappField.trim() &&
    issueField.trim() &&
    agreed &&
    slot1Field &&
    slot2Field &&
    slot1Field !== slot2Field;

  async function confirmBooking() {
    if (!currentUser || !profile || !target || !formValid) return;
    setSubmitting(true);
    try {
      const intake: BookingIntake = {
        username: nameField.trim(),
        occupation: occupationField,
        whatsappNumber: whatsappField.trim(),
        issue: issueField.trim(),
      };
      await createBooking(
        { uid: currentUser.uid, email: profile.email },
        { uid: target.uid, email: target.email },
        intake,
        [new Date(slot1Field).getTime(), new Date(slot2Field).getTime()],
        profile.campusId,
      );
      setTarget(null);
      await refresh();
    } finally {
      setSubmitting(false);
    }
  }

  function openRescheduleRequest(booking: Booking) {
    setRescheduleTarget(booking);
    setRescheduleTimeField("");
    setRescheduleReasonField("");
  }

  async function confirmRescheduleRequest() {
    if (!rescheduleTarget || !rescheduleTimeField) return;
    setRequestingReschedule(true);
    try {
      await requestReschedule(
        rescheduleTarget,
        "user",
        new Date(rescheduleTimeField).getTime(),
        rescheduleReasonField.trim() || undefined,
      );
      setRescheduleTarget(null);
      await refresh();
    } finally {
      setRequestingReschedule(false);
    }
  }

  async function handleAcceptReschedule(booking: Booking) {
    setAcceptingRescheduleId(booking.id);
    try {
      await acceptRescheduleProposal(booking);
      await refresh();
    } finally {
      setAcceptingRescheduleId(null);
    }
  }

  async function confirmCancel() {
    if (!cancelTarget || !cancelReasonField.trim()) return;
    setCancelling(true);
    try {
      await cancelBooking(cancelTarget, "user", cancelReasonField.trim());
      setCancelTarget(null);
      await refresh();
    } finally {
      setCancelling(false);
    }
  }

  if (loading) return null;

  return (
    <div className="booking-section">
      <section>
        <h2 className="booking-section__heading">Counsellors</h2>
        {activeBooking && (
          <p className="booking-section__notice">
            You already have an active booking. You can book someone else once it's cancelled or rejected.
          </p>
        )}
        <div className="booking-section__grid">
          {counsellors.map((c) => (
            <CounsellorCard
              key={c.uid}
              profile={c}
              status={computeLiveStatus(c, scheduledBookings)}
              onClick={() => setViewingProfile(c)}
            />
          ))}
          {counsellors.length === 0 && <p>No counsellors are set up yet.</p>}
        </div>
      </section>

      <section>
        <h2 className="booking-section__heading">My Bookings</h2>
        {bookings.length === 0 && <p>You haven't requested a session yet.</p>}
        <div className="booking-section__bookings">
          {bookings.map((b) => (
            <Card key={b.id} className="booking-section__booking-row">
              <span>
                {b.counsellorEmail}
                {b.followUpOfBookingId && <span className="booking-section__followup-tag">(follow-up)</span>}
              </span>
              <div className="booking-section__row-right">
                <span className={`booking-section__status booking-section__status--${statusClass(b)}`}>
                  {statusLabel(b)}
                </span>
                {ACTIVE_STATUSES.includes(b.status) && !isSessionEndedPending(b) && (
                  <Button
                    type="button"
                    variant="outlined"
                    onClick={() => {
                      setCancelTarget(b);
                      setCancelReasonField("");
                    }}
                  >
                    Cancel
                  </Button>
                )}
                {b.status === "completed" && b.outcome !== "missed" && (
                  <div className="booking-section__rating-feedback-block">
                    {b.userRatingOfCounsellor === undefined ? (
                      <Button
                        type="button"
                        onClick={() => {
                          setRatingTarget(b);
                          setRatingValue(0);
                          setReviewText("");
                        }}
                      >
                        Rate Session
                      </Button>
                    ) : (
                      <div className="booking-section__rated-box">
                        <StarRating value={b.userRatingOfCounsellor} size="small" />
                        <a
                          href="https://docs.google.com/forms/d/e/1FAIpQLSe7qZzROzrkRwTozn-4alXrJvWtFt2FboI052tEGBk82O-SUg/viewform"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="booking-section__feedback-link"
                        >
                          Give Feedback
                        </a>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {b.status === "pending" && b.proposedSlots && (
                <div className="booking-section__extra">
                  Proposed times: {new Date(b.proposedSlots[0]).toLocaleString()} or{" "}
                  {new Date(b.proposedSlots[1]).toLocaleString()}
                </div>
              )}

              {b.status === "scheduled" && !isSessionEndedPending(b) && b.rescheduleProposal && (
                <div className="booking-section__extra">
                  {b.rescheduleProposal.proposedBy === "counsellor" ? (
                    <>
                      <p className="booking-section__reschedule-note">
                        Counsellor proposed a new time: {new Date(b.rescheduleProposal.proposedAt).toLocaleString()}
                        {b.rescheduleProposal.reason ? ` — ${b.rescheduleProposal.reason}` : ""}
                      </p>
                      <div className="booking-section__row-right">
                        <Button
                          type="button"
                          disabled={acceptingRescheduleId === b.id}
                          onClick={() => handleAcceptReschedule(b)}
                        >
                          {acceptingRescheduleId === b.id ? "Accepting…" : "Accept new time"}
                        </Button>
                        <Button type="button" variant="outlined" onClick={() => openRescheduleRequest(b)}>
                          Propose different time
                        </Button>
                      </div>
                    </>
                  ) : (
                    <p className="booking-section__reschedule-note">
                      Reschedule requested — awaiting counsellor response.
                    </p>
                  )}
                </div>
              )}

              {b.status === "scheduled" && !isSessionEndedPending(b) && !b.rescheduleProposal && (
                <div className="booking-section__extra">
                  <Button type="button" variant="outlined" onClick={() => openRescheduleRequest(b)}>
                    Request reschedule
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      </section>

      {viewingProfile && (
        <CounsellorProfileModal
          profile={viewingProfile}
          status={computeLiveStatus(viewingProfile, scheduledBookings)}
          bookingDisabled={!!activeBooking}
          onBook={() => openConsent(viewingProfile)}
          onClose={() => setViewingProfile(null)}
        />
      )}

      {target && (
        <Modal title="Before you book" className="booking-section__modal" onClose={() => setTarget(null)}>

          {/* ── Step 1: Terms & Conditions ──────────────────────────── */}
          {bookingStep === "terms" && (
            <>
              <div className="booking-section__tnc-body">
                <h3 className="booking-section__tnc-heading">TERMS &amp; CONDITIONS</h3>

                <p>
                  You're requesting a counselling session with{" "}
                  <strong>{target.displayName || target.email}</strong>.
                </p>

                <h4 className="booking-section__tnc-sub">1. Confidentiality</h4>
                <p>
                  Information shared during your counselling session will be treated as confidential and
                  handled with respect for your privacy. Your counsellor will not ordinarily disclose your
                  personal information or session content without your consent.
                </p>
                <p>
                  Confidentiality may have exceptions where disclosure is necessary to protect you or
                  another person from serious harm, where required by law, or where necessary for
                  appropriate professional care.
                </p>

                <h4 className="booking-section__tnc-sub">2. Session Details</h4>
                <ul className="booking-section__tnc-list">
                  <li>Each counselling session is up to 1 hour 30 minutes.</li>
                  <li>You will be asked to provide two preferred time slots while booking.</li>
                  <li>Your counsellor will confirm one of the available slots.</li>
                  <li>Your session is confirmed only after you receive a booking confirmation.</li>
                </ul>

                <h4 className="booking-section__tnc-sub">3. Cancellation &amp; Rescheduling</h4>
                <ul className="booking-section__tnc-list">
                  <li>If you need to cancel or reschedule, please inform us at least 24 hours before your scheduled session.</li>
                  <li>Repeated last-minute cancellations or failure to attend sessions may affect your ability to make future bookings.</li>
                  <li>If you are unable to attend, please notify the counsellor/Wellness Centre as early as possible.</li>
                </ul>

                <h4 className="booking-section__tnc-sub">4. Respectful Conduct</h4>
                <p>Counselling is a safe and respectful space. You are expected to:</p>
                <ul className="booking-section__tnc-list">
                  <li>Communicate respectfully with your counsellor.</li>
                  <li>Avoid abusive, threatening or inappropriate behaviour.</li>
                  <li>Respect the counselling process and professional boundaries.</li>
                </ul>
                <p>
                  Abusive, threatening or seriously inappropriate behaviour may result in termination of the
                  session and may affect future bookings.
                </p>

                <h4 className="booking-section__tnc-sub">5. Data &amp; Privacy</h4>
                <p>
                  Information collected during the booking process, such as your name, contact details
                  and brief reason for seeking counselling, will be used to facilitate and manage your
                  counselling service.
                </p>
                <p>
                  Your information will be handled securely and accessed only by the counsellor and
                  authorised personnel who require access for legitimate service, administrative or safety
                  purposes, in accordance with the organisation's privacy practices and applicable law.
                </p>

                <h4 className="booking-section__tnc-sub">6. Voluntary Participation</h4>
                <p>
                  Counselling is voluntary. You may choose to discontinue or withdraw from a session at any time.
                </p>
                <p>
                  Your counsellor may also recommend additional or specialised professional support if
                  your concerns require care beyond the scope of the service.
                </p>

                <h4 className="booking-section__tnc-sub">7. Emergency Support</h4>
                <p>Counselling appointments are not emergency services.</p>
                <p>
                  If you or someone else is in immediate danger or there is an urgent risk of harm, please
                  seek immediate professional or emergency assistance rather than waiting for your
                  scheduled counselling session.
                </p>
              </div>

              <label className="booking-section__agree">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                />
                <span>
                  I have read and understood the Confidentiality &amp; Terms of Service. I understand that
                  counselling is confidential within applicable professional and legal limits, that sessions
                  are voluntary, and that emergency concerns require immediate professional support. I
                  agree to attend on time, respect the counselling process, and provide accurate
                  information during booking.
                </span>
              </label>

              <div className="booking-section__modal-actions">
                <Button
                  type="button"
                  disabled={!agreed}
                  onClick={() => setBookingStep("form")}
                >
                  Continue →
                </Button>
                <Button type="button" variant="outlined" onClick={() => setTarget(null)}>
                  Cancel
                </Button>
              </div>
            </>
          )}

          {/* ── Step 2: Booking Form ─────────────────────────────────── */}
          {bookingStep === "form" && (
            <>
              <div className="booking-section__step-banner">
                ✅ Terms accepted — please fill in your details below.
              </div>

              <div className="booking-section__field">
                <label htmlFor="booking-name">
                  Name <span className="booking-section__required">*</span>
                </label>
                <input
                  id="booking-name"
                  type="text"
                  required
                  value={nameField}
                  onChange={(e) => setNameField(e.target.value)}
                />
              </div>
              <div className="booking-section__field">
                <label htmlFor="booking-occupation">
                  I am a <span className="booking-section__required">*</span>
                </label>
                <Select
                  id="booking-occupation"
                  value={occupationField}
                  onChange={(v) => setOccupationField(v as "student" | "professional")}
                >
                  <option value="student">Student</option>
                  <option value="professional">Working professional</option>
                </Select>
              </div>
              <div className="booking-section__field">
                <label htmlFor="booking-whatsapp">
                  WhatsApp number <span className="booking-section__required">*</span>
                </label>
                <input
                  id="booking-whatsapp"
                  type="tel"
                  required
                  value={whatsappField}
                  onChange={(e) => setWhatsappField(e.target.value)}
                />
              </div>
              <div className="booking-section__field">
                <label htmlFor="booking-issue">
                  What would you like to talk about? (briefly) <span className="booking-section__required">*</span>
                </label>
                <textarea
                  id="booking-issue"
                  rows={3}
                  required
                  value={issueField}
                  onChange={(e) => setIssueField(e.target.value)}
                />
              </div>
              <div className="booking-section__field">
                <label htmlFor="booking-slot-1">
                  Preferred time — option 1 <span className="booking-section__required">*</span>
                </label>
                <DateTimePicker id="booking-slot-1" min={nowValue()} value={slot1Field} onChange={setSlot1Field} />
              </div>
              <div className="booking-section__field">
                <label htmlFor="booking-slot-2">
                  Preferred time — option 2 <span className="booking-section__required">*</span>
                </label>
                <DateTimePicker id="booking-slot-2" min={nowValue()} value={slot2Field} onChange={setSlot2Field} />
              </div>
              {slot1Field && slot2Field && slot1Field === slot2Field && (
                <p className="booking-section__legal-note">Please pick two different times.</p>
              )}

              <div className="booking-section__modal-actions">
                <Button type="button" disabled={!formValid || submitting} onClick={confirmBooking}>
                  {submitting ? "Booking…" : "Confirm Booking"}
                </Button>
                <Button type="button" variant="outlined" onClick={() => setBookingStep("terms")}>
                  ← Back
                </Button>
              </div>
            </>
          )}

        </Modal>
      )}

      {cancelTarget && (
        <Modal title="Cancel this booking" onClose={() => setCancelTarget(null)}>
          <div className="booking-section__field">
            <label htmlFor="cancel-reason">Why are you cancelling?</label>
            <textarea
              id="cancel-reason"
              rows={3}
              value={cancelReasonField}
              onChange={(e) => setCancelReasonField(e.target.value)}
            />
          </div>
          <div className="booking-section__modal-actions">
            <Button type="button" disabled={!cancelReasonField.trim() || cancelling} onClick={confirmCancel}>
              {cancelling ? "Cancelling…" : "Confirm cancellation"}
            </Button>
            <Button type="button" variant="outlined" onClick={() => setCancelTarget(null)}>
              Back
            </Button>
          </div>
        </Modal>
      )}


      {rescheduleTarget && (
        <Modal title="Request a reschedule" onClose={() => setRescheduleTarget(null)}>
          <p>
            Propose a new time for your session with <strong>{rescheduleTarget.counsellorEmail}</strong>. They'll be
            able to accept it or propose a different time back.
          </p>
          <div className="booking-section__field">
            <label htmlFor="reschedule-time">New proposed time</label>
            <DateTimePicker id="reschedule-time" min={nowValue()} value={rescheduleTimeField} onChange={setRescheduleTimeField} />
          </div>
          <div className="booking-section__field">
            <label htmlFor="reschedule-reason">Reason (optional)</label>
            <textarea
              id="reschedule-reason"
              rows={3}
              value={rescheduleReasonField}
              onChange={(e) => setRescheduleReasonField(e.target.value)}
            />
          </div>
          <div className="booking-section__modal-actions">
            <Button
              type="button"
              disabled={!rescheduleTimeField || requestingReschedule}
              onClick={confirmRescheduleRequest}
            >
              {requestingReschedule ? "Sending…" : "Send reschedule request"}
            </Button>
            <Button type="button" variant="outlined" onClick={() => setRescheduleTarget(null)}>
              Back
            </Button>
          </div>
        </Modal>
      )}

      {ratingTarget && (
        <Modal title="Rate Your Session" onClose={() => setRatingTarget(null)}>
          <p style={{ margin: "0 0 16px 0", fontSize: "14px", color: "var(--neu-text-body, #4A5568)" }}>
            How was your session with <strong>{ratingTarget.counsellorEmail}</strong>?
          </p>

          <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 20px 0" }}>
            <StarRating value={ratingValue} size="large" onChange={setRatingValue} />
          </div>

          <div className="booking-section__field">
            <label htmlFor="rating-review">Review / Feedback (optional)</label>
            <textarea
              id="rating-review"
              rows={3}
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              placeholder="Share your experience with this session..."
            />
          </div>

          <div style={{ margin: "14px 0 20px 0", display: "flex", justifyContent: "center" }}>
            <a
              href="https://docs.google.com/forms/d/e/1FAIpQLSe7qZzROzrkRwTozn-4alXrJvWtFt2FboI052tEGBk82O-SUg/viewform"
              target="_blank"
              rel="noopener noreferrer"
              className="booking-section__feedback-link"
            >
              Open Detailed Feedback Form ↗
            </a>
          </div>

          <div className="booking-section__modal-actions">
            <Button
              type="button"
              disabled={ratingValue === 0 || submittingRating}
              onClick={async () => {
                setSubmittingRating(true);
                try {
                  await rateCounsellor(ratingTarget.id, ratingValue, reviewText.trim() || undefined);
                  setRatingTarget(null);
                  await refresh();
                } finally {
                  setSubmittingRating(false);
                }
              }}
            >
              {submittingRating ? "Submitting…" : "Submit Rating"}
            </Button>
            <Button type="button" variant="outlined" onClick={() => setRatingTarget(null)}>
              Cancel
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

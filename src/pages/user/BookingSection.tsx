import { useEffect, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import {
  listBookableProfiles,
  listBookingsForUser,
  listScheduledBookings,
  createBooking,
  cancelBooking,
  rateCounsellor,
  requestReschedule,
  acceptRescheduleProposal,
  isSessionEndedPending,
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
  const [submitting, setSubmitting] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<Booking | null>(null);
  const [cancelReasonField, setCancelReasonField] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [rateTarget, setRateTarget] = useState<Booking | null>(null);
  const [rateValue, setRateValue] = useState(0);
  const [rateReviewText, setRateReviewText] = useState("");
  const [rating, setRating] = useState(false);

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

  async function confirmRating() {
    if (!rateTarget || rateValue === 0) return;
    setRating(true);
    try {
      await rateCounsellor(rateTarget.id, rateValue, rateReviewText.trim() || undefined);
      setRateTarget(null);
      await refresh();
    } finally {
      setRating(false);
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
                {b.status === "completed" &&
                  (b.userRatingOfCounsellor !== undefined ? (
                    <StarRating value={b.userRatingOfCounsellor} />
                  ) : (
                    <Button
                      type="button"
                      variant="outlined"
                      onClick={() => {
                        setRateTarget(b);
                        setRateValue(0);
                        setRateReviewText("");
                      }}
                    >
                      Rate this session
                    </Button>
                  ))}
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
        <Modal title="Before you book" onClose={() => setTarget(null)}>
          <p>
            You're requesting a session with <strong>{target.displayName || target.email}</strong>. Each
            session runs {SESSION_DURATION_LABEL}. The details you share are confidential —
            they will not be shared with or disclosed to any other party.
          </p>
          <p className="booking-section__legal-note">
            (Placeholder terms — replace with your actual confidentiality policy / terms &amp; conditions.)
          </p>

          <div className="booking-section__field">
            <label htmlFor="booking-name">Name</label>
            <input id="booking-name" type="text" value={nameField} onChange={(e) => setNameField(e.target.value)} />
          </div>
          <div className="booking-section__field">
            <label htmlFor="booking-occupation">I am a</label>
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
            <label htmlFor="booking-whatsapp">WhatsApp number</label>
            <input
              id="booking-whatsapp"
              type="tel"
              value={whatsappField}
              onChange={(e) => setWhatsappField(e.target.value)}
            />
          </div>
          <div className="booking-section__field">
            <label htmlFor="booking-issue">What would you like to talk about?</label>
            <textarea
              id="booking-issue"
              rows={3}
              value={issueField}
              onChange={(e) => setIssueField(e.target.value)}
            />
          </div>
          <div className="booking-section__field">
            <label htmlFor="booking-slot-1">Preferred time — option 1</label>
            <DateTimePicker id="booking-slot-1" min={nowValue()} value={slot1Field} onChange={setSlot1Field} />
          </div>
          <div className="booking-section__field">
            <label htmlFor="booking-slot-2">Preferred time — option 2</label>
            <DateTimePicker id="booking-slot-2" min={nowValue()} value={slot2Field} onChange={setSlot2Field} />
          </div>
          {slot1Field && slot2Field && slot1Field === slot2Field && (
            <p className="booking-section__legal-note">Please pick two different times.</p>
          )}

          <label className="booking-section__agree">
            <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
            I have read and agree to the confidentiality terms and conditions.
          </label>
          <div className="booking-section__modal-actions">
            <Button type="button" disabled={!formValid || submitting} onClick={confirmBooking}>
              {submitting ? "Booking…" : "Confirm booking"}
            </Button>
            <Button type="button" variant="outlined" onClick={() => setTarget(null)}>
              Cancel
            </Button>
          </div>
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

      {rateTarget && (
        <Modal title="Rate this session" onClose={() => setRateTarget(null)}>
          <p>
            How was your session with <strong>{rateTarget.counsellorEmail}</strong>?
          </p>
          <StarRating value={rateValue} onChange={setRateValue} size="large" />
          <div className="booking-section__field">
            <label htmlFor="review-text">Leave a review (optional, shown publicly without your name)</label>
            <textarea
              id="review-text"
              rows={3}
              value={rateReviewText}
              onChange={(e) => setRateReviewText(e.target.value)}
            />
          </div>
          <div className="booking-section__modal-actions">
            <Button type="button" disabled={rateValue === 0 || rating} onClick={confirmRating}>
              {rating ? "Submitting…" : "Submit rating"}
            </Button>
            <Button type="button" variant="outlined" onClick={() => setRateTarget(null)}>
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
    </div>
  );
}

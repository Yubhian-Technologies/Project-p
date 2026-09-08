import { useEffect, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import {
  listBookableProfiles,
  listBookingsForUser,
  listScheduledBookings,
  createBooking,
  cancelBooking,
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
import "./BookingSection.css";

const ACTIVE_STATUSES = ["pending", "accepted", "scheduled"];

function statusLabel(booking: Booking): string {
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
      return booking.outcome === "followup" ? "Completed — follow-up scheduled" : "Completed";
  }
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

  const activeBooking = bookings.find((b) => ACTIVE_STATUSES.includes(b.status));

  function openConsent(counsellor: UserProfile) {
    setViewingProfile(null);
    setTarget(counsellor);
    setAgreed(false);
    setNameField(profile?.displayName ?? "");
    setOccupationField(profile?.studentOrProfessional ?? "student");
    setWhatsappField(profile?.whatsappNumber ?? "");
    setIssueField("");
  }

  const formValid = nameField.trim() && whatsappField.trim() && issueField.trim() && agreed;

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
      await createBooking({ uid: currentUser.uid, email: profile.email }, { uid: target.uid, email: target.email }, intake);
      setTarget(null);
      await refresh();
    } finally {
      setSubmitting(false);
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
                <span className={`booking-section__status booking-section__status--${b.status}`}>
                  {statusLabel(b)}
                </span>
                {ACTIVE_STATUSES.includes(b.status) && (
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
    </div>
  );
}

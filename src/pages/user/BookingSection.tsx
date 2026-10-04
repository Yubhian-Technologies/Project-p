import { useEffect, useMemo, useRef, useState } from "react";
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
  getBookingIntake,
  respondToCompensationOffer,
  SESSION_DURATION_LABEL,
} from "../../services/firebase/bookings";
import { listFeedbackForUser, createSessionFeedback } from "../../services/firebase/feedback";
import { subscribeToNotifications } from "../../services/firebase/notifications";
import { listSsiResultsForUser, submitSsiResult } from "../../services/firebase/ssiTest";
import { sanitizePhoneInput, isValidWhatsappNumber } from "../../utils/phone";
import { FEEDBACK_FORM } from "../../config/feedbackForm";
import type { UserProfile } from "../../types/user";
import type { Booking, BookingIntake } from "../../types/booking";
import { computeLiveStatus } from "../../utils/counsellorStatus";
import { CounsellorProfileModal } from "../../components/booking/CounsellorProfileModal";
import { SsiTestModal } from "../../components/booking/SsiTestModal";
import { Card } from "../../components/common/Card";
import { Button } from "../../components/common/Button";
import { Modal } from "../../components/common/Modal";
import { Select } from "../../components/common/Select";
import { DateTimePicker } from "../../components/common/DateTimePicker";
import { StarRating } from "../../components/common/StarRating";
import { ChatModal } from "../../components/chat/ChatModal";
import { SessionResourcesPanel } from "../../components/resources/SessionResourcesPanel";
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
      return booking.isEmergency ? "Accepted — being handled directly, no session time needed" : "Accepted — time coming soon";
    case "scheduled":
      return `Scheduled for ${booking.scheduledAt ? new Date(booking.scheduledAt).toLocaleString() : "—"} (${SESSION_DURATION_LABEL})`;
    case "rejected":
      return "Rejected";
    case "cancelled":
      return `Cancelled by ${booking.cancelledBy === "user" ? "you" : "the counsellor"}${booking.cancellationReason ? `: ${booking.cancellationReason}` : ""}`;
    case "completed":
      if (booking.outcome === "missed") {
        const compHint = booking.compensationOffer
          ? booking.compensationOffer.status === "pending"
            ? " — compensation session offered"
            : booking.compensationOffer.status === "accepted"
              ? " — compensation session accepted"
              : " — compensation declined"
          : "";
        return `Missed${booking.missedReason ? `: ${booking.missedReason}` : ""}${compHint}`;
      }
      return booking.outcome === "followup" ? "Completed — follow-up scheduled" : "Completed";
  }
}

function statusClass(booking: Booking): string {
  if (booking.status === "scheduled" && isSessionEndedPending(booking)) return "missed";
  if (booking.status === "completed" && booking.outcome === "missed") return "missed";
  return booking.status;
}

// One word for the collapsed row — the full explanation (time, reason, etc.) only
// shows once the person opens View Details.
function statusWord(booking: Booking): string {
  const word = statusClass(booking);
  return word.charAt(0).toUpperCase() + word.slice(1);
}

// The day a session actually falls on, used by the date filter and the date
// shown on each row: the confirmed time once there is one, the newly proposed
// time while a reschedule is being negotiated, otherwise the first slot the
// student asked for — and for a Crisis SOS (which never carries a time), the
// day they asked for help.
function sessionTimestamp(booking: Booking): number {
  return (
    booking.scheduledAt ??
    booking.rescheduleProposal?.proposedAt ??
    booking.proposedSlots?.[0] ??
    booking.createdAt
  );
}

function dateKey(timestamp: number): string {
  const d = new Date(timestamp);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function formatDay(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function BookingSection({
  openChatBookingId,
  onChatOpened,
  openSsiBookingId,
  onSsiOpened,
  openResourceBookingId,
  onResourceOpened,
  openCompensationBookingId,
  onCompensationOpened,
}: {
  openChatBookingId?: string;
  onChatOpened?: () => void;
  openSsiBookingId?: string;
  onSsiOpened?: () => void;
  openResourceBookingId?: string;
  onResourceOpened?: () => void;
  openCompensationBookingId?: string;
  onCompensationOpened?: () => void;
}) {
  const { currentUser, profile } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [scheduledBookings, setScheduledBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewingProfile, setViewingProfile] = useState<UserProfile | null>(null);
  const [target, setTarget] = useState<UserProfile | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [bookingStep, setBookingStep] = useState<"terms" | "form">("terms");
  const [submitting, setSubmitting] = useState(false);
  const [bookingError, setBookingError] = useState("");
  const [cancelTarget, setCancelTarget] = useState<Booking | null>(null);
  const [cancelReasonField, setCancelReasonField] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [submittedFeedbackIds, setSubmittedFeedbackIds] = useState<Set<string>>(new Set());
  const [feedbackBooking, setFeedbackBooking] = useState<Booking | null>(null);
  const [feedbackAnswers, setFeedbackAnswers] = useState<Record<string, string>>({});
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  // Shared by every one-off action below (reschedule, cancel, accept
  // reschedule, compensation accept/decline) — these previously had
  // try/finally with no catch, so a failure silently reset the button with
  // no explanation at all instead of surfacing anything here.
  const [actionError, setActionError] = useState("");

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
  const [chatTarget, setChatTarget] = useState<Booking | null>(null);
  const [detailTarget, setDetailTarget] = useState<Booking | null>(null);
  const [summaryModalTarget, setSummaryModalTarget] = useState<Booking | null>(null);
  const [ssiSubmittedIds, setSsiSubmittedIds] = useState<Set<string>>(new Set());
  const [ssiTarget, setSsiTarget] = useState<Booking | null>(null);
  const [respondingToCompensation, setRespondingToCompensation] = useState(false);
  const [ssiIntakeWhatsapp, setSsiIntakeWhatsapp] = useState("");
  // "YYYY-MM-DD" of the session day to show, or "" for every booking.
  const [sessionDateFilter, setSessionDateFilter] = useState("");

  async function openSsiTest(b: Booking) {
    setSsiTarget(b);
    setSsiIntakeWhatsapp("");
    try {
      const intake = await getBookingIntake(b.id);
      setSsiIntakeWhatsapp(intake?.whatsappNumber ?? "");
    } catch {
      setSsiIntakeWhatsapp("");
    }
  }

  async function refresh() {
    if (!currentUser) return;
    const [, userBookings, liveBookings, feedback, ssiResults] = await Promise.all([
      listBookableProfiles(),
      listBookingsForUser(currentUser.uid),
      listScheduledBookings(),
      listFeedbackForUser(currentUser.uid).catch(() => []),
      listSsiResultsForUser(currentUser.uid).catch(() => []),
    ]);
    setBookings(userBookings);
    setScheduledBookings(liveBookings);
    setSubmittedFeedbackIds(new Set(feedback.map((f) => f.bookingId)));
    setSsiSubmittedIds(new Set(ssiResults.map((r) => r.bookingId)));
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, [currentUser]);

  // The bookings list above is a one-off fetch, not a live listener — so when
  // the counsellor/head accepts, schedules, or otherwise changes a booking on
  // their own device, this tab never hears about it and keeps showing the old
  // status until the page is reloaded. Notifications ARE already a live
  // stream (subscribeToNotifications uses onSnapshot), and every one of those
  // actions sends the student a notification, so re-fetching bookings
  // whenever a genuinely new notification arrives keeps this list current
  // without needing its own realtime listener.
  const seenNotificationIds = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!currentUser) return;
    return subscribeToNotifications(currentUser.uid, (list) => {
      const ids = new Set(list.map((n) => n.id));
      if (seenNotificationIds.current === null) {
        seenNotificationIds.current = ids;
        return;
      }
      const hasNew = list.some((n) => !seenNotificationIds.current!.has(n.id));
      seenNotificationIds.current = ids;
      if (hasNew) refresh();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

  // Keep the open "View Details" popup in step with the list — e.g. after a
  // cancel or an accepted reschedule changes the booking underneath it.
  useEffect(() => {
    setDetailTarget((prev) => (prev ? bookings.find((b) => b.id === prev.id) ?? null : prev));
  }, [bookings]);

  // Open a chat thread directly when the user taps a "chat_message" notification.
  useEffect(() => {
    if (!openChatBookingId) return;
    const booking = bookings.find((b) => b.id === openChatBookingId);
    if (booking) {
      setChatTarget(booking);
      onChatOpened?.();
    }
  }, [openChatBookingId, bookings, onChatOpened]);

  // Open the SSI test directly when the user taps an "ssi_suggested" notification.
  useEffect(() => {
    if (!openSsiBookingId) return;
    const booking = bookings.find((b) => b.id === openSsiBookingId);
    if (booking) {
      openSsiTest(booking);
      onSsiOpened?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openSsiBookingId, bookings, onSsiOpened]);

  // Open the booking detail so the student can accept/decline a compensation
  // offer when they tap a "compensation_offered" notification.
  useEffect(() => {
    if (!openCompensationBookingId) return;
    const booking = bookings.find((b) => b.id === openCompensationBookingId);
    if (booking) {
      setDetailTarget(booking);
      onCompensationOpened?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openCompensationBookingId, bookings, onCompensationOpened]);

  // Open the booking detail (where session resources live) when the user taps
  // a "session_resource_added" notification.
  useEffect(() => {
    if (!openResourceBookingId) return;
    const booking = bookings.find((b) => b.id === openResourceBookingId);
    if (booking) {
      setDetailTarget(booking);
      onResourceOpened?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openResourceBookingId, bookings, onResourceOpened]);

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
    setBookingError("");
  }

  const formValid =
    nameField.trim() &&
    isValidWhatsappNumber(whatsappField) &&
    issueField.trim() &&
    agreed &&
    slot1Field &&
    slot2Field &&
    slot1Field !== slot2Field;

  async function confirmBooking() {
    if (!currentUser || !profile || !target || !formValid) return;
    setSubmitting(true);
    setBookingError("");
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
    } catch (err) {
      // Most likely cause: a second tab (or a stale page) let the form get
      // this far while another booking of theirs became active in the
      // meantime — the server is the one that actually catches that now.
      const message = err instanceof Error ? err.message : "Couldn't submit your booking. Please try again.";
      setBookingError(message);
      await refresh();
    } finally {
      setSubmitting(false);
    }
  }

  function openRescheduleRequest(booking: Booking) {
    setRescheduleTarget(booking);
    setRescheduleTimeField("");
    setRescheduleReasonField("");
    setActionError("");
  }

  async function confirmRescheduleRequest() {
    if (!rescheduleTarget || !rescheduleTimeField) return;
    setRequestingReschedule(true);
    setActionError("");
    try {
      await requestReschedule(
        rescheduleTarget,
        "user",
        new Date(rescheduleTimeField).getTime(),
        rescheduleReasonField.trim() || undefined,
      );
      setRescheduleTarget(null);
      await refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Couldn't send the reschedule request. Please try again.");
    } finally {
      setRequestingReschedule(false);
    }
  }

  async function handleAcceptReschedule(booking: Booking) {
    setAcceptingRescheduleId(booking.id);
    setActionError("");
    try {
      await acceptRescheduleProposal(booking);
      await refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Couldn't accept the new time. Please try again.");
    } finally {
      setAcceptingRescheduleId(null);
    }
  }

  async function confirmCancel() {
    if (!cancelTarget || !cancelReasonField.trim()) return;
    setCancelling(true);
    setActionError("");
    try {
      await cancelBooking(cancelTarget, "user", cancelReasonField.trim());
      setCancelTarget(null);
      await refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Couldn't cancel this booking. Please try again.");
    } finally {
      setCancelling(false);
    }
  }

  function openFeedback(booking: Booking) {
    setFeedbackBooking(booking);
    setFeedbackAnswers({});
    setFeedbackError(null);
  }

  const feedbackRequiredMissing = FEEDBACK_FORM.questions.some(
    (q) => q.required && !(feedbackAnswers[q.id]?.trim()),
  );

  // Only the days that actually have a session on them — so the filter offers
  // real dates to tap rather than an empty date picker.
  const bookedDates = useMemo(() => {
    const counts = new Map<string, number>();
    for (const b of bookings) {
      const key = dateKey(sessionTimestamp(b));
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .map(([key, count]) => {
        const d = new Date(`${key}T00:00:00`);
        return {
          key,
          count,
          weekday: d.toLocaleDateString(undefined, { weekday: "short" }),
          dayMonth: d.toLocaleDateString(undefined, { day: "numeric", month: "short" }),
        };
      });
  }, [bookings]);

  const filteredBookings = sessionDateFilter
    ? bookings
        .filter((b) => dateKey(sessionTimestamp(b)) === sessionDateFilter)
        .sort((a, b) => sessionTimestamp(a) - sessionTimestamp(b))
    : bookings;

  async function submitFeedback() {
    const feedbackBookingRef = feedbackBooking;
    const overallRating = Number(feedbackAnswers["overall"] ?? 0);
    if (!feedbackBookingRef || !Number.isFinite(overallRating) || overallRating < 1 || overallRating > 5) {
      setFeedbackError("Please complete all required questions.");
      return;
    }
    setSubmittingFeedback(true);
    setFeedbackError(null);
    try {
      const answers = FEEDBACK_FORM.questions
        .map((q) => ({ q, value: feedbackAnswers[q.id]?.trim() ?? "" }))
        .filter(({ value }) => value.length > 0)
        .map(({ q, value }) => ({ label: q.label, value }));
      const bookingId = await createSessionFeedback(feedbackBookingRef, overallRating, answers);
      setSubmittedFeedbackIds((prev) => {
        const next = new Set(prev);
        next.add(bookingId);
        return next;
      });
      setFeedbackBooking(null);
    } catch {
      setFeedbackError("Couldn't save your feedback. Please try again.");
    } finally {
      setSubmittingFeedback(false);
    }
  }

  if (loading) return null;

  return (
    <div className="booking-section">
      <section>
        <h2 className="booking-section__heading">My Bookings</h2>
        {bookings.length === 0 && <p>You haven't requested a session yet.</p>}
        {bookings.length > 0 && (
          <div className="booking-section__date-filter">
            <div className="booking-section__date-filter-field">
              <span className="booking-section__date-filter-label">Session date</span>
              <Select
                id="booking-date-filter"
                value={sessionDateFilter}
                onChange={setSessionDateFilter}
              >
                <option value="">All dates</option>
                {bookedDates.map((d) => (
                  <option key={d.key} value={d.key}>
                    {d.weekday}, {d.dayMonth} · {d.count} session{d.count === 1 ? "" : "s"}
                  </option>
                ))}
              </Select>
            </div>
            <span className="booking-section__filter-count">
              {sessionDateFilter
                ? `${filteredBookings.length} of ${bookings.length} on this date`
                : `${bookings.length} total`}
            </span>
          </div>
        )}
        <div className="booking-section__bookings">
          {filteredBookings.map((b) => (
            <Card
              key={b.id}
              className="booking-section__booking-row booking-section__booking-row--collapsed"
              onClick={() => setDetailTarget(b)}
            >
              <span className="booking-section__row-email">
                {b.counsellorEmail}
                {b.isEmergency && <span className="booking-section__emergency-tag">Crisis SOS</span>}
                {b.followUpOfBookingId && <span className="booking-section__followup-tag">(follow-up)</span>}
              </span>
              <span className="booking-section__row-date">{formatDay(sessionTimestamp(b))}</span>
              <div className="booking-section__row-right booking-section__row-right--pinned">
                <span className={`booking-section__status booking-section__status--${statusClass(b)}`}>
                  {statusWord(b)}
                </span>
                <Button
                  type="button"
                  variant="outlined"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDetailTarget(b);
                  }}
                >
                  View Details
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* ── Booking Details popup ────────────────────────────────────────
          Everything about one booking — the full status, and every action
          for it — lives here instead of in the row, so the list stays short. */}
      {detailTarget && (
        <Modal
          title={detailTarget.counsellorEmail}
          onClose={() => setDetailTarget(null)}
          className="booking-section__detail-modal"
        >
          <div className="booking-section__detail">
            {detailTarget.isEmergency && (
              <p className="booking-section__emergency-tag">
                🚨 Crisis SOS — dispatched to every counsellor/head on your campus; whoever accepts it
                doesn't pick a time first, since a crisis is handled right away, not scheduled.
              </p>
            )}
            {detailTarget.followUpOfBookingId && (
              <p className="booking-section__followup-tag">(follow-up session)</p>
            )}

            <span className={`booking-section__status booking-section__status--${statusClass(detailTarget)}`}>
              {statusLabel(detailTarget)}
            </span>

            {detailTarget.sharedSummary && (
              <Button type="button" variant="outlined" onClick={() => setSummaryModalTarget(detailTarget)}>
                View Summary
              </Button>
            )}

            <SessionResourcesPanel
              bookingId={detailTarget.id}
              userId={detailTarget.userId}
              counsellorId={detailTarget.counsellorId}
              campusId={detailTarget.campusId}
              canManage={false}
              author={null}
            />

            {detailTarget.status === "pending" && detailTarget.proposedSlots && (
              <div className="booking-section__extra">
                Proposed times: {new Date(detailTarget.proposedSlots[0]).toLocaleString()} or{" "}
                {new Date(detailTarget.proposedSlots[1]).toLocaleString()}
              </div>
            )}

            {detailTarget.status === "scheduled" &&
              !isSessionEndedPending(detailTarget) &&
              detailTarget.rescheduleProposal && (
                <div className="booking-section__extra">
                  {detailTarget.rescheduleProposal.proposedBy === "counsellor" ? (
                    <>
                      <p className="booking-section__reschedule-note">
                        Counsellor proposed a new time:{" "}
                        {new Date(detailTarget.rescheduleProposal.proposedAt).toLocaleString()}
                        {detailTarget.rescheduleProposal.reason ? ` — ${detailTarget.rescheduleProposal.reason}` : ""}
                      </p>
                      <div className="booking-section__row-right">
                        <Button
                          type="button"
                          disabled={acceptingRescheduleId === detailTarget.id}
                          onClick={() => handleAcceptReschedule(detailTarget)}
                        >
                          {acceptingRescheduleId === detailTarget.id ? "Accepting…" : "Accept new time"}
                        </Button>
                        <Button type="button" variant="outlined" onClick={() => openRescheduleRequest(detailTarget)}>
                          Propose different time
                        </Button>
                      </div>
                      {actionError && <p className="booking-section__field-hint">{actionError}</p>}
                    </>
                  ) : (
                    <p className="booking-section__reschedule-note">
                      Reschedule requested — awaiting counsellor response.
                    </p>
                  )}
                </div>
              )}

            {detailTarget.status === "scheduled" &&
              !isSessionEndedPending(detailTarget) &&
              !detailTarget.rescheduleProposal && (
                <div className="booking-section__extra">
                  <Button type="button" variant="outlined" onClick={() => openRescheduleRequest(detailTarget)}>
                    Request reschedule
                  </Button>
                </div>
              )}

            {detailTarget.status === "completed" &&
              detailTarget.outcome === "missed" &&
              detailTarget.compensationOffer?.status === "pending" && (
                <div className="booking-section__extra">
                  <p className="booking-section__reschedule-note">
                    Your session with {detailTarget.counsellorEmail} was missed — the Wellness Centre has offered
                    you a compensation session. Would you like to accept?
                  </p>
                  <div className="booking-section__row-right">
                    <Button
                      type="button"
                      disabled={respondingToCompensation}
                      onClick={async () => {
                        setRespondingToCompensation(true);
                        setActionError("");
                        try {
                          await respondToCompensationOffer(detailTarget, true);
                          await refresh();
                        } catch (err) {
                          setActionError(
                            err instanceof Error ? err.message : "Couldn't record your answer. Please try again.",
                          );
                        } finally {
                          setRespondingToCompensation(false);
                        }
                      }}
                    >
                      Accept
                    </Button>
                    <Button
                      type="button"
                      variant="outlined"
                      disabled={respondingToCompensation}
                      onClick={async () => {
                        setRespondingToCompensation(true);
                        setActionError("");
                        try {
                          await respondToCompensationOffer(detailTarget, false);
                          await refresh();
                        } catch (err) {
                          setActionError(
                            err instanceof Error ? err.message : "Couldn't record your answer. Please try again.",
                          );
                        } finally {
                          setRespondingToCompensation(false);
                        }
                      }}
                    >
                      Decline
                    </Button>
                  </div>
                  {actionError && <p className="booking-section__field-hint">{actionError}</p>}
                </div>
              )}

            {detailTarget.status === "completed" &&
              detailTarget.outcome === "missed" &&
              detailTarget.compensationOffer?.status === "accepted" &&
              !detailTarget.compensationOffer.compensationBookingId && (
                <p className="booking-section__reschedule-note">
                  You accepted — waiting for the Wellness Centre to schedule your compensation session.
                </p>
              )}

            <div className="booking-section__row-right">
              <Button type="button" variant="outlined" onClick={() => setChatTarget(detailTarget)}>
                Chat
              </Button>

              {(detailTarget.status === "accepted" ||
                (detailTarget.status === "scheduled" && !isSessionEndedPending(detailTarget))) &&
                (ssiSubmittedIds.has(detailTarget.id) ? (
                  <span className="booking-section__ssi-chip">✓ SSI test submitted</span>
                ) : (
                  <Button type="button" variant="outlined" onClick={() => openSsiTest(detailTarget)}>
                    Take SSI Test
                  </Button>
                ))}

              {ACTIVE_STATUSES.includes(detailTarget.status) && !isSessionEndedPending(detailTarget) && (
                <Button
                  type="button"
                  variant="outlined"
                  onClick={() => {
                    setCancelTarget(detailTarget);
                    setCancelReasonField("");
                    setActionError("");
                  }}
                >
                  Cancel
                </Button>
              )}

              {detailTarget.status === "completed" && detailTarget.outcome !== "missed" && (
                <div className="booking-section__rating-feedback-block">
                  {submittedFeedbackIds.has(detailTarget.id) ? (
                    <div className="booking-section__rated-box">
                      <span className="booking-section__feedback-submitted">✓ Feedback submitted</span>
                    </div>
                  ) : (
                    <Button type="button" onClick={() => openFeedback(detailTarget)}>
                      Take Feedback
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}

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
                  inputMode="numeric"
                  required
                  value={whatsappField}
                  onChange={(e) => setWhatsappField(sanitizePhoneInput(e.target.value))}
                />
                {whatsappField && !isValidWhatsappNumber(whatsappField) && (
                  <p className="booking-section__field-hint">
                    Enter a valid 10-digit mobile number (e.g. 98765 43210 or +91 98765 43210).
                  </p>
                )}
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
              {bookingError && <p className="booking-section__field-hint">{bookingError}</p>}

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
          {actionError && <p className="booking-section__field-hint">{actionError}</p>}
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
          {actionError && <p className="booking-section__field-hint">{actionError}</p>}
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

      {chatTarget && currentUser && profile && (
        <ChatModal
          chatRoomId={chatTarget.id}
          bookingId={chatTarget.id}
          counterpartName={chatTarget.counsellorEmail}
          counterpartRole="counsellor"
          currentUser={{
            uid: currentUser.uid,
            email: profile.email,
            displayName: profile.displayName,
            role: profile.role,
          }}
          onClose={() => setChatTarget(null)}
        />
      )}

      {feedbackBooking && (
        <Modal title={FEEDBACK_FORM.title} className="booking-section__feedback-modal" onClose={() => setFeedbackBooking(null)}>
          <p className="booking-section__feedback-intro">{FEEDBACK_FORM.intro}</p>
          <p className="booking-section__feedback-counsellor">
            Session with <strong>{feedbackBooking.counsellorEmail}</strong>
          </p>

          {FEEDBACK_FORM.questions.map((q) => (
            <div key={q.id} className="booking-section__feedback-field">
              <span className="booking-section__feedback-label">
                {q.label} {q.required && <span className="booking-section__required">*</span>}
              </span>
              {q.kind === "rating" && (
                <StarRating
                  value={Number(feedbackAnswers[q.id] ?? 0)}
                  onChange={(v) => setFeedbackAnswers((prev) => ({ ...prev, [q.id]: String(v) }))}
                />
              )}
              {q.kind === "choice" && (
                <div className="booking-section__feedback-options">
                  {q.options?.map((option) => {
                    const selected = feedbackAnswers[q.id] === option;
                    return (
                      <button
                        key={option}
                        type="button"
                        aria-pressed={selected}
                        className={`booking-section__feedback-option${selected ? " booking-section__feedback-option--active" : ""}`}
                        onClick={() => setFeedbackAnswers((prev) => ({ ...prev, [q.id]: option }))}
                      >
                        {option}
                      </button>
                    );
                  })}
                </div>
              )}
              {q.kind === "text" && (
                <textarea
                  rows={3}
                  value={feedbackAnswers[q.id] ?? ""}
                  placeholder={q.placeholder}
                  onChange={(e) => setFeedbackAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                />
              )}
            </div>
          ))}

          {feedbackError && (
            <p role="alert" className="booking-section__feedback-error">
              {feedbackError}
            </p>
          )}

          <div className="booking-section__modal-actions">
            <Button
              type="button"
              disabled={feedbackRequiredMissing || submittingFeedback}
              onClick={submitFeedback}
            >
              {submittingFeedback ? "Submitting…" : FEEDBACK_FORM.submitLabel}
            </Button>
            <Button type="button" variant="outlined" onClick={() => setFeedbackBooking(null)}>
              Cancel
            </Button>
          </div>
        </Modal>
      )}

      {ssiTarget && profile && (
        <SsiTestModal
          booking={ssiTarget}
          profile={profile}
          initialWhatsappNumber={ssiIntakeWhatsapp}
          onSubmit={async (input) => {
            await submitSsiResult(input);
            setSsiSubmittedIds((prev) => new Set(prev).add(ssiTarget.id));
            await refresh();
          }}
          onClose={() => setSsiTarget(null)}
        />
      )}

      {summaryModalTarget && (
        <Modal title="Session Notes from Your Counsellor" onClose={() => setSummaryModalTarget(null)}>
          <div className="booking-section__shared-summary">
            <p className="booking-section__shared-summary-body">{summaryModalTarget.sharedSummary}</p>
            {summaryModalTarget.sharedSummaryAt && (
              <span className="booking-section__shared-summary-date">
                Shared on {new Date(summaryModalTarget.sharedSummaryAt).toLocaleString()}
              </span>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}

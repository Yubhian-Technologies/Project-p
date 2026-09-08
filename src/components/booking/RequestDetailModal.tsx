import { useEffect, useState } from "react";
import { Modal } from "../common/Modal";
import { Button } from "../common/Button";
import { Select } from "../common/Select";
import { DateTimePicker } from "../common/DateTimePicker";
import { StarRating } from "../common/StarRating";
import { getBookingIntake, SESSION_DURATION_LABEL } from "../../services/firebase/bookings";
import type { Booking, BookingIntake } from "../../types/booking";
import type { UserProfile } from "../../types/user";
import "./RequestCard.css";

function toDateTimeLocalValue(epochMs: number): string {
  const d = new Date(epochMs);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function isPastOrEmpty(value: string): boolean {
  return !value || new Date(value).getTime() <= Date.now();
}

function isPastChoice(value: string): boolean {
  return !!value && new Date(value).getTime() <= Date.now();
}

interface RequestDetailModalProps {
  booking: Booking;
  transferCandidates: UserProfile[];
  onAccept: () => void;
  onReject: () => void;
  onSchedule: (scheduledAt: number) => void;
  onCancel: (reason: string) => void;
  onTransfer: (target: UserProfile) => void;
  onSaveSummary: (summary: string) => Promise<void>;
  onCloseComplete: (summary: string) => Promise<void>;
  onCloseFollowUp: (summary: string, scheduledAt: number) => Promise<void>;
  onRateUser: (rating: number, note: string) => void;
  onViewSummary?: () => void;
  onClose: () => void;
}

export function RequestDetailModal({
  booking,
  transferCandidates,
  onAccept,
  onReject,
  onSchedule,
  onCancel,
  onTransfer,
  onSaveSummary,
  onCloseComplete,
  onCloseFollowUp,
  onRateUser,
  onViewSummary,
  onClose,
}: RequestDetailModalProps) {
  const [editingTime, setEditingTime] = useState(false);
  const [timeValue, setTimeValue] = useState(
    booking.scheduledAt ? toDateTimeLocalValue(booking.scheduledAt) : "",
  );
  const [intake, setIntake] = useState<BookingIntake | null>(null);
  const [showTransfer, setShowTransfer] = useState(false);
  const [transferTargetId, setTransferTargetId] = useState("");
  const [summaryDraft, setSummaryDraft] = useState("");
  const [summaryFocusMode, setSummaryFocusMode] = useState(false);
  const [savingSummary, setSavingSummary] = useState(false);
  const [showFollowUp, setShowFollowUp] = useState(false);
  const [followUpTime, setFollowUpTime] = useState("");
  const [showCancelReason, setShowCancelReason] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [showRateUser, setShowRateUser] = useState(false);
  const [rateUserValue, setRateUserValue] = useState(0);
  const [rateUserNote, setRateUserNote] = useState("");
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (booking.status === "pending") return;
    getBookingIntake(booking.id).then((data) => {
      setIntake(data);
      setSummaryDraft(data?.summary ?? "");
    });
  }, [booking.id, booking.status]);

  const [now] = useState(() => Date.now());
  const nowValue = toDateTimeLocalValue(now);
  const sessionStarted = booking.scheduledAt !== undefined && now >= booking.scheduledAt;

  async function handleSaveSummary() {
    setSavingSummary(true);
    try {
      await onSaveSummary(summaryDraft);
    } finally {
      setSavingSummary(false);
    }
  }

  function handleConfirmSchedule() {
    if (!timeValue) return;
    onSchedule(new Date(timeValue).getTime());
    setEditingTime(false);
  }

  function handleTransfer() {
    const target = transferCandidates.find((c) => c.uid === transferTargetId);
    if (!target) return;
    onTransfer(target);
    setShowTransfer(false);
  }

  async function handleCloseFollowUp() {
    if (!followUpTime || closing) return;
    setClosing(true);
    try {
      await onCloseFollowUp(summaryDraft, new Date(followUpTime).getTime());
    } finally {
      setClosing(false);
    }
  }

  async function handleCloseComplete() {
    if (closing) return;
    setClosing(true);
    try {
      await onCloseComplete(summaryDraft);
    } finally {
      setClosing(false);
    }
  }

  function handleConfirmCancel() {
    if (!cancelReason.trim()) return;
    onCancel(cancelReason.trim());
    setShowCancelReason(false);
  }

  const canCancelOrTransfer = booking.status === "accepted" || booking.status === "scheduled";

  if (summaryFocusMode) {
    const readOnly = booking.status !== "scheduled";
    return (
      <Modal title={booking.userEmail} onClose={onClose} className="request-detail-modal">
        <div className="request-card__summary-focus">
          <Button type="button" variant="outlined" onClick={() => setSummaryFocusMode(false)}>
            ← Back
          </Button>
          <label htmlFor={`summary-${booking.id}`}>Session summary</label>
          {readOnly ? (
            <p className="request-card__summary-readonly">{summaryDraft}</p>
          ) : (
            <>
              <textarea
                id={`summary-${booking.id}`}
                rows={8}
                value={summaryDraft}
                onChange={(e) => setSummaryDraft(e.target.value)}
                placeholder="Notes from the session…"
              />
              <Button
                type="button"
                disabled={savingSummary}
                onClick={async () => {
                  await handleSaveSummary();
                  setSummaryFocusMode(false);
                }}
              >
                {savingSummary ? "Saving…" : "Save"}
              </Button>
            </>
          )}
        </div>
      </Modal>
    );
  }

  return (
    <Modal title={booking.userEmail} onClose={onClose} className="request-detail-modal">
      <div className="request-card__header">
        {(booking.followUpOfBookingId || onViewSummary) && (
          <p className="request-card__requester">
            {booking.followUpOfBookingId && <span className="request-card__followup-tag">(follow-up)</span>}
            {onViewSummary && (
              <Button type="button" variant="outlined" onClick={onViewSummary}>
                View Summary
              </Button>
            )}
          </p>
        )}
        <span className={`request-card__status request-card__status--${booking.status}`}>
          {booking.status}
        </span>
      </div>

      {intake && booking.status !== "pending" && (
        <dl className="request-card__intake">
          <dt>Name</dt>
          <dd>{intake.username}</dd>
          <dt>Occupation</dt>
          <dd>{intake.occupation === "student" ? "Student" : "Working professional"}</dd>
          <dt>WhatsApp</dt>
          <dd>{intake.whatsappNumber}</dd>
          <dt>Issue</dt>
          <dd>{intake.issue}</dd>
        </dl>
      )}

      {booking.status === "pending" && (
        <div className="request-card__actions">
          <Button type="button" onClick={onAccept}>
            Accept
          </Button>
          <Button type="button" variant="outlined" onClick={onReject}>
            Reject
          </Button>
        </div>
      )}

      {booking.status === "accepted" && (
        <div className="request-card__schedule">
          <label htmlFor={`schedule-${booking.id}`}>Pick a session time ({SESSION_DURATION_LABEL})</label>
          <DateTimePicker
            id={`schedule-${booking.id}`}
            min={nowValue}
            value={timeValue}
            onChange={setTimeValue}
          />
          {isPastChoice(timeValue) && (
            <p className="request-card__time-warning">This time has already passed. Pick a time later than now.</p>
          )}
          <Button type="button" disabled={isPastOrEmpty(timeValue)} onClick={handleConfirmSchedule}>
            Save
          </Button>
        </div>
      )}

      {booking.status === "scheduled" && (
        <div className="request-card__schedule">
          {editingTime ? (
            <>
              <label htmlFor={`schedule-${booking.id}`}>Pick a new session time</label>
              <DateTimePicker
                id={`schedule-${booking.id}`}
                min={nowValue}
                value={timeValue}
                onChange={setTimeValue}
              />
              {isPastChoice(timeValue) && (
                <p className="request-card__time-warning">This time has already passed. Pick a time later than now.</p>
              )}
              <div className="request-card__actions">
                <Button type="button" disabled={isPastOrEmpty(timeValue)} onClick={handleConfirmSchedule}>
                  Save
                </Button>
                <Button type="button" variant="outlined" onClick={() => setEditingTime(false)}>
                  Cancel
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="request-card__scheduled-time">
                Scheduled for {booking.scheduledAt ? new Date(booking.scheduledAt).toLocaleString() : "—"} (
                {SESSION_DURATION_LABEL})
              </p>
              <Button type="button" variant="outlined" onClick={() => setEditingTime(true)}>
                Reschedule
              </Button>
            </>
          )}

          <div className="request-card__summary">
            <label>Session summary</label>
            <Button
              type="button"
              variant="outlined"
              disabled={!sessionStarted}
              onClick={() => setSummaryFocusMode(true)}
            >
              View Summary
            </Button>
            {!sessionStarted && (
              <p className="request-card__summary-hint">
                Available once the session starts
                {booking.scheduledAt ? ` (${new Date(booking.scheduledAt).toLocaleString()})` : ""}.
              </p>
            )}
          </div>

          {showFollowUp ? (
            <div className="request-card__schedule">
              <label htmlFor={`followup-${booking.id}`}>Follow-up session time</label>
              <DateTimePicker
                id={`followup-${booking.id}`}
                min={nowValue}
                value={followUpTime}
                onChange={setFollowUpTime}
              />
              {isPastChoice(followUpTime) && (
                <p className="request-card__time-warning">This time has already passed. Pick a time later than now.</p>
              )}
              <div className="request-card__actions">
                <Button type="button" disabled={isPastOrEmpty(followUpTime) || closing} onClick={handleCloseFollowUp}>
                  {closing ? "Saving…" : "Save"}
                </Button>
                <Button
                  type="button"
                  variant="outlined"
                  disabled={closing}
                  onClick={() => setShowFollowUp(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="request-card__actions">
              <Button type="button" disabled={closing} onClick={handleCloseComplete}>
                {closing ? "Closing…" : "Close & Complete Session"}
              </Button>
              <Button
                type="button"
                variant="outlined"
                disabled={closing}
                onClick={() => setShowFollowUp(true)}
              >
                Close &amp; Follow-up Session
              </Button>
            </div>
          )}
        </div>
      )}

      {canCancelOrTransfer && (
        <div className="request-card__danger-zone">
          {showTransfer && (
            <div className="request-card__transfer">
              <label htmlFor={`transfer-${booking.id}`}>Transfer to</label>
              <Select id={`transfer-${booking.id}`} value={transferTargetId} onChange={setTransferTargetId}>
                <option value="">Select a counsellor…</option>
                {transferCandidates.map((c) => (
                  <option key={c.uid} value={c.uid}>
                    {c.displayName || c.email}
                  </option>
                ))}
              </Select>
              <div className="request-card__actions">
                <Button type="button" disabled={!transferTargetId} onClick={handleTransfer}>
                  Confirm transfer
                </Button>
                <Button type="button" variant="outlined" onClick={() => setShowTransfer(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {showCancelReason && (
            <div className="request-card__cancel-reason">
              <label htmlFor={`cancel-reason-${booking.id}`}>Reason for cancelling</label>
              <textarea
                id={`cancel-reason-${booking.id}`}
                rows={2}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Let the user and head know why you're cancelling…"
              />
              <div className="request-card__actions">
                <Button type="button" disabled={!cancelReason.trim()} onClick={handleConfirmCancel}>
                  Confirm cancellation
                </Button>
                <Button type="button" variant="outlined" onClick={() => setShowCancelReason(false)}>
                  Back
                </Button>
              </div>
            </div>
          )}

          {!showTransfer && !showCancelReason && (
            <div className="request-card__actions">
              <Button type="button" variant="outlined" onClick={() => setShowTransfer(true)}>
                Transfer
              </Button>
              <Button type="button" variant="outlined" onClick={() => setShowCancelReason(true)}>
                Cancel session
              </Button>
            </div>
          )}
        </div>
      )}

      {booking.status === "cancelled" && (
        <div className="request-card__cancelled">
          <p>Cancelled by {booking.cancelledBy === "user" ? "the user" : "the counsellor"}.</p>
          {booking.cancellationReason && (
            <p className="request-card__summary-readonly">{booking.cancellationReason}</p>
          )}
        </div>
      )}

      {booking.status === "completed" && (
        <div className="request-card__completed">
          <p>{booking.outcome === "followup" ? "Follow-up session scheduled." : "Session complete."}</p>
          {intake?.summary && (
            <Button type="button" variant="outlined" onClick={() => setSummaryFocusMode(true)}>
              View Summary
            </Button>
          )}

          {booking.counsellorRatingOfUser !== undefined ? (
            <div className="request-card__rating-done">
              <span>Your rating of the user:</span>
              <StarRating value={booking.counsellorRatingOfUser} />
            </div>
          ) : showRateUser ? (
            <div className="request-card__rate-user">
              <label>Rate this user (private, visible only to the Head)</label>
              <StarRating value={rateUserValue} onChange={setRateUserValue} size="large" />
              <textarea
                rows={2}
                placeholder="Optional private note…"
                value={rateUserNote}
                onChange={(e) => setRateUserNote(e.target.value)}
              />
              <div className="request-card__actions">
                <Button
                  type="button"
                  disabled={rateUserValue === 0}
                  onClick={() => {
                    onRateUser(rateUserValue, rateUserNote.trim());
                    setShowRateUser(false);
                  }}
                >
                  Submit rating
                </Button>
                <Button type="button" variant="outlined" onClick={() => setShowRateUser(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button type="button" variant="outlined" onClick={() => setShowRateUser(true)}>
              Rate this user
            </Button>
          )}
        </div>
      )}
    </Modal>
  );
}

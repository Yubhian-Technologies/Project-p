import { useEffect, useState } from "react";
import { Modal } from "../common/Modal";
import { Button } from "../common/Button";
import { Select } from "../common/Select";
import { DateTimePicker } from "../common/DateTimePicker";
import { StarRating } from "../common/StarRating";
import { getBookingIntake, SESSION_DURATION_LABEL } from "../../services/firebase/bookings";
import { getSsiResult, type SsiResult } from "../../services/firebase/ssiTest";
import type { Booking, BookingIntake } from "../../types/booking";
import type { UserProfile } from "../../types/user";
import { useAuth } from "../../hooks/useAuth";
import { ChatModal } from "../chat/ChatModal";
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
  campusHead: UserProfile | null;
  viewerRole: "head" | "counsellor";
  onAcceptSlot: (chosenAt: number) => void;
  onReject: () => void;
  onSchedule: (scheduledAt: number) => void;
  onRequestReschedule: (proposedAt: number, reason?: string) => void;
  onAcceptReschedule: () => void;
  onCancel: (reason: string) => void;
  onRequestTransfer: (reason: string, suggestedTarget?: UserProfile) => void;
  onDirectTransfer: (target: UserProfile) => void;
  onSaveSummary: (summary: string) => Promise<void>;
  onCloseComplete: (summary: string) => Promise<void>;
  onCloseFollowUp: (summary: string, scheduledAt: number) => Promise<void>;
  onCloseMissed: (reason: string) => Promise<void>;
  onRateUser: (rating: number, note: string) => void;
  onViewSummary?: () => void;
  onSuggestSsi?: () => Promise<void> | void;
  onClose: () => void;
}

export function RequestDetailModal({
  booking,
  transferCandidates,
  campusHead,
  viewerRole,
  onAcceptSlot,
  onReject,
  onSchedule,
  onRequestReschedule,
  onAcceptReschedule,
  onCancel,
  onRequestTransfer,
  onDirectTransfer,
  onSaveSummary,
  onCloseComplete,
  onCloseFollowUp,
  onCloseMissed,
  onRateUser,
  onViewSummary,
  onSuggestSsi,
  onClose,
}: RequestDetailModalProps) {
  const { currentUser } = useAuth();
  const [showChatModal, setShowChatModal] = useState(false);
  const [showProposeTime, setShowProposeTime] = useState(false);
  const [timeValue, setTimeValue] = useState(
    booking.scheduledAt ? toDateTimeLocalValue(booking.scheduledAt) : "",
  );
  const [intake, setIntake] = useState<BookingIntake | null>(null);
  const [showReschedulePropose, setShowReschedulePropose] = useState(false);
  const [rescheduleTimeValue, setRescheduleTimeValue] = useState("");
  const [rescheduleReasonValue, setRescheduleReasonValue] = useState("");
  const [showTransferRequest, setShowTransferRequest] = useState(false);
  const [transferReasonField, setTransferReasonField] = useState("");
  const [transferSuggestedId, setTransferSuggestedId] = useState("");
  const [showDirectTransfer, setShowDirectTransfer] = useState(false);
  const [directTransferTargetId, setDirectTransferTargetId] = useState("");
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
  const [missedReason, setMissedReason] = useState("");
  const [ssiResult, setSsiResult] = useState<SsiResult | null>(null);
  const [showSsiResult, setShowSsiResult] = useState(false);
  const [ssiSuggesting, setSsiSuggesting] = useState(false);
  const [ssiSuggested, setSsiSuggested] = useState(false);

  useEffect(() => {
    getBookingIntake(booking.id).then((data) => {
      setIntake(data);
      setSummaryDraft(data?.summary ?? "");
    });
    getSsiResult(booking.id)
      .then((result) => setSsiResult(result))
      .catch(() => setSsiResult(null));
  }, [booking.id, booking.status]);

  const [now] = useState(() => Date.now());
  const nowValue = toDateTimeLocalValue(now);
  const sessionStarted = booking.scheduledAt !== undefined && now >= booking.scheduledAt;
  const sessionEnded =
    booking.scheduledAt !== undefined && now >= booking.scheduledAt + booking.durationMinutes * 60000;

  async function handleSuggestSsi() {
    if (!onSuggestSsi || ssiSuggesting || ssiSuggested) return;
    setSsiSuggesting(true);
    try {
      await onSuggestSsi();
      setSsiSuggested(true);
    } finally {
      setSsiSuggesting(false);
    }
  }

  async function handleSaveSummary() {
    setSavingSummary(true);
    try {
      await onSaveSummary(summaryDraft);
      setIntake((prev) =>
        prev
          ? { ...prev, summary: summaryDraft }
          : { username: "", occupation: "student", whatsappNumber: "", issue: "", summary: summaryDraft },
      );
    } finally {
      setSavingSummary(false);
    }
  }

  function handleConfirmSchedule() {
    if (!timeValue) return;
    onSchedule(new Date(timeValue).getTime());
    setShowProposeTime(false);
  }

  function handleProposeReschedule() {
    if (!rescheduleTimeValue) return;
    onRequestReschedule(new Date(rescheduleTimeValue).getTime(), rescheduleReasonValue.trim() || undefined);
    setShowReschedulePropose(false);
    setRescheduleTimeValue("");
    setRescheduleReasonValue("");
  }

  function handleRequestTransfer() {
    if (!transferReasonField.trim()) return;
    const suggested = transferCandidates.find((c) => c.uid === transferSuggestedId);
    onRequestTransfer(transferReasonField.trim(), suggested);
    setShowTransferRequest(false);
    setTransferReasonField("");
    setTransferSuggestedId("");
  }

  function handleDirectTransfer() {
    const target = transferCandidates.find((c) => c.uid === directTransferTargetId);
    if (!target) return;
    onDirectTransfer(target);
    setShowDirectTransfer(false);
    setDirectTransferTargetId("");
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

  async function handleConfirmMissed() {
    if (!missedReason.trim() || closing) return;
    setClosing(true);
    try {
      await onCloseMissed(missedReason.trim());
    } finally {
      setClosing(false);
    }
  }

  const canCancelOrRequestTransfer = booking.status === "accepted" || booking.status === "scheduled";

  function renderTransferControls() {
    if (viewerRole === "head") {
      return showDirectTransfer ? (
        <div className="request-card__transfer">
          <label htmlFor={`direct-transfer-${booking.id}`}>Transfer to</label>
          <Select id={`direct-transfer-${booking.id}`} value={directTransferTargetId} onChange={setDirectTransferTargetId}>
            <option value="">Select a counsellor…</option>
            {transferCandidates.map((c) => (
              <option key={c.uid} value={c.uid}>
                {c.displayName || c.email}
              </option>
            ))}
          </Select>
          <div className="request-card__actions">
            <Button type="button" disabled={!directTransferTargetId} onClick={handleDirectTransfer}>
              Confirm transfer
            </Button>
            <Button type="button" variant="outlined" onClick={() => setShowDirectTransfer(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button type="button" variant="outlined" onClick={() => setShowDirectTransfer(true)}>
          Transfer
        </Button>
      );
    }

    return (
      <>
        {booking.transferRequest?.status === "pending" && (
          <p className="request-card__summary-hint">Transfer request sent — awaiting Head approval.</p>
        )}

        {showTransferRequest && (
          <div className="request-card__transfer">
            <label htmlFor={`transfer-reason-${booking.id}`}>Why do you want to transfer this?</label>
            <textarea
              id={`transfer-reason-${booking.id}`}
              rows={2}
              value={transferReasonField}
              onChange={(e) => setTransferReasonField(e.target.value)}
              placeholder="Let the Head know why you'd like this reassigned…"
            />
            <label htmlFor={`transfer-suggest-${booking.id}`}>Suggested counsellor (optional)</label>
            <Select id={`transfer-suggest-${booking.id}`} value={transferSuggestedId} onChange={setTransferSuggestedId}>
              <option value="">No suggestion</option>
              {transferCandidates.map((c) => (
                <option key={c.uid} value={c.uid}>
                  {c.displayName || c.email}
                </option>
              ))}
            </Select>
            {!campusHead && (
              <p className="request-card__time-warning">No Head found for your campus — contact a Super Admin.</p>
            )}
            <div className="request-card__actions">
              <Button
                type="button"
                disabled={!transferReasonField.trim() || !campusHead}
                onClick={handleRequestTransfer}
              >
                Send request to Head
              </Button>
              <Button type="button" variant="outlined" onClick={() => setShowTransferRequest(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {!showTransferRequest && booking.transferRequest?.status !== "pending" && (
          <Button type="button" variant="outlined" onClick={() => setShowTransferRequest(true)}>
            Request Transfer to Head
          </Button>
        )}
      </>
    );
  }

  if (ssiResult && showSsiResult) {
    const likertPct = ssiResult.likertMax > 0 ? Math.round((ssiResult.likertScore / ssiResult.likertMax) * 100) : 0;
    const subscales = [
      { key: "D", label: "Depression", value: ssiResult.depressionScore },
      { key: "A", label: "Anxiety", value: ssiResult.anxietyScore },
      { key: "S", label: "Stress", value: ssiResult.stressScore },
    ];
    const subscaleMax = Math.round((ssiResult.likertMax / 3));
    return (
      <Modal title={`SSI Test Result — ${booking.userEmail}`} onClose={onClose} className="request-detail-modal">
        <div className="request-card__ssi-back">
          <Button type="button" variant="outlined" onClick={() => setShowSsiResult(false)}>
            ← Back
          </Button>
        </div>

        <div className="request-card__ssi-score">
          <span className="request-card__ssi-score-val">
            {ssiResult.likertScore}
            <small> / {ssiResult.likertMax}</small>
          </span>
          <span className="request-card__ssi-score-pct">{likertPct}%</span>
        </div>

        <div className="request-card__ssi-subscales">
          {subscales.map((s) => (
            <div key={s.key} className="request-card__ssi-subscale" title={`${s.label} (subscale of the assessment)`}>
              <span className="request-card__ssi-subscale-key">{s.key}</span>
              <span className="request-card__ssi-subscale-name">{s.label}</span>
              <span className="request-card__ssi-subscale-val">
                {s.value}
                <small> / {subscaleMax}</small>
              </span>
            </div>
          ))}
        </div>

        <div className="request-card__ssi-section">
          <h4 className="request-card__ssi-heading">Page 1 · About the student</h4>
          <dl className="request-card__ssi-dl">
            <dt>Name</dt>
            <dd>{intake?.username || booking.userEmail || "—"}</dd>
            <dt>Department</dt>
            <dd>{ssiResult.level1.department || "—"}</dd>
            <dt>Year</dt>
            <dd>{ssiResult.level1.year || "—"}</dd>
            <dt>Section</dt>
            <dd>{ssiResult.level1.section || "—"}</dd>
            <dt>Hostel / Day Scholar</dt>
            <dd>{ssiResult.level1.hostelOrDayScholar || "—"}</dd>
            <dt>Age</dt>
            <dd>{ssiResult.level1.age || "—"}</dd>
            <dt>WhatsApp</dt>
            <dd>{ssiResult.whatsappNumber || "—"}</dd>
            <dt>Submitted</dt>
            <dd>{new Date(ssiResult.submittedAt).toLocaleString()}</dd>
          </dl>
        </div>

        <div className="request-card__ssi-section">
          <h4 className="request-card__ssi-heading">Page 2 · Assessment answers</h4>
          {ssiResult.likertAnswers.map((a, i) => (
            <div key={a.id} className="request-card__ssi-row">
              <span className="request-card__ssi-q">
                {i + 1}. {a.label}
              </span>
              <span className={`request-card__ssi-a${a.value !== undefined && (a.value ?? 0) >= 2 ? " request-card__ssi-a--high" : ""}`}>
                {a.answer}
              </span>
            </div>
          ))}
        </div>

        <div className="request-card__ssi-section">
          <h4 className="request-card__ssi-heading">Page 3 · Important questions</h4>
          {ssiResult.level3Answers.map((a, i) => (
            <div key={a.id} className="request-card__ssi-row">
              <span className="request-card__ssi-q">
                {i + 1}. {a.label}
              </span>
              <span className={`request-card__ssi-a${a.id === "l3_q1" && (a.answer === "Yes" || a.answer === "Maybe") ? " request-card__ssi-a--high" : ""}`}>
                {a.answer || "—"}
              </span>
            </div>
          ))}
        </div>
      </Modal>
    );
  }

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

  const isTransferredPending =
    booking.status === "pending" && !!booking.transferredFrom;

  const statusBadgeLabel = isTransferredPending
    ? "transfer"
    : booking.outcome === "missed"
      ? "missed"
      : booking.status;

  const modalTitle = (
    <div className="request-detail-modal__header-title">
      <span className="request-detail-modal__email">{booking.userEmail}</span>
      <span
        className={`request-card__status request-card__status--${
          isTransferredPending ? "transfer" : booking.outcome === "missed" ? "missed" : booking.status
        }`}
      >
        {statusBadgeLabel}
      </span>
      {booking.sessionMode === "offline" && (
        <span className="request-card__offline-tag">Offline</span>
      )}
      {booking.followUpOfBookingId && (
        <span className="request-card__followup-tag">(follow-up)</span>
      )}
      {isTransferredPending && (
        <span className="request-card__offline-tag">Transferred to you</span>
      )}
    </div>
  );

  return (
    <Modal title={modalTitle} onClose={onClose} className="request-detail-modal">
      <div className="request-detail-modal__top-actions" style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "16px" }}>
        <Button type="button" variant="outlined" onClick={() => setShowChatModal(true)}>
          Chat with Student
        </Button>
        {onViewSummary && (
          <Button type="button" variant="outlined" onClick={onViewSummary}>
            View Summary
          </Button>
        )}
        {ssiResult && (
          <Button type="button" variant="outlined" onClick={() => setShowSsiResult(true)}>
            SSI Test Result
          </Button>
        )}
        {onSuggestSsi &&
          !ssiResult &&
          (booking.status === "accepted" || (booking.status === "scheduled" && !sessionEnded)) && (
            <Button
              type="button"
              variant="outlined"
              disabled={ssiSuggesting || ssiSuggested}
              onClick={handleSuggestSsi}
            >
              {ssiSuggested ? "SSI Test Suggested ✓" : ssiSuggesting ? "Suggesting…" : "Suggest SSI Test"}
            </Button>
          )}
      </div>

      {showChatModal && currentUser && (
        <ChatModal
          chatRoomId={booking.id}
          bookingId={booking.id}
          counterpartName={intake?.username || booking.userEmail}
          counterpartRole="user"
          currentUser={{
            uid: currentUser.uid,
            email: currentUser.email || "",
            displayName: currentUser.displayName || undefined,
            role: viewerRole,
          }}
          onClose={() => setShowChatModal(false)}
        />
      )}

      {intake && (
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

      {booking.status === "pending" && !isTransferredPending && (
        <div className="request-card__schedule">
          {booking.proposedSlots && (
            <>
              <p>Proposed times:</p>
              <div className="request-card__actions">
                <Button
                  type="button"
                  disabled={isPastChoice(toDateTimeLocalValue(booking.proposedSlots[0]))}
                  onClick={() => onAcceptSlot(booking.proposedSlots![0])}
                >
                  Accept: {new Date(booking.proposedSlots[0]).toLocaleString()}
                </Button>
                <Button
                  type="button"
                  disabled={isPastChoice(toDateTimeLocalValue(booking.proposedSlots[1]))}
                  onClick={() => onAcceptSlot(booking.proposedSlots![1])}
                >
                  Accept: {new Date(booking.proposedSlots[1]).toLocaleString()}
                </Button>
              </div>
            </>
          )}

          {showProposeTime ? (
            <>
              <label htmlFor={`propose-${booking.id}`}>Propose a different time</label>
              <DateTimePicker id={`propose-${booking.id}`} min={nowValue} value={timeValue} onChange={setTimeValue} />
              {isPastChoice(timeValue) && (
                <p className="request-card__time-warning">This time has already passed. Pick a time later than now.</p>
              )}
              <div className="request-card__actions">
                <Button type="button" disabled={isPastOrEmpty(timeValue)} onClick={handleConfirmSchedule}>
                  Confirm
                </Button>
                <Button type="button" variant="outlined" onClick={() => setShowProposeTime(false)}>
                  Cancel
                </Button>
              </div>
            </>
          ) : (
            <div className="request-card__actions" style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
              <Button type="button" variant="outlined" onClick={() => setShowProposeTime(true)}>
                Propose a different time
              </Button>
              <Button type="button" variant="outlined" onClick={onReject}>
                Cancel
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ── Transferred session: Schedule or Cancel ─────────────────── */}
      {isTransferredPending && (
        <div className="request-card__schedule">
          <p className="request-card__summary-hint">
            This session was transferred to you. Please schedule a time or cancel if you cannot take it.
          </p>

          <label htmlFor={`schedule-transfer-${booking.id}`}>
            Schedule session time ({SESSION_DURATION_LABEL})
          </label>
          <DateTimePicker
            id={`schedule-transfer-${booking.id}`}
            min={nowValue}
            value={timeValue}
            onChange={setTimeValue}
          />
          {isPastChoice(timeValue) && (
            <p className="request-card__time-warning">This time has already passed. Pick a time later than now.</p>
          )}

          {showCancelReason ? (
            <div className="request-card__cancel-reason">
              <label htmlFor={`cancel-transfer-${booking.id}`}>Reason for cancelling</label>
              <textarea
                id={`cancel-transfer-${booking.id}`}
                rows={2}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Let the head know why you cannot take this session…"
              />
              <div className="request-card__actions">
                <Button
                  type="button"
                  disabled={!cancelReason.trim()}
                  onClick={() => {
                    onCancel(cancelReason.trim());
                    setShowCancelReason(false);
                  }}
                >
                  Confirm cancellation
                </Button>
                <Button type="button" variant="outlined" onClick={() => setShowCancelReason(false)}>
                  Back
                </Button>
              </div>
            </div>
          ) : (
            <div className="request-card__actions">
              <Button type="button" disabled={isPastOrEmpty(timeValue)} onClick={handleConfirmSchedule}>
                Schedule
              </Button>
              <Button type="button" variant="outlined" onClick={() => setShowCancelReason(true)}>
                Cancel
              </Button>
            </div>
          )}
        </div>
      )}

      {booking.status === "accepted" && !showCancelReason && (
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

      {booking.status === "scheduled" && !showCancelReason && (
        <div className="request-card__schedule">
          <p className="request-card__scheduled-time">
            Scheduled for {booking.scheduledAt ? new Date(booking.scheduledAt).toLocaleString() : "—"} (
            {SESSION_DURATION_LABEL})
          </p>

          {booking.rescheduleProposal?.proposedBy === "counsellor" && (
            <p className="request-card__summary-hint">Reschedule proposed — awaiting student response.</p>
          )}

          {booking.rescheduleProposal?.proposedBy === "user" && !showReschedulePropose && (
            <div className="request-card__reschedule-proposal">
              <p>
                Student proposed a new time: {new Date(booking.rescheduleProposal.proposedAt).toLocaleString()}
                {booking.rescheduleProposal.reason ? ` — ${booking.rescheduleProposal.reason}` : ""}
              </p>
              <div className="request-card__actions">
                <Button type="button" onClick={onAcceptReschedule}>
                  Accept new time
                </Button>
                <Button type="button" variant="outlined" onClick={() => setShowReschedulePropose(true)}>
                  Reschedule
                </Button>
              </div>
            </div>
          )}

          {!booking.rescheduleProposal && !showReschedulePropose && (
            <Button type="button" variant="outlined" onClick={() => setShowReschedulePropose(true)}>
              Reschedule
            </Button>
          )}

          {showReschedulePropose && (
            <div className="request-card__schedule">
              <label htmlFor={`reschedule-${booking.id}`}>New proposed time</label>
              <DateTimePicker
                id={`reschedule-${booking.id}`}
                min={nowValue}
                value={rescheduleTimeValue}
                onChange={setRescheduleTimeValue}
              />
              {isPastChoice(rescheduleTimeValue) && (
                <p className="request-card__time-warning">This time has already passed. Pick a time later than now.</p>
              )}
              <textarea
                rows={2}
                placeholder="Reason (optional)"
                value={rescheduleReasonValue}
                onChange={(e) => setRescheduleReasonValue(e.target.value)}
              />
              <div className="request-card__actions">
                <Button type="button" disabled={isPastOrEmpty(rescheduleTimeValue)} onClick={handleProposeReschedule}>
                  Send
                </Button>
                <Button type="button" variant="outlined" onClick={() => setShowReschedulePropose(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {sessionEnded ? (
            <div className="request-card__cancel-reason">
              <p className="request-card__time-warning">
                This session's scheduled time has passed. Why wasn't it held?
              </p>
              <textarea
                id={`missed-reason-${booking.id}`}
                rows={2}
                value={missedReason}
                onChange={(e) => setMissedReason(e.target.value)}
                placeholder="e.g. the user didn't join, a technical issue came up…"
              />
              <div className="request-card__actions">
                <Button type="button" disabled={!missedReason.trim() || closing} onClick={handleConfirmMissed}>
                  {closing ? "Saving…" : "Confirm"}
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="request-card__summary">
                <label>Session summary</label>
                <Button
                  type="button"
                  variant="outlined"
                  disabled={!sessionStarted}
                  onClick={() => setSummaryFocusMode(true)}
                >
                  {intake?.summary ? "View Summary" : "Take Summary"}
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
            </>
          )}
        </div>
      )}

      {canCancelOrRequestTransfer && (
        <div className="request-card__danger-zone">
          {showCancelReason ? (
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
          ) : (
            <div className="request-card__actions">
              {renderTransferControls()}
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

      {booking.status === "completed" && booking.outcome === "missed" && (
        <div className="request-card__completed">
          <p>Session was not held.</p>
          {booking.missedReason && <p className="request-card__summary-readonly">{booking.missedReason}</p>}
          {renderTransferControls()}
        </div>
      )}

      {booking.status === "completed" && booking.outcome !== "missed" && (
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

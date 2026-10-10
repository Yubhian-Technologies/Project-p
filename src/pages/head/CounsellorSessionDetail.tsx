import { useEffect, useState } from "react";
import {
  listBookingsForCounsellor,
  listBookableProfiles,
  getBookingIntake,
  transferBooking,
  SESSION_DURATION_LABEL,
} from "../../services/firebase/bookings";
import type { Booking } from "../../types/booking";
import type { UserProfile } from "../../types/user";
import { formatDateTimeDMY } from "../../utils/formatDate";
import type { SessionFeedback } from "../../types/feedback";
import { listFeedbackForCounsellor } from "../../services/firebase/feedback";
import { Card } from "../../components/common/Card";
import { Button } from "../../components/common/Button";
import { Select } from "../../components/common/Select";
import { StarRating } from "../../components/common/StarRating";
import { Modal } from "../../components/common/Modal";
import "./CounsellorSessionDetail.css";

interface CounsellorSessionDetailProps {
  counsellor: UserProfile;
  onBack: () => void;
}


interface UserGroup {
  userId: string;
  userEmail: string;
  bookings: Booking[];
  lastActivity: number;
}

function groupByUser(bookings: Booking[]): UserGroup[] {
  const map = new Map<string, UserGroup>();
  for (const b of bookings) {
    const existing = map.get(b.userId);
    if (existing) {
      existing.bookings.push(b);
      existing.lastActivity = Math.max(existing.lastActivity, b.updatedAt);
    } else {
      map.set(b.userId, { userId: b.userId, userEmail: b.userEmail, bookings: [b], lastActivity: b.updatedAt });
    }
  }
  const groups = Array.from(map.values());
  for (const group of groups) {
    group.bookings.sort((a, b) => a.createdAt - b.createdAt);
  }
  groups.sort((a, b) => b.lastActivity - a.lastActivity);
  return groups;
}

export function CounsellorSessionDetail({ counsellor, onBack }: CounsellorSessionDetailProps) {
  const [groups, setGroups] = useState<UserGroup[]>([]);
  const [summaries, setSummaries] = useState<Record<string, string | undefined>>({});
  const [feedbackByBooking, setFeedbackByBooking] = useState<Map<string, SessionFeedback>>(new Map());
  const [candidates, setCandidates] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [reassigningId, setReassigningId] = useState<string | null>(null);
  const [targetId, setTargetId] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [selectedFeedback, setSelectedFeedback] = useState<SessionFeedback | null>(null);

  function toggleExpanded(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  async function load() {
    const [bookings, profiles, feedback] = await Promise.all([
      listBookingsForCounsellor(counsellor.uid),
      listBookableProfiles(),
      listFeedbackForCounsellor(counsellor.uid).catch(() => []),
    ]);
    setGroups(groupByUser(bookings));
    setCandidates(profiles.filter((p) => p.uid !== counsellor.uid));
    setFeedbackByBooking(new Map(feedback.map((f) => [f.bookingId, f])));

    const completed = bookings.filter((b) => b.status === "completed");
    const entries = await Promise.all(
      completed.map(async (b) => [b.id, (await getBookingIntake(b.id))?.summary] as const),
    );
    setSummaries(Object.fromEntries(entries));
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [counsellor.uid]);

  async function handleReassign(booking: Booking) {
    const target = candidates.find((c) => c.uid === targetId);
    if (!target) return;
    await transferBooking(booking, { uid: target.uid, email: target.email }, booking.counsellorId);
    setReassigningId(null);
    setTargetId("");
    await load();
  }

  if (loading) return null;

  return (
    <div className="counsellor-session-detail">
      <Button type="button" variant="outlined" onClick={onBack}>
        ← Back to Team
      </Button>

      <h3 className="counsellor-session-detail__heading">
        {counsellor.displayName || counsellor.email}'s sessions
      </h3>

      {groups.length === 0 && <p>No sessions yet.</p>}

      {groups.map((group) => {
        const completedCount = group.bookings.filter(
          (b) => b.status === "completed" && b.outcome !== "missed",
        ).length;
        const missedCount = group.bookings.filter(
          (b) => b.status === "completed" && b.outcome === "missed",
        ).length;
        const cancelledCount = group.bookings.filter((b) => b.status === "cancelled").length;
        return (
          <Card key={group.userId} className="counsellor-session-detail__user-card">
            <div className="counsellor-session-detail__user-header">
              <p className="counsellor-session-detail__user-email">{group.userEmail}</p>
              <span className="counsellor-session-detail__tally">
                {group.bookings.length} session{group.bookings.length === 1 ? "" : "s"} · {completedCount} completed
                {missedCount > 0 ? ` · ${missedCount} missed` : ""}
                {cancelledCount > 0 ? ` · ${cancelledCount} cancelled` : ""}
              </span>
            </div>

            <div className="counsellor-session-detail__timeline">
              {group.bookings.map((b) => {
                const isExpanded = expandedIds.has(b.id);
                const feedback = feedbackByBooking.get(b.id);
                return (
                <div key={b.id} className="counsellor-session-detail__entry">
                  <button
                    type="button"
                    className="counsellor-session-detail__entry-header"
                    onClick={() => toggleExpanded(b.id)}
                  >
                    <span
                      className={`counsellor-session-detail__status counsellor-session-detail__status--${
                        b.outcome === "missed" ? "missed" : b.status
                      }`}
                    >
                      {b.outcome === "missed" ? "missed" : b.status}
                    </span>
                    {b.followUpOfBookingId && (
                      <span className="counsellor-session-detail__followup-tag">(follow-up)</span>
                    )}
                    {b.scheduledAt && (
                      <span className="counsellor-session-detail__date">
                        {formatDateTimeDMY(b.scheduledAt)} ({SESSION_DURATION_LABEL})
                      </span>
                    )}
                    <span className="counsellor-session-detail__hint">
                      {isExpanded ? "Hide" : "View Details"} →
                    </span>
                  </button>

                  {isExpanded && b.status === "completed" && (
                    <div className="counsellor-session-detail__completed">
                      <p className="counsellor-session-detail__outcome">
                        {b.outcome === "followup"
                          ? "Ended with a follow-up scheduled."
                          : b.outcome === "missed"
                            ? "Session was not held."
                            : "Session ended."}
                      </p>
                      {b.outcome === "missed" && b.missedReason && (
                        <p className="counsellor-session-detail__summary">"{b.missedReason}"</p>
                      )}
                      {summaries[b.id] && (
                        <p className="counsellor-session-detail__summary">"{summaries[b.id]}"</p>
                      )}

                      {feedback && (
                        <div className="counsellor-session-detail__feedback">
                          <p className="counsellor-session-detail__rating-label">Session feedback</p>
                          <div className="counsellor-session-detail__feedback-row">
                            <StarRating value={feedback.rating} />
                            <span className="counsellor-session-detail__feedback-date">
                              {formatDateTimeDMY(feedback.submittedAt)}
                            </span>
                          </div>
                          <Button
                            type="button"
                            variant="outlined"
                            style={{ marginTop: "8px" }}
                            onClick={() => setSelectedFeedback(feedback)}
                          >
                            See feedback for this user
                          </Button>
                        </div>
                      )}

                      <div className="counsellor-session-detail__ratings">
                        <div className="counsellor-session-detail__rating-col">
                          <span className="counsellor-session-detail__rating-label">
                            User's rating of counsellor (public)
                          </span>
                          {b.userRatingOfCounsellor !== undefined ? (
                            <>
                              <StarRating value={b.userRatingOfCounsellor} />
                              {b.userReviewText && (
                                <p className="counsellor-session-detail__review-text">"{b.userReviewText}"</p>
                              )}
                            </>
                          ) : (
                            <span className="counsellor-session-detail__none">Not rated yet</span>
                          )}
                        </div>

                        <div className="counsellor-session-detail__rating-col">
                          <span className="counsellor-session-detail__rating-label">
                            Counsellor's rating of user (private)
                          </span>
                          {b.counsellorRatingOfUser !== undefined ? (
                            <>
                              <StarRating value={b.counsellorRatingOfUser} />
                              {b.counsellorNoteOnUser && (
                                <p className="counsellor-session-detail__review-text">"{b.counsellorNoteOnUser}"</p>
                              )}
                            </>
                          ) : (
                            <span className="counsellor-session-detail__none">Not rated yet</span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {isExpanded && b.status === "cancelled" && (
                    <div className="counsellor-session-detail__cancelled">
                      <p>
                        Cancelled by {b.cancelledBy === "user" ? "the user" : "the counsellor"}
                        {b.cancellationReason ? `: ${b.cancellationReason}` : ""}
                      </p>

                      {reassigningId === b.id ? (
                        <div className="counsellor-session-detail__reassign">
                          <Select value={targetId} onChange={setTargetId}>
                            <option value="">Select a counsellor…</option>
                            {candidates.map((c) => (
                              <option key={c.uid} value={c.uid}>
                                {c.displayName || c.email}
                              </option>
                            ))}
                          </Select>
                          <Button type="button" disabled={!targetId} onClick={() => handleReassign(b)}>
                            Confirm
                          </Button>
                          <Button type="button" variant="outlined" onClick={() => setReassigningId(null)}>
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <Button type="button" variant="outlined" onClick={() => setReassigningId(b.id)}>
                          Reassign
                        </Button>
                      )}
                    </div>
                  )}
                </div>
                );
              })}
            </div>
          </Card>
        );
      })}

      {selectedFeedback && (
        <Modal
          title="User Session Feedback"
          className="counsellor-feedback__modal"
          onClose={() => setSelectedFeedback(null)}
        >
          <div className="counsellor-feedback__detail-card">
            <div className="counsellor-feedback__detail-header">
              <div>
                <h4 className="counsellor-feedback__detail-email">
                  {selectedFeedback.userEmail || "Student"}
                </h4>
                <p className="counsellor-feedback__detail-date">
                  {formatDateTimeDMY(selectedFeedback.submittedAt)}
                </p>
              </div>
              <div className="counsellor-feedback__detail-rating">
                <StarRating value={selectedFeedback.rating} size="large" />
              </div>
            </div>

            <div className="counsellor-feedback__question-list">
              {selectedFeedback.answers && selectedFeedback.answers.length > 0 ? (
                selectedFeedback.answers.map((answer, i) => (
                  <div key={i} className="counsellor-feedback__question-card">
                    <span className="counsellor-feedback__question-label">
                      {answer.label.toUpperCase()}
                    </span>
                    <span className="counsellor-feedback__question-value">
                      {answer.value}
                    </span>
                  </div>
                ))
              ) : (
                <div className="counsellor-feedback__question-card">
                  <span className="counsellor-feedback__question-label">OVERALL SESSION RATING</span>
                  <span className="counsellor-feedback__question-value">{selectedFeedback.rating} / 5</span>
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

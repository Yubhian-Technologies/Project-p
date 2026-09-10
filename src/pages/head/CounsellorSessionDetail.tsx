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
import { Card } from "../../components/common/Card";
import { Button } from "../../components/common/Button";
import { Select } from "../../components/common/Select";
import { StarRating } from "../../components/common/StarRating";
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
  const [candidates, setCandidates] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [reassigningId, setReassigningId] = useState<string | null>(null);
  const [targetId, setTargetId] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

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
    const [bookings, profiles] = await Promise.all([
      listBookingsForCounsellor(counsellor.uid),
      listBookableProfiles(),
    ]);
    setGroups(groupByUser(bookings));
    setCandidates(profiles.filter((p) => p.uid !== counsellor.uid));

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
                        {new Date(b.scheduledAt).toLocaleString()} ({SESSION_DURATION_LABEL})
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
    </div>
  );
}

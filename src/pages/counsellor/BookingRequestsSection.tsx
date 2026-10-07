import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { getUserProfile } from "../../services/firebase/firestore";
import { subscribeToNotifications } from "../../services/firebase/notifications";
import {
  listBookingsForCounsellor,
  listBookableProfiles,
  acceptProposedSlot,
  claimEmergencyBooking,
  rejectBooking,
  scheduleBooking,
  requestReschedule,
  acceptRescheduleProposal,
  cancelBooking,
  requestBookingTransfer,
  transferBooking,
  saveSessionSummary,
  shareSessionSummary,
  closeBooking,
  closeMissedSession,
  createFollowUpBooking,
  offerCompensationSession,
  scheduleCompensationSession,
  flagMissedSessionPending,
  getBookingIntake,
  isSessionEndedPending,
  rateUser,
  getFollowUpHistory,
  notifyHeadTransferSessionCancelled,
  suggestSsiTest,
} from "../../services/firebase/bookings";
import type { Booking } from "../../types/booking";
import type { UserProfile } from "../../types/user";
import { Button } from "../../components/common/Button";
import { Select } from "../../components/common/Select";
import { RequestCard } from "../../components/booking/RequestCard";
import { RequestDetailModal } from "../../components/booking/RequestDetailModal";
import { SessionHistoryModal } from "../../components/booking/SessionHistoryModal";
import "./BookingRequestsSection.css";

const ImportSessionsModal = lazy(() =>
  import("../../components/booking/ImportSessionsModal").then((m) => ({ default: m.ImportSessionsModal })),
);

type Tab = "new" | "upcoming" | "completed" | "cancelled" | "missed";

// Only New Requests and Upcoming Sessions show a live count in the tab —
// those are the two that need regular attention; the rest are history.
const TABS: { id: Tab; label: string; showCount: boolean }[] = [
  { id: "new", label: "New Requests", showCount: true },
  { id: "upcoming", label: "Upcoming Sessions", showCount: true },
  { id: "completed", label: "Completed", showCount: false },
  { id: "cancelled", label: "Cancelled", showCount: false },
  { id: "missed", label: "Missed Sessions", showCount: false },
];

const NEW_STATUSES = ["pending"];
const UPCOMING_STATUSES = ["accepted", "scheduled"];
const COMPLETED_STATUSES = ["completed"];
const CANCELLED_STATUSES = ["cancelled", "rejected"];

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const THIS_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 6 }, (_, i) => THIS_YEAR - i);

// The date a completed/cancelled/rejected booking is filtered by — its
// scheduled session time when it has one, otherwise when it last changed
// (rejected bookings never got a scheduledAt at all).
function completedDate(b: Booking): Date {
  return new Date(b.scheduledAt ?? b.updatedAt);
}

interface HistoryState {
  clientEmail: string;
  history: { scheduledAt?: number; summary?: string }[];
  loading: boolean;
}

interface BookingRequestsSectionProps {
  importOpen?: boolean;
  onImportClose?: () => void;
  initialSelectedId?: string;
  /** Booking id to auto-open the chat tab for — set when the viewer got here
   *  by tapping a "chat_message" notification. */
  autoOpenChatBookingId?: string;
  /** Fired once the targeted request has actually opened with the chat
   *  auto-opened. The dashboard drops its id on this so that reopening the
   *  SAME booking later (a plain "view details" click) doesn't pop the chat
   *  open again — without this, the target id never clears and the chat
   *  auto-opens every single time that booking is revisited. */
  onChatAutoOpenConsumed?: () => void;
}

export function BookingRequestsSection({
  importOpen = false,
  onImportClose,
  initialSelectedId,
  autoOpenChatBookingId,
  onChatAutoOpenConsumed,
}: BookingRequestsSectionProps) {
  const { currentUser, profile } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [userNames, setUserNames] = useState<Map<string, string>>(new Map());
  const [transferCandidates, setTransferCandidates] = useState<UserProfile[]>([]);
  const [compensationCandidates, setCompensationCandidates] = useState<UserProfile[]>([]);
  const [campusHead, setCampusHead] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("new");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [historyState, setHistoryState] = useState<HistoryState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [completedFilterMonth, setCompletedFilterMonth] = useState(0);
  const [completedFilterYear, setCompletedFilterYear] = useState(0);
  const [cancelledFilterMonth, setCancelledFilterMonth] = useState(0);
  const [cancelledFilterYear, setCancelledFilterYear] = useState(0);
  const [missedFilterMonth, setMissedFilterMonth] = useState(0);
  const [missedFilterYear, setMissedFilterYear] = useState(0);

  useEffect(() => {
    if (initialSelectedId) setSelectedId(initialSelectedId);
  }, [initialSelectedId]);

  // Once the request a "chat_message" notification pointed at has actually
  // been selected (and, on this same render, mounted with autoOpenChat=true
  // below), tell the dashboard to drop its target immediately — otherwise it
  // never clears and the chat auto-opens again on every later visit to this
  // same booking, even a plain "view details" click.
  useEffect(() => {
    if (autoOpenChatBookingId && selectedId === autoOpenChatBookingId) {
      onChatAutoOpenConsumed?.();
    }
  }, [selectedId, autoOpenChatBookingId, onChatAutoOpenConsumed]);

  async function refresh() {
    if (!currentUser) return;
    try {
      const [myBookings, allBookable] = await Promise.all([
        listBookingsForCounsellor(currentUser.uid),
        listBookableProfiles(),
      ]);
      setBookings(myBookings);

      // Resolve each student's own display name (if they've set one) so the
      // list can show that instead of their email — offline-imported "clients"
      // have a synthetic id and no real profile, so they're skipped.
      const uniqueUserIds = [...new Set(myBookings.map((b) => b.userId))].filter(
        (id) => !id.startsWith("offline:"),
      );
      const profiles = await Promise.all(uniqueUserIds.map((id) => getUserProfile(id)));
      const nameMap = new Map<string, string>();
      uniqueUserIds.forEach((id, i) => {
        const name = profiles[i]?.displayName?.trim();
        if (name) nameMap.set(id, name);
      });
      setUserNames(nameMap);

      setTransferCandidates(allBookable.filter((p) => p.uid !== currentUser.uid));
      setCompensationCandidates(
        allBookable.filter((p) => p.uid !== currentUser.uid && p.campusId === profile?.campusId),
      );
      const head =
        allBookable.find((p) => p.role === "head" && p.campusId === profile?.campusId && p.uid !== currentUser.uid) ??
        null;
      setCampusHead(head);
      setLoadError(null);

      const newlyPending = myBookings.filter((b) => isSessionEndedPending(b) && !b.missedNotified);
      if (newlyPending.length > 0) {
        await Promise.all(newlyPending.map((b) => flagMissedSessionPending(b, head?.uid)));
        setBookings((prev) =>
          prev.map((b) => (newlyPending.some((p) => p.id === b.id) ? { ...b, missedNotified: true } : b)),
        );
      }
    } catch (err) {
      console.error("Failed to load booking requests:", err);
      setLoadError("Couldn't load booking requests. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, profile?.campusId]);

  // Same reasoning as BookingSection.tsx (the student's side): the list above
  // is a one-off fetch, so a student cancelling/rescheduling on their own
  // device would otherwise leave this tab showing stale data until reloaded.
  // Notifications are already a live stream, and every such action sends
  // this counsellor one, so re-fetching whenever a new one arrives keeps this
  // list current without a realtime listener of its own.
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

  async function handleViewSummary(booking: Booking) {
    setHistoryState({ clientEmail: booking.userEmail, history: [], loading: true });
    const history = await getFollowUpHistory(booking.id);
    setHistoryState({ clientEmail: booking.userEmail, history, loading: false });
  }

  if (loading) return null;

  if (loadError) {
    return (
      <div className="booking-requests-section">
        <p>{loadError}</p>
        <Button type="button" variant="outlined" onClick={() => refresh()}>
          Retry
        </Button>
      </div>
    );
  }

  const newRequests = bookings.filter((b) => NEW_STATUSES.includes(b.status));
  const upcoming = bookings.filter((b) => UPCOMING_STATUSES.includes(b.status) && !isSessionEndedPending(b));
  const completed = bookings.filter((b) => COMPLETED_STATUSES.includes(b.status) && b.outcome !== "missed");
  const cancelled = bookings.filter((b) => CANCELLED_STATUSES.includes(b.status));
  const missed = bookings.filter(
    (b) => (b.status === "completed" && b.outcome === "missed") || isSessionEndedPending(b),
  );
  const upcomingFollowUps = upcoming.filter((b) => b.followUpOfBookingId);
  const upcomingNewSessions = upcoming.filter((b) => !b.followUpOfBookingId);
  const filteredCompleted = completed.filter((b) => {
    if (!completedFilterMonth && !completedFilterYear) return true;
    const d = completedDate(b);
    if (completedFilterMonth && d.getMonth() + 1 !== completedFilterMonth) return false;
    if (completedFilterYear && d.getFullYear() !== completedFilterYear) return false;
    return true;
  });
  const completedFiltersActive = completedFilterMonth !== 0 || completedFilterYear !== 0;
  const filteredCancelled = cancelled.filter((b) => {
    if (!cancelledFilterMonth && !cancelledFilterYear) return true;
    const d = completedDate(b);
    if (cancelledFilterMonth && d.getMonth() + 1 !== cancelledFilterMonth) return false;
    if (cancelledFilterYear && d.getFullYear() !== cancelledFilterYear) return false;
    return true;
  });
  const cancelledFiltersActive = cancelledFilterMonth !== 0 || cancelledFilterYear !== 0;
  const filteredMissed = missed.filter((b) => {
    if (!missedFilterMonth && !missedFilterYear) return true;
    const d = completedDate(b);
    if (missedFilterMonth && d.getMonth() + 1 !== missedFilterMonth) return false;
    if (missedFilterYear && d.getFullYear() !== missedFilterYear) return false;
    return true;
  });
  const missedFiltersActive = missedFilterMonth !== 0 || missedFilterYear !== 0;

  const tabCounts: Record<Tab, number> = {
    new: newRequests.length,
    upcoming: upcoming.length,
    completed: completed.length,
    cancelled: cancelled.length,
    missed: missed.length,
  };

  // Looked up from the full, unfiltered list so the modal stays open and correct
  // even if the booking's status change moves it into a different tab bucket.
  const selectedBooking = bookings.find((b) => b.id === selectedId) ?? null;
  const showViewSummary =
    !!selectedBooking?.followUpOfBookingId && UPCOMING_STATUSES.includes(selectedBooking.status);

  return (
    <div className="booking-requests-section">
      <div className="booking-requests-section__header">
        <div className="booking-requests-section__tabs">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`booking-requests-section__tab ${activeTab === tab.id ? "booking-requests-section__tab--active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}{tab.showCount ? ` (${tabCounts[tab.id]})` : ""}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "new" &&
        (newRequests.length === 0 ? (
          <p>No new requests.</p>
        ) : (
          newRequests.map((b) => <RequestCard key={b.id} booking={b} displayName={userNames.get(b.userId)} onClick={() => setSelectedId(b.id)} />)
        ))}

      {activeTab === "upcoming" && (
        <>
          <div className="booking-requests-section__group">
            <h3 className="booking-requests-section__group-title">Follow-up Sessions</h3>
            {upcomingFollowUps.length === 0 ? (
              <p>No follow-up sessions.</p>
            ) : (
              upcomingFollowUps.map((b) => (
                <RequestCard key={b.id} booking={b} displayName={userNames.get(b.userId)} onClick={() => setSelectedId(b.id)} />
              ))
            )}
          </div>
          <div className="booking-requests-section__group">
            <h3 className="booking-requests-section__group-title">New Sessions</h3>
            {upcomingNewSessions.length === 0 ? (
              <p>No new sessions.</p>
            ) : (
              upcomingNewSessions.map((b) => (
                <RequestCard key={b.id} booking={b} displayName={userNames.get(b.userId)} onClick={() => setSelectedId(b.id)} />
              ))
            )}
          </div>
        </>
      )}

      {activeTab === "completed" && (
        <>
          {completed.length > 0 && (
            <div className="booking-requests-section__filters">
              <div className="booking-requests-section__filter-field">
                <label htmlFor="completed-filter-month">Month</label>
                <Select
                  id="completed-filter-month"
                  value={String(completedFilterMonth)}
                  onChange={(v) => setCompletedFilterMonth(Number(v))}
                >
                  <option value="0">All months</option>
                  {MONTHS.map((m, i) => (
                    <option key={m} value={String(i + 1)}>{m}</option>
                  ))}
                </Select>
              </div>
              <div className="booking-requests-section__filter-field">
                <label htmlFor="completed-filter-year">Year</label>
                <Select
                  id="completed-filter-year"
                  value={String(completedFilterYear)}
                  onChange={(v) => setCompletedFilterYear(Number(v))}
                >
                  <option value="0">All years</option>
                  {YEARS.map((y) => (
                    <option key={y} value={String(y)}>{y}</option>
                  ))}
                </Select>
              </div>
              {completedFiltersActive && (
                <Button
                  type="button"
                  variant="outlined"
                  onClick={() => {
                    setCompletedFilterMonth(0);
                    setCompletedFilterYear(0);
                  }}
                >
                  Clear filters
                </Button>
              )}
              <span className="booking-requests-section__filter-count">
                {filteredCompleted.length} of {completed.length}
              </span>
            </div>
          )}

          {filteredCompleted.length === 0 ? (
            <p>{completed.length === 0 ? "No completed sessions yet." : "No sessions match the selected filters."}</p>
          ) : (
            filteredCompleted.map((b) => <RequestCard key={b.id} booking={b} displayName={userNames.get(b.userId)} onClick={() => setSelectedId(b.id)} />)
          )}
        </>
      )}

      {activeTab === "cancelled" && (
        <>
          {cancelled.length > 0 && (
            <div className="booking-requests-section__filters">
              <div className="booking-requests-section__filter-field">
                <label htmlFor="cancelled-filter-month">Month</label>
                <Select
                  id="cancelled-filter-month"
                  value={String(cancelledFilterMonth)}
                  onChange={(v) => setCancelledFilterMonth(Number(v))}
                >
                  <option value="0">All months</option>
                  {MONTHS.map((m, i) => (
                    <option key={m} value={String(i + 1)}>{m}</option>
                  ))}
                </Select>
              </div>
              <div className="booking-requests-section__filter-field">
                <label htmlFor="cancelled-filter-year">Year</label>
                <Select
                  id="cancelled-filter-year"
                  value={String(cancelledFilterYear)}
                  onChange={(v) => setCancelledFilterYear(Number(v))}
                >
                  <option value="0">All years</option>
                  {YEARS.map((y) => (
                    <option key={y} value={String(y)}>{y}</option>
                  ))}
                </Select>
              </div>
              {cancelledFiltersActive && (
                <Button
                  type="button"
                  variant="outlined"
                  onClick={() => {
                    setCancelledFilterMonth(0);
                    setCancelledFilterYear(0);
                  }}
                >
                  Clear filters
                </Button>
              )}
              <span className="booking-requests-section__filter-count">
                {filteredCancelled.length} of {cancelled.length}
              </span>
            </div>
          )}

          {filteredCancelled.length === 0 ? (
            <p>{cancelled.length === 0 ? "No cancelled or rejected requests yet." : "No sessions match the selected filters."}</p>
          ) : (
            filteredCancelled.map((b) => <RequestCard key={b.id} booking={b} displayName={userNames.get(b.userId)} onClick={() => setSelectedId(b.id)} />)
          )}
        </>
      )}

      {activeTab === "missed" && (
        <>
          {missed.length > 0 && (
            <div className="booking-requests-section__filters">
              <div className="booking-requests-section__filter-field">
                <label htmlFor="missed-filter-month">Month</label>
                <Select
                  id="missed-filter-month"
                  value={String(missedFilterMonth)}
                  onChange={(v) => setMissedFilterMonth(Number(v))}
                >
                  <option value="0">All months</option>
                  {MONTHS.map((m, i) => (
                    <option key={m} value={String(i + 1)}>{m}</option>
                  ))}
                </Select>
              </div>
              <div className="booking-requests-section__filter-field">
                <label htmlFor="missed-filter-year">Year</label>
                <Select
                  id="missed-filter-year"
                  value={String(missedFilterYear)}
                  onChange={(v) => setMissedFilterYear(Number(v))}
                >
                  <option value="0">All years</option>
                  {YEARS.map((y) => (
                    <option key={y} value={String(y)}>{y}</option>
                  ))}
                </Select>
              </div>
              {missedFiltersActive && (
                <Button
                  type="button"
                  variant="outlined"
                  onClick={() => {
                    setMissedFilterMonth(0);
                    setMissedFilterYear(0);
                  }}
                >
                  Clear filters
                </Button>
              )}
              <span className="booking-requests-section__filter-count">
                {filteredMissed.length} of {missed.length}
              </span>
            </div>
          )}

          {filteredMissed.length === 0 ? (
            <p>{missed.length === 0 ? "No missed sessions." : "No sessions match the selected filters."}</p>
          ) : (
            filteredMissed.map((b) => <RequestCard key={b.id} booking={b} displayName={userNames.get(b.userId)} onClick={() => setSelectedId(b.id)} />)
          )}
        </>
      )}

      {selectedBooking && (
        <RequestDetailModal
          key={selectedBooking.id}
          booking={selectedBooking}
          transferCandidates={transferCandidates}
          compensationCandidates={compensationCandidates}
          campusHead={campusHead}
          viewerRole={profile?.role === "head" ? "head" : "counsellor"}
          autoOpenChat={!!autoOpenChatBookingId && selectedBooking.id === autoOpenChatBookingId}
          onClose={() => setSelectedId(null)}
          onViewSummary={showViewSummary ? () => handleViewSummary(selectedBooking) : undefined}
          onSuggestSsi={async () => {
            await suggestSsiTest(selectedBooking);
            await refresh();
          }}
          onAcceptSlot={async (chosenAt) => {
            await acceptProposedSlot(selectedBooking, chosenAt);
            await refresh();
          }}
          onAcceptEmergency={async () => {
            if (!currentUser) return;
            await claimEmergencyBooking(selectedBooking, { uid: currentUser.uid, email: profile?.email ?? "" });
            await refresh();
          }}
          onReject={async () => {
            await rejectBooking(selectedBooking);
            await refresh();
          }}
          onSchedule={async (scheduledAt) => {
            await scheduleBooking(selectedBooking, scheduledAt);
            await refresh();
          }}
          onRequestReschedule={async (proposedAt, reason) => {
            await requestReschedule(selectedBooking, "counsellor", proposedAt, reason);
            await refresh();
          }}
          onAcceptReschedule={async () => {
            await acceptRescheduleProposal(selectedBooking);
            await refresh();
          }}
          onCancel={async (reason) => {
            await cancelBooking(selectedBooking, "counsellor", reason);
            // If this was a transferred session that the counsellor couldn't take,
            // re-notify the head so they can reassign it to another counsellor.
            if (selectedBooking.transferredFrom && selectedBooking.status === "pending" && campusHead) {
              await notifyHeadTransferSessionCancelled(
                selectedBooking,
                campusHead.uid,
                profile?.email ?? "",
                reason,
              );
            }
            await refresh();
          }}
          onRequestTransfer={async (reason, suggestedTarget) => {
            if (!currentUser || !campusHead) return;
            await requestBookingTransfer(
              selectedBooking,
              { uid: currentUser.uid, email: profile?.email ?? "" },
              campusHead.uid,
              reason,
              suggestedTarget ? { uid: suggestedTarget.uid, email: suggestedTarget.email } : undefined,
            );
            await refresh();
          }}
          onDirectTransfer={async (target) => {
            await transferBooking(selectedBooking, { uid: target.uid, email: target.email }, selectedBooking.counsellorId);
            await refresh();
          }}
          onSaveSummary={async (summary) => {
            await saveSessionSummary(selectedBooking.id, summary);
            await refresh();
          }}
          onShareSummary={async (summary) => {
            await shareSessionSummary(selectedBooking, summary);
            await refresh();
          }}
          onCloseComplete={async (summary) => {
            await saveSessionSummary(selectedBooking.id, summary);
            await closeBooking(selectedBooking, "completed");
            await refresh();
          }}
          onCloseFollowUp={async (summary, scheduledAt) => {
            await saveSessionSummary(selectedBooking.id, summary);
            const intake = await getBookingIntake(selectedBooking.id);
            if (intake) {
              await createFollowUpBooking(selectedBooking, intake, scheduledAt);
            }
            await closeBooking(selectedBooking, "followup");
            await refresh();
          }}
          onCloseMissed={async (reason) => {
            await closeMissedSession(selectedBooking, reason, campusHead?.uid);
            await refresh();
          }}
          onOfferCompensation={
            currentUser && profile?.role === "head"
              ? async () => {
                  await offerCompensationSession(selectedBooking, { uid: currentUser.uid, email: profile?.email ?? "" });
                  await refresh();
                }
              : undefined
          }
          onScheduleCompensation={async (counsellor, scheduledAt) => {
            const intake = await getBookingIntake(selectedBooking.id);
            if (intake) {
              await scheduleCompensationSession(selectedBooking, intake, counsellor, scheduledAt);
            }
            await refresh();
          }}
          onRateUser={async (rating, note) => {
            await rateUser(selectedBooking.id, rating, note || undefined);
            await refresh();
          }}
        />
      )}

      {historyState && (
        <SessionHistoryModal
          clientEmail={historyState.clientEmail}
          history={historyState.history}
          loading={historyState.loading}
          onClose={() => setHistoryState(null)}
        />
      )}

      {importOpen && currentUser && (
        <Suspense fallback={null}>
          <ImportSessionsModal
            counsellor={{ uid: currentUser.uid, email: profile?.email ?? "" }}
            onClose={() => onImportClose?.()}
            onImported={refresh}
          />
        </Suspense>
      )}
    </div>
  );
}

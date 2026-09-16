import { lazy, Suspense, useEffect, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import {
  listBookingsForCounsellor,
  listBookableProfiles,
  acceptProposedSlot,
  rejectBooking,
  scheduleBooking,
  requestReschedule,
  acceptRescheduleProposal,
  cancelBooking,
  requestBookingTransfer,
  transferBooking,
  saveSessionSummary,
  closeBooking,
  closeMissedSession,
  createFollowUpBooking,
  flagMissedSessionPending,
  getBookingIntake,
  isSessionEndedPending,
  rateUser,
  getFollowUpHistory,
  notifyHeadTransferSessionCancelled,
} from "../../services/firebase/bookings";
import type { Booking } from "../../types/booking";
import type { UserProfile } from "../../types/user";
import { RequestCard } from "../../components/booking/RequestCard";
import { RequestDetailModal } from "../../components/booking/RequestDetailModal";
import { SessionHistoryModal } from "../../components/booking/SessionHistoryModal";
import "./BookingRequestsSection.css";

const ImportSessionsModal = lazy(() =>
  import("../../components/booking/ImportSessionsModal").then((m) => ({ default: m.ImportSessionsModal })),
);

type Tab = "new" | "upcoming" | "completed" | "missed";

const TABS: { id: Tab; label: string }[] = [
  { id: "new", label: "New Requests" },
  { id: "upcoming", label: "Upcoming Sessions" },
  { id: "completed", label: "Completed" },
  { id: "missed", label: "Missed Sessions" },
];

const NEW_STATUSES = ["pending"];
const UPCOMING_STATUSES = ["accepted", "scheduled"];
const COMPLETED_STATUSES = ["completed", "cancelled", "rejected"];

interface HistoryState {
  clientEmail: string;
  history: { scheduledAt?: number; summary?: string }[];
  loading: boolean;
}

interface BookingRequestsSectionProps {
  importOpen?: boolean;
  onImportClose?: () => void;
  initialSelectedId?: string;
}

export function BookingRequestsSection({ importOpen = false, onImportClose, initialSelectedId }: BookingRequestsSectionProps) {
  const { currentUser, profile } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [transferCandidates, setTransferCandidates] = useState<UserProfile[]>([]);
  const [campusHead, setCampusHead] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("new");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [historyState, setHistoryState] = useState<HistoryState | null>(null);

  useEffect(() => {
    if (initialSelectedId) setSelectedId(initialSelectedId);
  }, [initialSelectedId]);

  async function refresh() {
    if (!currentUser) return;
    const [myBookings, allBookable] = await Promise.all([
      listBookingsForCounsellor(currentUser.uid),
      listBookableProfiles(),
    ]);
    setBookings(myBookings);
    setTransferCandidates(allBookable.filter((p) => p.uid !== currentUser.uid));
    setCampusHead(
      allBookable.find((p) => p.role === "head" && p.campusId === profile?.campusId && p.uid !== currentUser.uid) ??
        null,
    );
    setLoading(false);

    const newlyPending = myBookings.filter((b) => isSessionEndedPending(b) && !b.missedNotified);
    if (newlyPending.length > 0) {
      await Promise.all(newlyPending.map((b) => flagMissedSessionPending(b)));
      setBookings((prev) =>
        prev.map((b) => (newlyPending.some((p) => p.id === b.id) ? { ...b, missedNotified: true } : b)),
      );
    }
  }

  useEffect(() => {
    refresh();
  }, [currentUser]);

  async function handleViewSummary(booking: Booking) {
    setHistoryState({ clientEmail: booking.userEmail, history: [], loading: true });
    const history = await getFollowUpHistory(booking.id);
    setHistoryState({ clientEmail: booking.userEmail, history, loading: false });
  }

  if (loading) return null;

  const newRequests = bookings.filter((b) => NEW_STATUSES.includes(b.status));
  const upcoming = bookings.filter((b) => UPCOMING_STATUSES.includes(b.status) && !isSessionEndedPending(b));
  const completed = bookings.filter((b) => COMPLETED_STATUSES.includes(b.status) && b.outcome !== "missed");
  const missed = bookings.filter(
    (b) => (b.status === "completed" && b.outcome === "missed") || isSessionEndedPending(b),
  );
  const upcomingFollowUps = upcoming.filter((b) => b.followUpOfBookingId);
  const upcomingNewSessions = upcoming.filter((b) => !b.followUpOfBookingId);

  const tabCounts: Record<Tab, number> = {
    new: newRequests.length,
    upcoming: upcoming.length,
    completed: completed.length,
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
              {tab.label} ({tabCounts[tab.id]})
            </button>
          ))}
        </div>
      </div>

      {activeTab === "new" &&
        (newRequests.length === 0 ? (
          <p>No new requests.</p>
        ) : (
          newRequests.map((b) => <RequestCard key={b.id} booking={b} onClick={() => setSelectedId(b.id)} />)
        ))}

      {activeTab === "upcoming" && (
        <>
          <div className="booking-requests-section__group">
            <h3 className="booking-requests-section__group-title">Follow-up Sessions</h3>
            {upcomingFollowUps.length === 0 ? (
              <p>No follow-up sessions.</p>
            ) : (
              upcomingFollowUps.map((b) => (
                <RequestCard key={b.id} booking={b} onClick={() => setSelectedId(b.id)} />
              ))
            )}
          </div>
          <div className="booking-requests-section__group">
            <h3 className="booking-requests-section__group-title">New Sessions</h3>
            {upcomingNewSessions.length === 0 ? (
              <p>No new sessions.</p>
            ) : (
              upcomingNewSessions.map((b) => (
                <RequestCard key={b.id} booking={b} onClick={() => setSelectedId(b.id)} />
              ))
            )}
          </div>
        </>
      )}

      {activeTab === "completed" &&
        (completed.length === 0 ? (
          <p>No completed sessions yet.</p>
        ) : (
          completed.map((b) => <RequestCard key={b.id} booking={b} onClick={() => setSelectedId(b.id)} />)
        ))}

      {activeTab === "missed" &&
        (missed.length === 0 ? (
          <p>No missed sessions.</p>
        ) : (
          missed.map((b) => <RequestCard key={b.id} booking={b} onClick={() => setSelectedId(b.id)} />)
        ))}

      {selectedBooking && (
        <RequestDetailModal
          booking={selectedBooking}
          transferCandidates={transferCandidates}
          campusHead={campusHead}
          viewerRole={profile?.role === "head" ? "head" : "counsellor"}
          onClose={() => setSelectedId(null)}
          onViewSummary={showViewSummary ? () => handleViewSummary(selectedBooking) : undefined}
          onAcceptSlot={async (chosenAt) => {
            await acceptProposedSlot(selectedBooking, chosenAt);
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
            await closeMissedSession(selectedBooking, reason);
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

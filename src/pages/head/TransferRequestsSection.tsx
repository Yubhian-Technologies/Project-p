import { useEffect, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import {
  listPendingTransferRequestsForCampus,
  listBookableProfiles,
  approveBookingTransfer,
  declineBookingTransfer,
} from "../../services/firebase/bookings";
import type { Booking } from "../../types/booking";
import type { UserProfile } from "../../types/user";
import { Card } from "../../components/common/Card";
import { Button } from "../../components/common/Button";
import { Select } from "../../components/common/Select";
import "./TransferRequestsSection.css";

export function TransferRequestsSection() {
  const { profile } = useAuth();
  const [requests, setRequests] = useState<Booking[]>([]);
  const [candidates, setCandidates] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [targetByBooking, setTargetByBooking] = useState<Record<string, string>>({});
  const [decliningId, setDecliningId] = useState<string | null>(null);
  const [declineNoteByBooking, setDeclineNoteByBooking] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function load() {
    if (!profile?.campusId) {
      setLoading(false);
      return;
    }
    const [pending, allBookable] = await Promise.all([
      listPendingTransferRequestsForCampus(profile.campusId),
      listBookableProfiles(),
    ]);
    setRequests(pending);
    setCandidates(allBookable.filter((p) => p.campusId === profile.campusId));
    setTargetByBooking((prev) => {
      const next = { ...prev };
      pending.forEach((b) => {
        if (!next[b.id] && b.transferRequest?.suggestedTargetId) {
          next[b.id] = b.transferRequest.suggestedTargetId;
        }
      });
      return next;
    });
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.campusId]);

  async function handleApprove(booking: Booking) {
    if (!profile) return;
    const targetId = targetByBooking[booking.id];
    const target = candidates.find((c) => c.uid === targetId);
    if (!target) return;
    setError("");
    setBusyId(booking.id);
    try {
      await approveBookingTransfer(booking, { uid: profile.uid }, { uid: target.uid, email: target.email });
      await load();
    } catch {
      setError("Couldn't approve this transfer. Please try again.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDecline(booking: Booking) {
    if (!profile) return;
    setError("");
    setBusyId(booking.id);
    try {
      await declineBookingTransfer(booking, { uid: profile.uid }, declineNoteByBooking[booking.id]?.trim() || undefined);
      setDecliningId(null);
      await load();
    } catch {
      setError("Couldn't decline this transfer. Please try again.");
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return null;

  if (!profile?.campusId) {
    return <p>Your account isn't assigned to a campus yet — contact a Super Admin.</p>;
  }

  return (
    <div className="transfer-requests">
      <p className="transfer-requests__intro">
        Counsellors on your campus request a transfer here instead of reassigning a session themselves — you decide
        who it goes to.
      </p>

      {error && <p className="transfer-requests__error">{error}</p>}

      {requests.length === 0 && <p>No pending transfer requests.</p>}

      <div className="transfer-requests__list">
        {requests.map((booking) => (
          <Card key={booking.id} className="transfer-requests__row">
            <div>
              <p className="transfer-requests__title">{booking.userEmail}'s session</p>
              <p className="transfer-requests__meta">
                Requested by {booking.transferRequest?.requestedByEmail} • currently {booking.counsellorEmail}
              </p>
              {booking.transferRequest?.reason && (
                <p className="transfer-requests__reason">"{booking.transferRequest.reason}"</p>
              )}
            </div>

            <div className="transfer-requests__actions">
              <Select
                value={targetByBooking[booking.id] ?? ""}
                onChange={(v) => setTargetByBooking((prev) => ({ ...prev, [booking.id]: v }))}
              >
                <option value="" disabled>
                  Select a counsellor…
                </option>
                {candidates
                  .filter((c) => c.uid !== booking.counsellorId)
                  .map((c) => (
                    <option key={c.uid} value={c.uid}>
                      {c.displayName || c.email}
                      {c.uid === booking.transferRequest?.suggestedTargetId ? " (suggested)" : ""}
                    </option>
                  ))}
              </Select>
              <Button
                type="button"
                disabled={!targetByBooking[booking.id] || busyId === booking.id}
                onClick={() => handleApprove(booking)}
              >
                {busyId === booking.id ? "Approving…" : "Approve & Transfer"}
              </Button>
              <Button
                type="button"
                variant="outlined"
                disabled={busyId === booking.id}
                onClick={() => setDecliningId(decliningId === booking.id ? null : booking.id)}
              >
                Decline
              </Button>
            </div>

            {decliningId === booking.id && (
              <div className="transfer-requests__decline">
                <textarea
                  rows={2}
                  placeholder="Note to the counsellor (optional)"
                  value={declineNoteByBooking[booking.id] ?? ""}
                  onChange={(e) => setDeclineNoteByBooking((prev) => ({ ...prev, [booking.id]: e.target.value }))}
                />
                <Button type="button" disabled={busyId === booking.id} onClick={() => handleDecline(booking)}>
                  {busyId === booking.id ? "Declining…" : "Confirm decline"}
                </Button>
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}

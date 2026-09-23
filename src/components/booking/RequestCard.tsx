import { Card } from "../common/Card";
import type { Booking } from "../../types/booking";
import "./RequestCard.css";

interface RequestCardProps {
  booking: Booking;
  /** The student's own display name, if they've set one — falls back to their email. */
  displayName?: string;
  onClick: () => void;
}

export function RequestCard({ booking, displayName, onClick }: RequestCardProps) {
  const isTransfer = booking.status === "pending" && !!booking.transferredFrom;
  const name = displayName?.trim() || booking.userEmail;

  return (
    <Card className="request-card request-card--collapsed" onClick={onClick}>
      <p className="request-card__name">
        {name}
        {booking.isEmergency && <span className="request-card__emergency-inline"> 🚨 Crisis SOS</span>}
        {booking.sessionMode === "offline" && (
          <span className="request-card__offline-inline"> (Offline)</span>
        )}
        {isTransfer && (
          <span className="request-card__status request-card__status--transfer" style={{ marginLeft: 8 }}>
            Transfer
          </span>
        )}
      </p>
      <span className="request-card__hint">View Details →</span>
    </Card>
  );
}


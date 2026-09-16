import { Card } from "../common/Card";
import type { Booking } from "../../types/booking";
import "./RequestCard.css";

interface RequestCardProps {
  booking: Booking;
  onClick: () => void;
}

export function RequestCard({ booking, onClick }: RequestCardProps) {
  const isTransfer = booking.status === "pending" && !!booking.transferredFrom;

  return (
    <Card className="request-card request-card--collapsed" onClick={onClick}>
      <p className="request-card__name">
        {booking.userEmail}
        {booking.sessionMode === "offline" && (
          <span className="request-card__offline-tag">Offline</span>
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


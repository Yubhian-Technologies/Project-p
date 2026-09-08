import { Card } from "../common/Card";
import type { Booking } from "../../types/booking";
import "./RequestCard.css";

interface RequestCardProps {
  booking: Booking;
  onClick: () => void;
}

export function RequestCard({ booking, onClick }: RequestCardProps) {
  return (
    <Card className="request-card request-card--collapsed" onClick={onClick}>
      <p className="request-card__name">{booking.userEmail}</p>
      <span className="request-card__hint">View Details →</span>
    </Card>
  );
}

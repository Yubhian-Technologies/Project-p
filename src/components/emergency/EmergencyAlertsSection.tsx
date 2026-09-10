import { useEffect, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import {
  acceptBooking,
  claimEmergencyBooking,
  getBookingIntake,
  listEmergencyBookingsForCampus,
} from "../../services/firebase/bookings";
import type { Booking, BookingIntake, BookingStatus } from "../../types/booking";
import { Button } from "../common/Button";
import "./EmergencyAlertsSection.css";

interface AlertRow {
  booking: Booking;
  intake: BookingIntake | null;
}

const STATUS_LABEL: Record<BookingStatus, string> = {
  pending: "Pending",
  accepted: "Accepted",
  scheduled: "Scheduled",
  rejected: "Rejected",
  cancelled: "Cancelled",
  completed: "Completed",
};

const ACTIVE_STATUSES: BookingStatus[] = ["pending", "accepted", "scheduled"];

// Shared by Head and Counsellor dashboards — every Crisis SOS a student
// dispatches on this campus shows up here for every staff member to see, not
// just whoever the booking happens to be formally assigned to, so an
// emergency can never rely on exactly one person noticing a notification.
export function EmergencyAlertsSection() {
  const { profile } = useAuth();
  const [rows, setRows] = useState<AlertRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);

  async function load() {
    if (!profile?.campusId) {
      setLoading(false);
      return;
    }
    const bookings = await listEmergencyBookingsForCampus(profile.campusId);
    const intakes = await Promise.all(bookings.map((b) => getBookingIntake(b.id)));
    setRows(bookings.map((booking, i) => ({ booking, intake: intakes[i] })));
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.campusId]);

  async function handleAccept(booking: Booking) {
    if (!profile) return;
    setAcceptingId(booking.id);
    try {
      if (booking.counsellorId === profile.uid) {
        await acceptBooking(booking);
      } else {
        // Any Head/Counsellor on the campus can claim it first — in a crisis,
        // speed matters more than the original best-guess assignment.
        await claimEmergencyBooking(booking, { uid: profile.uid, email: profile.email });
      }
      await load();
    } finally {
      setAcceptingId(null);
    }
  }

  if (loading) return null;

  if (!profile?.campusId) {
    return <p>Your account isn't assigned to a campus yet — contact a Super Admin.</p>;
  }

  const activeRows = rows.filter((r) => ACTIVE_STATUSES.includes(r.booking.status));
  const pastRows = rows.filter((r) => !ACTIVE_STATUSES.includes(r.booking.status));

  return (
    <div className="emergency-alerts">
      <p className="emergency-alerts__intro">
        Every Crisis SOS a student dispatches on your campus appears here in addition to the notification alert, so
        it's never missed even if one person doesn't see it in time.
      </p>

      {rows.length === 0 && <p className="emergency-alerts__empty">No emergency SOS requests on your campus yet.</p>}

      {activeRows.length > 0 && (
        <div className="emergency-alerts__list">
          {activeRows.map(({ booking, intake }) => (
            <AlertCard
              key={booking.id}
              booking={booking}
              intake={intake}
              accepting={acceptingId === booking.id}
              onAccept={() => handleAccept(booking)}
            />
          ))}
        </div>
      )}

      {pastRows.length > 0 && (
        <>
          <h3 className="emergency-alerts__section-title">Resolved</h3>
          <div className="emergency-alerts__list">
            {pastRows.map(({ booking, intake }) => (
              <AlertCard key={booking.id} booking={booking} intake={intake} accepting={false} onAccept={() => {}} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

interface AlertCardProps {
  booking: Booking;
  intake: BookingIntake | null;
  accepting: boolean;
  onAccept: () => void;
}

function AlertCard({ booking, intake, accepting, onAccept }: AlertCardProps) {
  const isActive = ACTIVE_STATUSES.includes(booking.status);
  return (
    <div className={`emergency-alerts__card${isActive ? " emergency-alerts__card--active" : ""}`}>
      <div className="emergency-alerts__card-header">
        <span className="emergency-alerts__badge">🚨 EMERGENCY</span>
        <span className={`emergency-alerts__status emergency-alerts__status--${booking.status}`}>
          {STATUS_LABEL[booking.status]}
        </span>
      </div>
      <p className="emergency-alerts__name">{intake?.username || booking.userEmail}</p>
      <p className="emergency-alerts__meta">
        {booking.userEmail} • {new Date(booking.createdAt).toLocaleString()}
      </p>
      {intake?.whatsappNumber && (
        <a className="emergency-alerts__call" href={`tel:${intake.whatsappNumber}`}>
          Call {intake.whatsappNumber} ↗
        </a>
      )}
      <p className="emergency-alerts__assigned">Assigned to: {booking.counsellorEmail}</p>
      {booking.status === "pending" && (
        <Button type="button" disabled={accepting} onClick={onAccept}>
          {accepting ? "Accepting…" : "Accept"}
        </Button>
      )}
    </div>
  );
}

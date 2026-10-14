import { useEffect, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import {
  acceptBooking,
  claimEmergencyBooking,
  getBookingIntake,
  listEmergencyBookingsForCampus,
} from "../../services/firebase/bookings";
import { getUserProfile } from "../../services/firebase/firestore";
import type { Booking, BookingIntake, BookingStatus } from "../../types/booking";
import type { UserProfile } from "../../types/user";
import { Button } from "../common/Button";
import { AlertTriangleIcon } from "../common/icons";
import { formatDateTimeDMY } from "../../utils/formatDate";
import { StudentBioDataModal } from "../booking/StudentBioDataModal";
import { NotifyAdminBlock } from "../booking/RequestDetailModal";
import { createSeriousCase, getSeriousCaseForBooking } from "../../services/firebase/seriousCases";
import type { SeriousCase } from "../../types/seriousCase";
import "./EmergencyAlertsSection.css";

interface AlertRow {
  booking: Booking;
  intake: BookingIntake | null;
  studentProfile: UserProfile | null;
  seriousCase: SeriousCase | null;
}

const ACTED_ON_STATUSES: BookingStatus[] = ["accepted", "scheduled", "completed"];

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
    const [intakes, profiles, cases] = await Promise.all([
      Promise.all(bookings.map((b) => getBookingIntake(b.id))),
      Promise.all(bookings.map((b) => getUserProfile(b.userId))),
      // A viewer who can't read a given case just sees it as not-yet-flagged.
      Promise.all(bookings.map((b) => getSeriousCaseForBooking(b.id).catch(() => null))),
    ]);
    setRows(
      bookings.map((booking, i) => ({
        booking,
        intake: intakes[i],
        studentProfile: profiles[i],
        seriousCase: cases[i],
      })),
    );
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

  // Mirrors the createSeriousCase Cloud Function's own check: the booking's
  // own counsellor, or the Head of the campus.
  function canNotify(booking: Booking): boolean {
    if (!profile) return false;
    if (profile.role === "head") return booking.campusId === profile.campusId;
    return profile.role === "counsellor" && booking.counsellorId === profile.uid;
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
          {activeRows.map(({ booking, intake, studentProfile, seriousCase }) => (
            <AlertCard
              key={booking.id}
              booking={booking}
              intake={intake}
              studentProfile={studentProfile}
              seriousCase={seriousCase}
              canNotify={canNotify(booking)}
              onNotified={load}
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
            {pastRows.map(({ booking, intake, studentProfile, seriousCase }) => (
              <AlertCard
                key={booking.id}
                booking={booking}
                intake={intake}
                studentProfile={studentProfile}
                seriousCase={seriousCase}
                canNotify={canNotify(booking)}
                onNotified={load}
                accepting={false}
                onAccept={() => {}}
              />
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
  studentProfile: UserProfile | null;
  seriousCase: SeriousCase | null;
  canNotify: boolean;
  onNotified: () => Promise<void>;
  accepting: boolean;
  onAccept: () => void;
}

function AlertCard({
  booking,
  intake,
  studentProfile,
  seriousCase,
  canNotify,
  onNotified,
  accepting,
  onAccept,
}: AlertCardProps) {
  const isActive = ACTIVE_STATUSES.includes(booking.status);
  const [showProfile, setShowProfile] = useState(false);
  const studentName = intake?.username || booking.userEmail;

  // mailto: only works if the device has a desktop mail app registered as
  // the default handler — on a machine without one (common on Windows),
  // the browser has nothing to open it with and just shows an app-picker
  // that can't actually do anything. Gmail's own web compose URL opens
  // directly in a new browser tab instead, with no OS-level handler
  // needed, so it always works. No fixed recipient on purpose — whoever
  // clicks this writes their own write-up and decides who it needs to go
  // to (a parent, another staff member, an external contact); only the
  // subject is pre-filled so the recipient immediately knows which case
  // it's about.
  const emailSubject = `Crisis SOS — ${studentName} — ${formatDateTimeDMY(booking.createdAt)}`;
  const emailHref = `https://mail.google.com/mail/?view=cm&fs=1&su=${encodeURIComponent(emailSubject)}`;

  return (
    <div className={`emergency-alerts__card${isActive ? " emergency-alerts__card--active" : ""}`}>
      <div className="emergency-alerts__card-header">
        <span className="emergency-alerts__badge"><AlertTriangleIcon /> EMERGENCY</span>
        <span className={`emergency-alerts__status emergency-alerts__status--${booking.status}`}>
          {STATUS_LABEL[booking.status]}
        </span>
      </div>
      <p className="emergency-alerts__name">{studentName}</p>
      <p className="emergency-alerts__meta">
        {booking.userEmail} • {formatDateTimeDMY(booking.createdAt)}
      </p>
      {intake?.whatsappNumber && (
        <a className="emergency-alerts__call" href={`tel:${intake.whatsappNumber}`}>
          Call {intake.whatsappNumber} ↗
        </a>
      )}
      <p className="emergency-alerts__assigned">Assigned to: {booking.counsellorEmail}</p>

      <div className="emergency-alerts__actions">
        {studentProfile && (
          <Button type="button" variant="outlined" onClick={() => setShowProfile(true)}>
            View Profile
          </Button>
        )}
        {/* Only once this case has actually been taken on — sending a
            write-up about a request nobody has accepted yet doesn't make
            sense. A plain anchor styled like a Button, not a Button wrapped
            in one — a <button> nested inside an <a> is invalid HTML. */}
        {ACTED_ON_STATUSES.includes(booking.status) && (
          <a className="md-button md-button--outlined" href={emailHref} target="_blank" rel="noopener noreferrer">
            Email
          </a>
        )}
        {booking.status === "pending" && (
          <Button type="button" disabled={accepting} onClick={onAccept}>
            {accepting ? "Accepting…" : "Accept"}
          </Button>
        )}
        {/* Same createSeriousCase flow as the Requests screen — the Cloud
            Function routes it to the college's Principal/Vice-Principal
            (with the usual fallback chain), landing in their Serious Cases. */}
        {ACTED_ON_STATUSES.includes(booking.status) && (canNotify || seriousCase) && (
          <NotifyAdminBlock
            seriousCase={seriousCase}
            buttonLabel="Notify"
            onNotify={
              canNotify
                ? async (note) => {
                    await createSeriousCase(booking.id, note);
                    await onNotified();
                  }
                : undefined
            }
          />
        )}
      </div>

      {showProfile && studentProfile && (
        <StudentBioDataModal studentProfile={studentProfile} onClose={() => setShowProfile(false)} />
      )}
    </div>
  );
}

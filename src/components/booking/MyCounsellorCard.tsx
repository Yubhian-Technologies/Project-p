import { useEffect, useState } from "react";
import { Avatar } from "../common/Avatar";
import { Button } from "../common/Button";
import { MapPinIcon, StarIcon } from "../common/icons";
import { fetchCounsellorReviews, type CounsellorReview } from "../../services/firebase/bookings";
import type { UserProfile } from "../../types/user";
import type { Booking } from "../../types/booking";
import type { LiveStatus } from "../../utils/counsellorStatus";
import { liveStatusLabel } from "../../utils/counsellorStatus";
import "./MyCounsellorCard.css";

interface MyCounsellorCardProps {
  profile: UserProfile;
  status: LiveStatus;
  bookingDisabled: boolean;
  onBook: () => void;
  /** A booking with this specific person to open the chat for — undefined
      when there's no booking history with them yet, in which case there's
      no chat room to send a message into, so the button is left out. */
  chatBooking?: Booking;
  onOpenChat: (booking: Booking) => void;
}

const SESSION_TYPE_LABEL: Record<string, string> = {
  online: "Online",
  offline: "Offline",
  both: "Online & Offline",
};

/** "My Counsellor" (CampusCounsellorsSection) — there's only ever the one
    counsellor/head assigned to a student's own college, so this is shown
    directly on the page, no click-to-reveal popup. Deliberately its own
    component rather than a reskin of CounsellorProfileDetails (used by
    BookingSection's separate "pick one of several" modal, which keeps its
    existing compact layout unchanged). */
export function MyCounsellorCard({
  profile,
  status,
  bookingDisabled,
  onBook,
  chatBooking,
  onOpenChat,
}: MyCounsellorCardProps) {
  const [reviews, setReviews] = useState<CounsellorReview[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(true);

  useEffect(() => {
    setLoadingReviews(true);
    fetchCounsellorReviews(profile.uid)
      .then(setReviews)
      .catch((err) => {
        console.error("Failed to load counsellor reviews:", err);
        setReviews([]);
      })
      .finally(() => setLoadingReviews(false));
  }, [profile.uid]);

  const avgRating = reviews.length > 0 ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : 0;
  const hasQualifications =
    profile.educationDegree ||
    profile.educationInstitution ||
    profile.experience ||
    profile.currentOrganization ||
    (profile.certifications?.length ?? 0) > 0;

  return (
    <div className="my-counsellor">
      <div className="my-counsellor__card">
        <Avatar photoURL={profile.photoURL} label={profile.email} size="xl" shape="circle" />
        <p className="my-counsellor__name">{profile.displayName || profile.email}</p>
        {profile.specialization && <p className="my-counsellor__specialization">{profile.specialization}</p>}
        {profile.location && (
          <p className="my-counsellor__location">
            <MapPinIcon /> {profile.location}
          </p>
        )}
        {!loadingReviews && reviews.length > 0 && (
          <p className="my-counsellor__rating">
            <StarIcon /> {avgRating.toFixed(1)} ({reviews.length} review{reviews.length === 1 ? "" : "s"})
          </p>
        )}
        <div className="my-counsellor__badges">
          <span className={`my-counsellor__badge my-counsellor__badge--${status}`}>
            <span className="my-counsellor__badge-dot" />
            {liveStatusLabel(status)}
          </span>
          {profile.experience && <span className="my-counsellor__badge my-counsellor__badge--neutral">{profile.experience}</span>}
        </div>

        <Button type="button" disabled={status !== "available" || bookingDisabled} onClick={onBook}>
          Book a Session
        </Button>
        {chatBooking && (
          <Button type="button" variant="outlined" onClick={() => onOpenChat(chatBooking)}>
            Send Message
          </Button>
        )}
        {bookingDisabled && (
          <p className="my-counsellor__hint">
            You already have an active booking — finish, cancel, or wait for it to complete before booking another
            session.
          </p>
        )}
        {!bookingDisabled && status !== "available" && (
          <p className="my-counsellor__hint">This counsellor isn't available to book right now.</p>
        )}
      </div>

      <div className="my-counsellor__details">
        {profile.bio && (
          <section className="my-counsellor__section">
            <h3 className="my-counsellor__section-title">About {profile.displayName || profile.email}</h3>
            <p className="my-counsellor__section-body">{profile.bio}</p>
          </section>
        )}

        {profile.areasOfExpertise && profile.areasOfExpertise.length > 0 && (
          <section className="my-counsellor__section">
            <h3 className="my-counsellor__section-title">Areas of Expertise</h3>
            <div className="my-counsellor__chips">
              {profile.areasOfExpertise.map((item) => (
                <span key={item} className="my-counsellor__chip">
                  {item}
                </span>
              ))}
            </div>
          </section>
        )}

        {hasQualifications && (
          <section className="my-counsellor__section">
            <h3 className="my-counsellor__section-title">Qualifications &amp; Credentials</h3>
            <div className="my-counsellor__quals-grid">
              {(profile.educationDegree || profile.educationInstitution) && (
                <div className="my-counsellor__field">
                  <span className="my-counsellor__field-label">Education</span>
                  {profile.educationDegree && <p className="my-counsellor__field-value">{profile.educationDegree}</p>}
                  {profile.educationInstitution && (
                    <p className="my-counsellor__field-value my-counsellor__field-value--muted">
                      {profile.educationInstitution}
                    </p>
                  )}
                </div>
              )}
              {(profile.experience || profile.currentOrganization) && (
                <div className="my-counsellor__field">
                  <span className="my-counsellor__field-label">Professional Experience</span>
                  {profile.experience && <p className="my-counsellor__field-value">{profile.experience}</p>}
                  {profile.currentOrganization && (
                    <p className="my-counsellor__field-value my-counsellor__field-value--muted">
                      {profile.currentOrganization}
                    </p>
                  )}
                </div>
              )}
            </div>
            {profile.certifications && profile.certifications.length > 0 && (
              <div className="my-counsellor__field">
                <span className="my-counsellor__field-label">Certificates</span>
                <div className="my-counsellor__chips">
                  {profile.certifications.map((item) => (
                    <span key={item} className="my-counsellor__chip">
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <span className="my-counsellor__verified">✓ Certified Counsellor</span>
          </section>
        )}

        <section className="my-counsellor__section">
          <h3 className="my-counsellor__section-title">Consultation</h3>
          <div className="my-counsellor__consultation-grid">
            {profile.sessionType && (
              <div className="my-counsellor__field">
                <span className="my-counsellor__field-label">Session type</span>
                <p className="my-counsellor__field-value">{SESSION_TYPE_LABEL[profile.sessionType]}</p>
              </div>
            )}
            <div className="my-counsellor__field">
              <span className="my-counsellor__field-label">Available Time</span>
              <p className="my-counsellor__field-value">Monday to Saturday</p>
              <p className="my-counsellor__field-value">9:00 AM – 5:00 PM</p>
            </div>
            {profile.languages && profile.languages.length > 0 && (
              <div className="my-counsellor__field">
                <span className="my-counsellor__field-label">Languages</span>
                <p className="my-counsellor__field-value">{profile.languages.join(", ")}</p>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

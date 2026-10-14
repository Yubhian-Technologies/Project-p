import { useEffect, useState } from "react";
import { Avatar } from "../common/Avatar";
import { Button } from "../common/Button";
import { StarRating } from "../common/StarRating";
import { MapPinIcon } from "../common/icons";
import { fetchCounsellorReviews, type CounsellorReview } from "../../services/firebase/bookings";
import type { UserProfile } from "../../types/user";
import type { LiveStatus } from "../../utils/counsellorStatus";
import { liveStatusLabel } from "../../utils/counsellorStatus";
import "./CounsellorProfileModal.css";

interface CounsellorProfileDetailsProps {
  profile: UserProfile;
  status: LiveStatus;
  bookingDisabled: boolean;
  onBook: () => void;
  /** True only when rendered inside CounsellorProfileModal, where the
      modal's own fixed height needs this to scroll internally instead of
      flowing naturally with the rest of the page. */
  inModal?: boolean;
}

const SESSION_TYPE_LABEL: Record<string, string> = {
  online: "Online",
  offline: "Offline",
  both: "Online & Offline",
};

/** The full counsellor/head profile — bio, qualifications, approach,
    consultation details. Shared by CounsellorProfileModal (BookingSection's
    "pick one of several" flow) and rendered directly, with no popup, by
    CampusCounsellorsSection ("My Counsellor" — there's only ever the one
    person assigned to a student's own college, so a click-to-reveal modal
    is unnecessary ceremony there). */
export function CounsellorProfileDetails({
  profile,
  status,
  bookingDisabled,
  onBook,
  inModal = false,
}: CounsellorProfileDetailsProps) {
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

  const avgRating =
    reviews.length > 0 ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : 0;

  const hasConsultation = profile.sessionType || (profile.languages?.length ?? 0) > 0;

  return (
    <div className={`counsellor-profile ${inModal ? "counsellor-profile--modal" : "counsellor-profile--standalone"}`}>
      <div className="counsellor-profile__main">
        <div className="counsellor-profile__left">
          <Avatar photoURL={profile.photoURL} label={profile.email} size="xl" shape="square" />
          <p className="counsellor-profile__name">{profile.displayName || profile.email}</p>
        </div>

        <div className="counsellor-profile__right">
          {profile.specialization && (
            <p className="counsellor-profile__specialization">{profile.specialization}</p>
          )}

          {profile.location && <p className="counsellor-profile__location"><MapPinIcon /> {profile.location}</p>}

          {!loadingReviews && reviews.length > 0 && <StarRating value={avgRating} count={reviews.length} />}

          <span className={`counsellor-profile__badge counsellor-profile__badge--${status}`}>
            {liveStatusLabel(status)}
          </span>

          {profile.experience && (
            <div className="counsellor-profile__field">
              <span className="counsellor-profile__field-label">Experience</span>
              <p className="counsellor-profile__field-value">{profile.experience}</p>
            </div>
          )}

          {profile.bio && (
            <section className="counsellor-profile__section">
              <h3 className="counsellor-profile__section-title">
                About {profile.displayName || profile.email}
              </h3>
              <p className="counsellor-profile__section-body">{profile.bio}</p>
            </section>
          )}

          {profile.areasOfExpertise && profile.areasOfExpertise.length > 0 && (
            <section className="counsellor-profile__section">
              <h3 className="counsellor-profile__section-title">Areas of Expertise</h3>
              <div className="counsellor-profile__chips">
                {profile.areasOfExpertise.map((item) => (
                  <span key={item} className="counsellor-profile__chip">
                    {item}
                  </span>
                ))}
              </div>
            </section>
          )}

          <section className="counsellor-profile__section">
            <h3 className="counsellor-profile__section-title">Qualifications &amp; Credentials</h3>

            {(profile.educationDegree || profile.educationInstitution) && (
              <div className="counsellor-profile__field">
                <span className="counsellor-profile__field-label">Education</span>
                {profile.educationDegree && <p className="counsellor-profile__field-value">{profile.educationDegree}</p>}
                {profile.educationInstitution && (
                  <p className="counsellor-profile__field-value counsellor-profile__field-value--muted">
                    {profile.educationInstitution}
                  </p>
                )}
              </div>
            )}

            {(profile.experience || profile.currentOrganization) && (
              <div className="counsellor-profile__field">
                <span className="counsellor-profile__field-label">Professional Experience</span>
                {profile.experience && <p className="counsellor-profile__field-value">{profile.experience}</p>}
                {profile.currentOrganization && (
                  <p className="counsellor-profile__field-value counsellor-profile__field-value--muted">
                    {profile.currentOrganization}
                  </p>
                )}
              </div>
            )}

            {profile.certifications && profile.certifications.length > 0 && (
              <div className="counsellor-profile__field">
                <span className="counsellor-profile__field-label">Certificates</span>
                <div className="counsellor-profile__chips">
                  {profile.certifications.map((item) => (
                    <span key={item} className="counsellor-profile__chip">
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <span className="counsellor-profile__verified">✓ Certified Counsellor</span>
          </section>

          {hasConsultation && (
            <section className="counsellor-profile__section">
              <h3 className="counsellor-profile__section-title">Consultation</h3>

              {profile.sessionType && (
                <div className="counsellor-profile__field">
                  <span className="counsellor-profile__field-label">Session type</span>
                  <p className="counsellor-profile__field-value">{SESSION_TYPE_LABEL[profile.sessionType]}</p>
                </div>
              )}

              {profile.languages && profile.languages.length > 0 && (
                <div className="counsellor-profile__field">
                  <span className="counsellor-profile__field-label">Languages</span>
                  <div className="counsellor-profile__chips">
                    {profile.languages.map((lang) => (
                      <span key={lang} className="counsellor-profile__chip">
                        {lang}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}
        </div>
      </div>

      <div className="counsellor-profile__footer">
        <Button type="button" disabled={status !== "available" || bookingDisabled} onClick={onBook}>
          Book Session
        </Button>
        {bookingDisabled && (
          <p className="counsellor-profile__footer-hint">
            You already have an active booking — finish, cancel, or wait for it to complete before booking
            another session.
          </p>
        )}
        {!bookingDisabled && status !== "available" && (
          <p className="counsellor-profile__footer-hint">
            This counsellor isn't available to book right now.
          </p>
        )}
      </div>
    </div>
  );
}

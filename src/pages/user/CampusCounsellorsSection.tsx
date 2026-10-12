import { useEffect, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import {
  listBookableProfiles,
  listScheduledBookings,
  listBookingsForUser,
  isSessionEndedPending,
} from "../../services/firebase/bookings";
import { CounsellorCard } from "../../components/booking/CounsellorCard";
import { CounsellorProfileModal } from "../../components/booking/CounsellorProfileModal";
import { computeLiveStatus } from "../../utils/counsellorStatus";
import type { UserProfile } from "../../types/user";
import type { Booking } from "../../types/booking";
import "./BookingSection.css";

const ACTIVE_STATUSES = ["pending", "accepted", "scheduled"];

interface CampusCounsellorsSectionProps {
  onBookCounsellor: (counsellorId: string) => void;
}

export function CampusCounsellorsSection({ onBookCounsellor }: CampusCounsellorsSectionProps) {
  const { currentUser, profile } = useAuth();
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [scheduledBookings, setScheduledBookings] = useState<Booking[]>([]);
  const [myBookings, setMyBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProfile, setSelectedProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const [p, b, mine] = await Promise.all([
          listBookableProfiles(),
          listScheduledBookings(),
          currentUser ? listBookingsForUser(currentUser.uid) : Promise.resolve([]),
        ]);
        if (cancelled) return;
        setProfiles(p);
        setScheduledBookings(b);
        setMyBookings(mine);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [currentUser]);

  if (loading) return null;

  // Mirrors the server-side rule in createBooking (one active booking per
  // student) — see BookingSection.tsx's own "+ Book a Session" guard.
  const hasActiveBooking = myBookings.some(
    (b) => ACTIVE_STATUSES.includes(b.status) && !(b.status === "scheduled" && isSessionEndedPending(b)),
  );

  // A Counsellor is scoped to one college, so they're matched by collegeId;
  // a Head oversees their whole campus (their own collegeId is a
  // mandatory-but-meaningless field on their account — never used as a real
  // scope anywhere else in this app), so they're matched by campusId
  // instead. Mirrors the identical rule in BookingSection.tsx and the
  // server-side check in createBooking. Inactive logins (Admin/Super Admin
  // "Status: Inactive") are also hidden — that account can't sign in to
  // handle a session anymore, so it shouldn't be bookable or even visible
  // here at all.
  const counsellorsAndHeads = profiles.filter((p) => {
    if (p.role !== "counsellor" && p.role !== "head") return false;
    if (p.active === false) return false;
    return p.role === "head" ? p.campusId === profile?.campusId : p.collegeId === profile?.collegeId;
  });

  return (
    <div className="booking-section">
      <section>
        {counsellorsAndHeads.length === 0 ? (
          <p>No campus counsellors are available at the moment.</p>
        ) : (
          <div className="booking-section__grid">
            {counsellorsAndHeads.map((p) => (
              <CounsellorCard
                key={p.uid}
                profile={p}
                status={computeLiveStatus(p, scheduledBookings)}
                onClick={() => setSelectedProfile(p)}
              />
            ))}
          </div>
        )}
      </section>

      {selectedProfile && (
        <CounsellorProfileModal
          profile={selectedProfile}
          status={computeLiveStatus(selectedProfile, scheduledBookings)}
          bookingDisabled={hasActiveBooking}
          onBook={() => {
            onBookCounsellor(selectedProfile.uid);
            setSelectedProfile(null);
          }}
          onClose={() => setSelectedProfile(null)}
        />
      )}
    </div>
  );
}

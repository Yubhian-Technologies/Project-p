import { useEffect, useState } from "react";
import { listBookableProfiles, listScheduledBookings } from "../../services/firebase/bookings";
import { CounsellorCard } from "../../components/booking/CounsellorCard";
import { CounsellorProfileModal } from "../../components/booking/CounsellorProfileModal";
import { computeLiveStatus } from "../../utils/counsellorStatus";
import type { UserProfile } from "../../types/user";
import type { Booking } from "../../types/booking";
import "./BookingSection.css";

interface CampusCounsellorsSectionProps {
  onBookCounsellor: (counsellorId: string) => void;
}

export function CampusCounsellorsSection({ onBookCounsellor }: CampusCounsellorsSectionProps) {
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [scheduledBookings, setScheduledBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProfile, setSelectedProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const [p, b] = await Promise.all([listBookableProfiles(), listScheduledBookings()]);
        if (cancelled) return;
        setProfiles(p);
        setScheduledBookings(b);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return null;

  const counsellorsAndHeads = profiles.filter((p) => p.role === "counsellor" || p.role === "head");

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
          bookingDisabled={false}
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

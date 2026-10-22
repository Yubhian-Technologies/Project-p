import { useEffect, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import {
  listBookableProfiles,
  listScheduledBookings,
  listBookingsForUser,
  isSessionEndedPending,
} from "../../services/firebase/bookings";
import { MyCounsellorCard } from "../../components/booking/MyCounsellorCard";
import { ChatModal } from "../../components/chat/ChatModal";
import { computeLiveStatus } from "../../utils/counsellorStatus";
import { subscribeActiveLeavesToday } from "../../services/firebase/leaves";
import type { LeaveRequest } from "../../types/leave";
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
  const [activeLeaves, setActiveLeaves] = useState<Record<string, LeaveRequest>>({});
  const [loading, setLoading] = useState(true);
  const [chatTarget, setChatTarget] = useState<Booking | null>(null);

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
    const unsubLeaves = subscribeActiveLeavesToday(setActiveLeaves);
    return () => {
      cancelled = true;
      unsubLeaves();
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

  // The booking "Send Message" opens — the same chat room BookingSection's
  // own "Chat" button already uses, just reached from here instead. Prefers
  // whichever booking with this person is currently active; otherwise the
  // most recent one. No booking with them at all yet means no chat room
  // exists, so MyCounsellorCard leaves the button out entirely.
  function bookingWith(uid: string): Booking | undefined {
    const withThem = myBookings.filter((b) => b.counsellorId === uid);
    const active = withThem.find(
      (b) => ACTIVE_STATUSES.includes(b.status) && !(b.status === "scheduled" && isSessionEndedPending(b)),
    );
    return active ?? [...withThem].sort((a, b) => b.createdAt - a.createdAt)[0];
  }

  return (
    <div className="booking-section">
      <section>
        {counsellorsAndHeads.length === 0 ? (
          <p>No campus counsellors are available at the moment.</p>
        ) : (
          // Only ever the one counsellor (+ the campus Head) assigned to this
          // student's own college — shown in full directly, no card-you-have-
          // to-click-for-details popup, since there's nothing to pick between.
          <div className="campus-counsellors__list">
            {counsellorsAndHeads.map((p) => {
              const isOnLeave = Boolean(activeLeaves[p.uid]);
              return (
                <MyCounsellorCard
                  key={p.uid}
                  profile={p}
                  status={computeLiveStatus(p, scheduledBookings, isOnLeave)}
                  bookingDisabled={hasActiveBooking || isOnLeave}
                  onBook={() => onBookCounsellor(p.uid)}
                  chatBooking={bookingWith(p.uid)}
                  onOpenChat={setChatTarget}
                />
              );
            })}
          </div>
        )}
      </section>

      {chatTarget && currentUser && profile && (
        <ChatModal
          chatRoomId={chatTarget.id}
          bookingId={chatTarget.id}
          counterpartName={chatTarget.counsellorEmail}
          counterpartRole={
            counsellorsAndHeads.find((p) => p.uid === chatTarget.counsellorId)?.role === "head" ? "head" : "counsellor"
          }
          currentUser={{
            uid: currentUser.uid,
            email: profile.email,
            displayName: profile.displayName,
            role: profile.role,
          }}
          onClose={() => setChatTarget(null)}
        />
      )}
    </div>
  );
}

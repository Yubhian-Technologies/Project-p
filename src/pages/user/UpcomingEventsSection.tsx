import { useEffect, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { listEventsForCampus } from "../../services/firebase/events";
import type { EventProgram } from "../../types/event";
import { EventCard } from "./EventCard";
import "./UpcomingEventsSection.css";

function istDateKey(ms: number): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(ms));
  const p = (t: string) => parts.find((x) => x.type === t)?.value ?? "";
  return `${p("year")}-${p("month")}-${p("day")}`;
}

export function UpcomingEventsSection() {
  const { profile } = useAuth();
  const [events, setEvents] = useState<EventProgram[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.campusId) {
      setLoading(false);
      return;
    }
    listEventsForCampus(profile.campusId)
      .then((list) => setEvents(list))
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, [profile?.campusId]);

  if (loading) return null;

  if (!profile?.campusId) {
    return <p>Your account isn't assigned to a campus yet — contact a Super Admin.</p>;
  }

  // Only what hasn't happened yet — once a day is over it simply disappears
  // from this list rather than sticking around marked "completed" the way
  // the staff management view keeps it for the record. Compared by IST
  // calendar day, not exact timestamp — otherwise a today's-event with a
  // morning time slot would vanish from this list the moment that time of
  // day passed, even though it's still today.
  const todayKey = istDateKey(Date.now());
  const upcoming = events
    .filter((e) => istDateKey(e.eventDate) >= todayKey)
    .sort((a, b) => a.eventDate - b.eventDate);

  return (
    <div className="upcoming-events">
      <p className="upcoming-events__intro">
        Upcoming events and programs on your campus.
      </p>

      {upcoming.length === 0 ? (
        <p className="upcoming-events__empty">No upcoming events right now — check back later.</p>
      ) : (
        <div className="upcoming-events__grid">
          {upcoming.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      )}
    </div>
  );
}

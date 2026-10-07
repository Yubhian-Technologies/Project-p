import { useEffect, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { listEventsForCampus } from "../../services/firebase/events";
import type { EventProgram } from "../../types/event";
import { CalendarIcon } from "../../components/common/icons";
import { EventPreviewModal } from "./EventPreviewModal";
import "./UpcomingEventsSection.css";

export function UpcomingEventsSection() {
  const { profile } = useAuth();
  const [events, setEvents] = useState<EventProgram[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<EventProgram | null>(null);

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

  // Only what hasn't happened yet — a past eventDate means it's finished, so
  // it simply disappears from this list rather than sticking around marked
  // "completed" the way the staff management view keeps it for the record.
  const now = Date.now();
  const upcoming = events.filter((e) => e.eventDate >= now).sort((a, b) => a.eventDate - b.eventDate);

  return (
    <div className="upcoming-events">
      <p className="upcoming-events__intro">
        Upcoming events and programs on your campus.
      </p>

      {upcoming.length === 0 ? (
        <p className="upcoming-events__empty">No upcoming events right now — check back later.</p>
      ) : (
        <div className="upcoming-events__list">
          {upcoming.map((event) => (
            <div key={event.id} className="upcoming-events__item">
              <span className="upcoming-events__icon">
                <CalendarIcon />
              </span>
              <div className="upcoming-events__details">
                <span className="upcoming-events__title">{event.title}</span>
                <span className="upcoming-events__date">
                  {new Date(event.eventDate).toLocaleDateString(undefined, {
                    weekday: "short",
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              </div>
              <button
                type="button"
                className="upcoming-events__view-btn"
                onClick={() => setSelected(event)}
              >
                View →
              </button>
            </div>
          ))}
        </div>
      )}

      {selected && <EventPreviewModal event={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

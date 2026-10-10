import { useEffect, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { listEventsForCampus } from "../../services/firebase/events";
import type { EventProgram } from "../../types/event";
import { BentoCard } from "../../components/common/BentoCard";
import { CalendarIcon } from "../../components/common/icons";
import { EventPreviewModal } from "./EventPreviewModal";
import { formatWeekdayDateDMY } from "../../utils/formatDate";

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

interface UpcomingEventsCardProps {
  onViewEvents: () => void;
}

/** Home-page summary of the campus's soonest upcoming events, with a link to
    the full "Events & Programs" section. */
export function UpcomingEventsCard({ onViewEvents }: UpcomingEventsCardProps) {
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
      .then(setEvents)
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, [profile?.campusId]);

  // Compared by IST calendar day, not exact timestamp — a today's-event with
  // a morning time slot would otherwise vanish the moment that time passed,
  // even though it's still today.
  const todayKey = istDateKey(Date.now());
  const upcoming = events
    .filter((e) => istDateKey(e.eventDate) >= todayKey)
    .sort((a, b) => a.eventDate - b.eventDate);
  const preview = upcoming.slice(0, 3);

  return (
    <BentoCard
      span={4}
      icon={<CalendarIcon />}
      title="Upcoming Events"
      subtitle="Programs and events happening on your campus."
      badge={upcoming.length > 0 ? { text: `${upcoming.length}`, variant: "primary" } : undefined}
      action={{ label: "View All Events →", onClick: onViewEvents }}
    >
      {loading ? (
        <p style={{ fontSize: 13, color: "var(--neu-text-muted, #718096)" }}>Loading…</p>
      ) : preview.length === 0 ? (
        <p style={{ fontSize: 13, color: "var(--neu-text-muted, #718096)" }}>
          No upcoming events right now — check back later.
        </p>
      ) : (
        <div className="bento-list">
          {preview.map((event) => (
            <div
              key={event.id}
              className="bento-list-item"
              style={{ cursor: "pointer" }}
              onClick={() => setSelected(event)}
            >
              <span className="bento-list-item__title">{event.title}</span>
              <span>{formatWeekdayDateDMY(event.eventDate)}</span>
            </div>
          ))}
        </div>
      )}

      {selected && <EventPreviewModal event={selected} onClose={() => setSelected(null)} />}
    </BentoCard>
  );
}

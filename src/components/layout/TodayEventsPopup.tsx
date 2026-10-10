import { useEffect, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { listEventsForCampus } from "../../services/firebase/events";
import type { EventProgram } from "../../types/event";
import { Modal } from "../common/Modal";
import { Button } from "../common/Button";
import { formatWeekdayDateDMY } from "../../utils/formatDate";
import "./TodayEventsPopup.css";

interface TodayEventsPopupProps {
  onViewEvents: () => void;
}

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

// A one-time-per-day popup (not just a bell notification) surfacing today's
// events the moment someone lands on their dashboard — shown once per
// person per day, tracked in localStorage since this is purely a per-viewer
// convenience, not something that needs to sync across devices.
export function TodayEventsPopup({ onViewEvents }: TodayEventsPopupProps) {
  const { profile } = useAuth();
  const [events, setEvents] = useState<EventProgram[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const eligible = profile?.role === "user" || profile?.role === "counsellor" || profile?.role === "head";
    if (!eligible || !profile?.campusId) return;

    const todayKey = istDateKey(Date.now());
    const seenKey = `todayEventsPopupSeen:${profile.uid}:${todayKey}`;
    let seen = false;
    try {
      seen = localStorage.getItem(seenKey) === "1";
    } catch {
      // Private browsing / blocked storage — fall through and just show it
      // every load rather than never showing it at all.
    }
    if (seen) return;

    listEventsForCampus(profile.campusId)
      .then((list) => {
        const todays = list.filter(
          (e) => istDateKey(e.eventDate) === todayKey && e.phase !== "not-conducted",
        );
        if (todays.length === 0) return;
        setEvents(todays);
        setOpen(true);
        try {
          localStorage.setItem(seenKey, "1");
        } catch {
          // Nothing to do if storage is unavailable — it'll just show again
          // next load, which is harmless.
        }
      })
      .catch(() => {
        // Silently skip — this is a convenience popup, not critical path.
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.uid, profile?.role, profile?.campusId]);

  if (!open) return null;

  return (
    <Modal
      title={events.length === 1 ? "Event today" : "Events today"}
      onClose={() => setOpen(false)}
      className="today-events-popup"
    >
      <p className="today-events-popup__intro">
        {events.length === 1
          ? "There's an event happening today on your campus."
          : `There are ${events.length} events happening today on your campus.`}
      </p>
      <div className="today-events-popup__list">
        {events.map((event) => (
          <div key={event.id} className="today-events-popup__item">
            <span className="today-events-popup__item-title">{event.title}</span>
            <span className="today-events-popup__item-date">{formatWeekdayDateDMY(event.eventDate)}</span>
          </div>
        ))}
      </div>
      <Button
        type="button"
        onClick={() => {
          setOpen(false);
          onViewEvents();
        }}
      >
        View All Events →
      </Button>
    </Modal>
  );
}

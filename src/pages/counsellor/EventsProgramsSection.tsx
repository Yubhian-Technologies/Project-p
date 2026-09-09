import { useEffect, useState } from "react";
import { listColleges } from "../../services/firebase/colleges";
import { listEventsForCollege } from "../../services/firebase/events";
import { listCalendarYears } from "../../services/firebase/calendarYears";
import { listCalendarMonths } from "../../services/firebase/calendarMonths";
import { useAuth } from "../../hooks/useAuth";
import type { College } from "../../types/college";
import type { CalendarYear } from "../../types/calendarYear";
import type { CalendarMonth } from "../../types/calendarMonth";
import type { EventProgram } from "../../types/event";
import { CollegePicker } from "../../components/events/CollegePicker";
import { EventsCalendarGrid } from "../../components/events/EventsCalendarGrid";
import { EventDetailModal } from "../head/EventDetailModal";
import "./EventsProgramsSection.css";

export function EventsProgramsSection() {
  const { profile } = useAuth();
  const [colleges, setColleges] = useState<College[]>([]);
  const [selectedCollegeId, setSelectedCollegeId] = useState("");
  const [years, setYears] = useState<CalendarYear[]>([]);
  const [selectedYearId, setSelectedYearId] = useState("");
  const [months, setMonths] = useState<CalendarMonth[]>([]);
  const [events, setEvents] = useState<EventProgram[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<EventProgram | null>(null);

  useEffect(() => {
    if (!profile?.campusId) {
      setLoading(false);
      return;
    }
    listColleges(profile.campusId).then((collegeList) => {
      setColleges(collegeList);
      setSelectedCollegeId((current) => current || collegeList[0]?.id || "");
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.campusId]);

  useEffect(() => {
    setYears([]);
    setEvents([]);
    setSelectedYearId("");
    if (!selectedCollegeId) return;
    Promise.all([listCalendarYears(selectedCollegeId), listEventsForCollege(selectedCollegeId)]).then(
      ([yearList, eventList]) => {
        setYears(yearList);
        setEvents(eventList);
        setSelectedYearId(yearList[0]?.id || "");
      },
    );
  }, [selectedCollegeId]);

  useEffect(() => {
    setMonths([]);
    if (!selectedYearId) return;
    listCalendarMonths(selectedYearId).then(setMonths);
  }, [selectedYearId]);

  if (loading) return null;

  if (!profile?.campusId) {
    return <p>Your account isn't assigned to a campus yet — contact a Super Admin.</p>;
  }

  return (
    <div className="events-programs">
      <CollegePicker colleges={colleges} selectedId={selectedCollegeId} onSelect={setSelectedCollegeId} />

      {selectedCollegeId && (
        <EventsCalendarGrid
          years={years}
          selectedYearId={selectedYearId}
          onSelectYear={setSelectedYearId}
          months={months}
          events={events}
          readOnly
          onSelectEvent={(event) => setSelectedEvent(event)}
        />
      )}

      {selectedEvent && (
        <EventDetailModal
          mode="view"
          event={selectedEvent}
          campusId={selectedEvent.campusId}
          collegeId={selectedEvent.collegeId}
          onClose={() => setSelectedEvent(null)}
          onSaved={() => {}}
        />
      )}
    </div>
  );
}

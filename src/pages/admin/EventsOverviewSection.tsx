import { useEffect, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { listCampuses } from "../../services/firebase/campuses";
import { listColleges } from "../../services/firebase/colleges";
import { listEventsForCollege } from "../../services/firebase/events";
import { listCalendarYears } from "../../services/firebase/calendarYears";
import { listCalendarMonths } from "../../services/firebase/calendarMonths";
import type { Campus } from "../../types/campus";
import type { College } from "../../types/college";
import type { CalendarYear } from "../../types/calendarYear";
import type { CalendarMonth } from "../../types/calendarMonth";
import type { EventProgram } from "../../types/event";
import { Select } from "../../components/common/Select";
import { CollegePicker } from "../../components/events/CollegePicker";
import { EventsCalendarGrid } from "../../components/events/EventsCalendarGrid";
import { EventDetailModal } from "../head/EventDetailModal";
import "./EventsOverviewSection.css";

export function EventsOverviewSection() {
  const { profile } = useAuth();
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [campusId, setCampusId] = useState("");
  const [colleges, setColleges] = useState<College[]>([]);
  const [collegeId, setCollegeId] = useState("");
  const [years, setYears] = useState<CalendarYear[]>([]);
  const [selectedYearId, setSelectedYearId] = useState("");
  const [months, setMonths] = useState<CalendarMonth[]>([]);
  const [events, setEvents] = useState<EventProgram[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<EventProgram | null>(null);

  // A campus-restricted Admin only ever sees their own assigned campuses here.
  const scopedCampusIds =
    profile?.role === "admin" && profile.adminAccess?.scope === "campuses"
      ? profile.adminAccess.campusIds ?? []
      : null;

  useEffect(() => {
    listCampuses().then((c) => setCampuses(scopedCampusIds ? c.filter((campus) => scopedCampusIds.includes(campus.id)) : c));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setCollegeId("");
    setColleges([]);
    if (!campusId) return;
    listColleges(campusId).then(setColleges);
  }, [campusId]);

  useEffect(() => {
    setSelectedYearId("");
    setYears([]);
    setEvents([]);
    if (!collegeId) return;
    Promise.all([listCalendarYears(collegeId), listEventsForCollege(collegeId)]).then(([yearList, eventList]) => {
      setYears(yearList);
      setEvents(eventList);
      setSelectedYearId(yearList[0]?.id || "");
    });
  }, [collegeId]);

  useEffect(() => {
    setMonths([]);
    if (!selectedYearId) return;
    listCalendarMonths(selectedYearId).then(setMonths);
  }, [selectedYearId]);

  return (
    <div className="events-overview">
      <div className="events-overview__filter-bar">
        <div className="events-overview__field">
          <label htmlFor="events-overview-campus">Campus</label>
          <Select id="events-overview-campus" value={campusId} onChange={setCampusId}>
            <option value="" disabled>
              Select a campus…
            </option>
            {campuses.map((campus) => (
              <option key={campus.id} value={campus.id}>
                {campus.name}
              </option>
            ))}
          </Select>
        </div>

        {campusId && <CollegePicker colleges={colleges} selectedId={collegeId} onSelect={setCollegeId} />}
      </div>

      {!campusId && <p>Select a campus to view its colleges' events and programs.</p>}

      {collegeId && (
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

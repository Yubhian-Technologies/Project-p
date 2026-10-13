import { useEffect, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { useAcademicYear } from "../../hooks/useAcademicYear";
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
  const { includes: inAcademicYear } = useAcademicYear();
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [campusId, setCampusId] = useState(() =>
    profile?.role === "admin" && profile.adminAccess?.scope === "campuses" && profile.adminAccess.campusIds?.length === 1
      ? profile.adminAccess.campusIds[0]
      : "");
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

  // When also narrowed to specific colleges, the college picker (and
  // everything downstream of it) is further narrowed to just those.
  const scopedCollegeIds =
    scopedCampusIds && profile?.role === "admin" && profile.adminAccess?.collegeIds?.length
      ? profile.adminAccess.collegeIds
      : null;

  useEffect(() => {
    listCampuses().then((c) => {
      const visible = scopedCampusIds ? c.filter((campus) => scopedCampusIds.includes(campus.id)) : c;
      setCampuses(visible);
      // Admin assigned to a single campus has nothing to choose — go straight in.
      if (scopedCampusIds && visible.length === 1) setCampusId(visible[0].id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setCollegeId("");
    setColleges([]);
    if (!campusId) return;
    listColleges(campusId).then((c) => {
      const visible = scopedCollegeIds ? c.filter((college) => scopedCollegeIds.includes(college.id)) : c;
      setColleges(visible);
      // Admin assigned to a single college has nothing to choose — go straight in.
      if (scopedCollegeIds && visible.length === 1) setCollegeId(visible[0].id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campusId]);

  useEffect(() => {
    setSelectedYearId("");
    setYears([]);
    setEvents([]);
    if (!collegeId) return;
    Promise.all([listCalendarYears(collegeId, campusId), listEventsForCollege(collegeId, campusId)]).then(([yearList, eventList]) => {
      setYears(yearList);
      setEvents(eventList);
      setSelectedYearId(yearList[0]?.id || "");
    });
    // campusId is only ever read here alongside a collegeId change — the
    // effect above always resets collegeId to "" the moment campusId
    // changes, so this never runs with a stale campusId in practice.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collegeId]);

  useEffect(() => {
    setMonths([]);
    if (!selectedYearId) return;
    listCalendarMonths(selectedYearId, campusId).then(setMonths);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedYearId]);

  const hideCampusPicker = scopedCampusIds?.length === 1;
  const hideCollegePicker = scopedCollegeIds?.length === 1;

  return (
    <div className="events-overview">
      <div className="events-overview__filter-bar">
        {!hideCampusPicker && (
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
        )}

        {campusId && !hideCollegePicker && (
          <CollegePicker colleges={colleges} selectedId={collegeId} onSelect={setCollegeId} />
        )}
      </div>

      {!campusId && scopedCampusIds?.length !== 1 && <p>Select a campus to view its colleges' events and programs.</p>}

      {collegeId && (
        <EventsCalendarGrid
          years={years}
          selectedYearId={selectedYearId}
          onSelectYear={setSelectedYearId}
          months={months}
          events={events.filter((e) => inAcademicYear(e.eventDate, e.campusId, e.collegeId))}
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

import { useEffect, useState } from "react";
import { listBookableProfiles } from "../../services/firebase/bookings";
import { listEventsForCollege } from "../../services/firebase/events";
import { listColleges } from "../../services/firebase/colleges";
import { createCalendarYear, deleteCalendarYear, listCalendarYears, updateCalendarYear } from "../../services/firebase/calendarYears";
import {
  createCalendarMonth,
  deleteCalendarMonth,
  listCalendarMonths,
  updateCalendarMonth,
} from "../../services/firebase/calendarMonths";
import { useAuth } from "../../hooks/useAuth";
import type { UserProfile } from "../../types/user";
import type { College } from "../../types/college";
import type { CalendarYear } from "../../types/calendarYear";
import type { CalendarMonth } from "../../types/calendarMonth";
import type { EventCategory, EventProgram } from "../../types/event";
import { CollegePicker } from "./CollegePicker";
import { EventsCalendarGrid } from "./EventsCalendarGrid";
import { EventDetailModal } from "../../pages/head/EventDetailModal";
import "./EventsProgramsManager.css";

interface ModalState {
  mode: "create" | "manage";
  event?: EventProgram;
  category?: EventCategory;
  calendarYearId?: string;
  calendarMonthId?: string;
  defaultDate?: string;
}

// Shared by Head and Counsellor dashboards — both jointly manage a campus's
// Events & Programs calendar (add/edit/delete years, months, and events).
export function EventsProgramsManager() {
  const { profile } = useAuth();
  const [colleges, setColleges] = useState<College[]>([]);
  const [selectedCollegeId, setSelectedCollegeId] = useState("");
  const [years, setYears] = useState<CalendarYear[]>([]);
  const [selectedYearId, setSelectedYearId] = useState("");
  const [months, setMonths] = useState<CalendarMonth[]>([]);
  const [events, setEvents] = useState<EventProgram[]>([]);
  const [organizers, setOrganizers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalState, setModalState] = useState<ModalState | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!profile?.campusId) {
      setLoading(false);
      return;
    }
    Promise.all([listColleges(profile.campusId), listBookableProfiles()]).then(([collegeList, allBookable]) => {
      setColleges(collegeList);
      setOrganizers(allBookable.filter((p) => p.campusId === profile.campusId));
      setSelectedCollegeId((current) => current || collegeList[0]?.id || "");
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.campusId]);

  async function loadYearsAndEvents(collegeId: string) {
    const [yearList, collegeEvents] = await Promise.all([listCalendarYears(collegeId), listEventsForCollege(collegeId)]);
    setYears(yearList);
    setEvents(collegeEvents);
    setSelectedYearId((current) => (yearList.some((y) => y.id === current) ? current : yearList[0]?.id || ""));
  }

  useEffect(() => {
    if (!selectedCollegeId) {
      setYears([]);
      setEvents([]);
      setSelectedYearId("");
      return;
    }
    loadYearsAndEvents(selectedCollegeId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCollegeId]);

  async function loadMonths(yearId: string) {
    const monthList = await listCalendarMonths(yearId);
    setMonths(monthList);
  }

  useEffect(() => {
    if (!selectedYearId) {
      setMonths([]);
      return;
    }
    loadMonths(selectedYearId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedYearId]);

  async function refreshEvents() {
    if (!selectedCollegeId) return;
    setEvents(await listEventsForCollege(selectedCollegeId));
  }

  async function handleAddYear(label: string) {
    if (!profile?.campusId) return;
    setError("");
    try {
      const yearId = await createCalendarYear(profile.campusId, selectedCollegeId, label, profile.uid);
      const yearList = await listCalendarYears(selectedCollegeId);
      setYears(yearList);
      setSelectedYearId(yearId);
    } catch {
      setError("Couldn't add that year. Please try again.");
    }
  }

  async function handleAddMonth(month: number, calendarYear: number) {
    if (!profile?.campusId || !selectedYearId) return;
    setError("");
    try {
      await createCalendarMonth(profile.campusId, selectedCollegeId, selectedYearId, month, calendarYear, profile.uid);
      await loadMonths(selectedYearId);
    } catch {
      setError("Couldn't add that month. Please try again.");
    }
  }

  async function handleEditYear(yearId: string, label: string) {
    setError("");
    try {
      await updateCalendarYear(yearId, label);
      setYears(await listCalendarYears(selectedCollegeId));
    } catch {
      setError("Couldn't rename that year. Please try again.");
    }
  }

  async function handleDeleteYear(yearId: string) {
    setError("");
    try {
      await deleteCalendarYear(yearId);
      await loadYearsAndEvents(selectedCollegeId);
    } catch {
      setError("Couldn't delete that year. Please try again.");
    }
  }

  async function handleEditMonth(monthId: string, month: number, calendarYear: number) {
    setError("");
    try {
      await updateCalendarMonth(monthId, month, calendarYear);
      await loadMonths(selectedYearId);
    } catch {
      setError("Couldn't update that month. Please try again.");
    }
  }

  async function handleDeleteMonth(monthId: string) {
    setError("");
    try {
      await deleteCalendarMonth(monthId);
      await Promise.all([loadMonths(selectedYearId), refreshEvents()]);
    } catch {
      setError("Couldn't delete that month. Please try again.");
    }
  }

  function handleAddEvent(category: EventCategory, yearId: string, monthId: string) {
    const month = months.find((m) => m.id === monthId);
    const pad = (n: number) => String(n).padStart(2, "0");
    setModalState({
      mode: "create",
      category,
      calendarYearId: yearId,
      calendarMonthId: monthId,
      defaultDate: month ? `${month.calendarYear}-${pad(month.month + 1)}-01T09:00` : undefined,
    });
  }

  function handleSelectEvent(event: EventProgram) {
    setModalState({ mode: "manage", event });
  }

  if (loading) return null;

  if (!profile?.campusId) {
    return <p>Your account isn't assigned to a campus yet — contact a Super Admin.</p>;
  }

  return (
    <div className="events-programs">
      <CollegePicker colleges={colleges} selectedId={selectedCollegeId} onSelect={setSelectedCollegeId} />

      {error && <p className="events-programs__error">{error}</p>}

      {selectedCollegeId && (
        <EventsCalendarGrid
          years={years}
          selectedYearId={selectedYearId}
          onSelectYear={setSelectedYearId}
          onAddYear={handleAddYear}
          onEditYear={handleEditYear}
          onDeleteYear={handleDeleteYear}
          months={months}
          onAddMonth={handleAddMonth}
          onEditMonth={handleEditMonth}
          onDeleteMonth={handleDeleteMonth}
          events={events}
          onAddEvent={handleAddEvent}
          onSelectEvent={handleSelectEvent}
        />
      )}

      {modalState && (
        <EventDetailModal
          mode={modalState.mode}
          event={modalState.event}
          defaultCategory={modalState.category}
          defaultDate={modalState.defaultDate}
          calendarYearId={modalState.calendarYearId ?? modalState.event?.calendarYearId}
          calendarMonthId={modalState.calendarMonthId ?? modalState.event?.calendarMonthId}
          campusId={profile.campusId}
          collegeId={selectedCollegeId}
          createdBy={profile.uid}
          organizers={organizers}
          onClose={() => setModalState(null)}
          onSaved={refreshEvents}
        />
      )}
    </div>
  );
}

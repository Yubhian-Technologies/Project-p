import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { listBookableProfiles } from "../../services/firebase/bookings";
import { createEvent, deleteEvent, listEventsForCampus, updateEvent } from "../../services/firebase/events";
import { useAuth } from "../../hooks/useAuth";
import type { UserProfile } from "../../types/user";
import type { EventProgram } from "../../types/event";
import { Card } from "../../components/common/Card";
import { Button } from "../../components/common/Button";
import { Select } from "../../components/common/Select";
import { DateTimePicker } from "../../components/common/DateTimePicker";
import "./EventsProgramsSection.css";

export function EventsProgramsSection() {
  const { profile } = useAuth();
  const [events, setEvents] = useState<EventProgram[]>([]);
  const [organizers, setOrganizers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [organizerId, setOrganizerId] = useState("");
  const [eventDateValue, setEventDateValue] = useState("");
  const [creating, setCreating] = useState(false);

  const [attendeeDrafts, setAttendeeDrafts] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function load() {
    if (!profile?.campusId) {
      setLoading(false);
      return;
    }
    const [campusEvents, allBookable] = await Promise.all([
      listEventsForCampus(profile.campusId),
      listBookableProfiles(),
    ]);
    setEvents(campusEvents);
    setOrganizers(allBookable.filter((p) => p.campusId === profile.campusId));
    setAttendeeDrafts(Object.fromEntries(campusEvents.map((e) => [e.id, String(e.attendeeCount)])));
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.campusId]);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    if (!profile?.campusId || !organizerId) return;
    const organizer = organizers.find((o) => o.uid === organizerId);
    if (!organizer) return;

    setCreating(true);
    try {
      await createEvent({
        campusId: profile.campusId,
        title: title.trim(),
        description: description.trim(),
        organizerId: organizer.uid,
        organizerName: organizer.displayName || organizer.email,
        eventDate: eventDateValue ? new Date(eventDateValue).getTime() : Date.now(),
        attendeeCount: 0,
        createdBy: profile.uid,
      });
      setTitle("");
      setDescription("");
      setOrganizerId("");
      setEventDateValue("");
      await load();
    } finally {
      setCreating(false);
    }
  }

  async function handleSaveAttendance(id: string) {
    const value = Number(attendeeDrafts[id]);
    if (Number.isNaN(value) || value < 0) return;
    setSavingId(id);
    try {
      await updateEvent(id, { attendeeCount: value });
      await load();
    } finally {
      setSavingId(null);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      await deleteEvent(id);
      await load();
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) return null;

  if (!profile?.campusId) {
    return <p>Your account isn't assigned to a campus yet — contact a Super Admin.</p>;
  }

  return (
    <div className="events-programs">
      <Card className="events-programs__add-form">
        <p className="events-programs__form-title">+ Add Event</p>
        <form onSubmit={handleCreate}>
          <div className="events-programs__field">
            <label htmlFor="event-title">Title</label>
            <input
              id="event-title"
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="events-programs__field">
            <label htmlFor="event-description">Description</label>
            <textarea
              id="event-description"
              rows={3}
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's this event or program about?"
            />
          </div>
          <div className="events-programs__field">
            <label htmlFor="event-organizer">Organizer</label>
            <Select id="event-organizer" value={organizerId} onChange={setOrganizerId}>
              <option value="" disabled>
                {organizers.length === 0 ? "No team members on this campus" : "Select an organizer…"}
              </option>
              {organizers.map((o) => (
                <option key={o.uid} value={o.uid}>
                  {o.displayName || o.email}
                </option>
              ))}
            </Select>
          </div>
          <div className="events-programs__field">
            <label htmlFor="event-date">Date &amp; time</label>
            <DateTimePicker id="event-date" value={eventDateValue} onChange={setEventDateValue} />
          </div>
          <Button type="submit" disabled={creating || !organizerId || !eventDateValue}>
            {creating ? "Adding…" : "Add event"}
          </Button>
        </form>
      </Card>

      {events.length === 0 && <p>No events or programs added for your campus yet.</p>}

      {events.map((event) => (
        <Card key={event.id} className="events-programs__row">
          <div>
            <p className="events-programs__title">{event.title}</p>
            <p className="events-programs__meta">
              {event.organizerName} • {new Date(event.eventDate).toLocaleString()}
            </p>
            <p className="events-programs__description">{event.description}</p>
          </div>
          <div className="events-programs__attendance">
            <label htmlFor={`attendance-${event.id}`}>Attendees</label>
            <input
              id={`attendance-${event.id}`}
              type="number"
              min={0}
              value={attendeeDrafts[event.id] ?? ""}
              onChange={(e) => setAttendeeDrafts((d) => ({ ...d, [event.id]: e.target.value }))}
            />
            <Button
              type="button"
              variant="outlined"
              disabled={savingId === event.id}
              onClick={() => handleSaveAttendance(event.id)}
            >
              {savingId === event.id ? "Saving…" : "Save"}
            </Button>
            <Button
              type="button"
              variant="outlined"
              disabled={deletingId === event.id}
              onClick={() => handleDelete(event.id)}
            >
              {deletingId === event.id ? "Deleting…" : "Delete"}
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
}

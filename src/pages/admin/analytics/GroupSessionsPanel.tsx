import { useEffect, useState } from "react";
import { listEventsForCampus } from "../../../services/firebase/events";
import type { EventProgram } from "../../../types/event";
import { Card } from "../../../components/common/Card";
import "./AnalyticsSection.css";

interface GroupSessionsPanelProps {
  campusId: string;
}

export function GroupSessionsPanel({ campusId }: GroupSessionsPanelProps) {
  const [events, setEvents] = useState<EventProgram[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    listEventsForCampus(campusId).then((data) => {
      setEvents(data);
      setLoading(false);
    });
  }, [campusId]);

  if (loading) return null;

  const totalAttendance = events.reduce((sum, e) => sum + e.attendeeCount, 0);
  const avgAttendance = events.length > 0 ? totalAttendance / events.length : 0;

  return (
    <div className="analytics-group">
      <div className="analytics-inline">
        <div className="analytics-inline__stat">
          <span className="analytics-inline__stat-value">{events.length}</span>
          <span className="analytics-inline__stat-label">Events run</span>
        </div>
        <div className="analytics-inline__stat">
          <span className="analytics-inline__stat-value">{totalAttendance}</span>
          <span className="analytics-inline__stat-label">Total attendance</span>
        </div>
        <div className="analytics-inline__stat">
          <span className="analytics-inline__stat-value">{avgAttendance.toFixed(1)}</span>
          <span className="analytics-inline__stat-label">Avg. per event</span>
        </div>
      </div>

      {events.length === 0 && <p>No events or programs recorded for this campus yet.</p>}

      {events.map((event) => (
        <Card key={event.id} className="analytics-group__row">
          <div>
            <p className="analytics-group__title">{event.title}</p>
            <p className="analytics-group__meta">
              {event.organizerName} • {new Date(event.eventDate).toLocaleString()}
            </p>
          </div>
          <div className="analytics-group__attendance">
            <span className="analytics-inline__stat-value">{event.attendeeCount}</span>
            <span className="analytics-inline__stat-label">Attendees</span>
          </div>
        </Card>
      ))}
    </div>
  );
}

import type { EventProgram } from "../../types/event";
import { Modal } from "../../components/common/Modal";
import { formatSessionYears } from "../../utils/academicCalendar";
import "./EventPreviewModal.css";

interface EventPreviewModalProps {
  event: EventProgram;
  onClose: () => void;
}

/** Read-only, student-facing event detail view — deliberately not the shared
    EventDetailModal, which also carries staff-only controls (organizer
    management, delete, report upload) that have no business being reachable
    from the student side. */
export function EventPreviewModal({ event, onClose }: EventPreviewModalProps) {
  return (
    <Modal title="Event details" onClose={onClose} className="event-preview-modal">
      <div className="event-preview-modal__body">
        {event.posterUrl && (
          <img src={event.posterUrl} alt={`${event.title} poster`} className="event-preview-modal__poster" />
        )}

        <h3 className="event-preview-modal__title">{event.title}</h3>
        <p className="event-preview-modal__description">{event.description}</p>

        <div className="event-preview-modal__details">
          {event.category === "group-session" && event.sessionYears && event.sessionYears.length > 0 && (
            <div className="event-preview-modal__row">
              <span className="event-preview-modal__label">Which years</span>
              <span>{formatSessionYears(event.sessionYears)}</span>
            </div>
          )}
          {event.targetGroup && (
            <div className="event-preview-modal__row">
              <span className="event-preview-modal__label">Target group</span>
              <span>{event.targetGroup}</span>
            </div>
          )}
          {event.importantDay && (
            <div className="event-preview-modal__row">
              <span className="event-preview-modal__label">Important day</span>
              <span>{event.importantDay}</span>
            </div>
          )}
          <div className="event-preview-modal__row">
            <span className="event-preview-modal__label">Date &amp; time</span>
            <span>{new Date(event.eventDate).toLocaleString()}</span>
          </div>
        </div>
      </div>
    </Modal>
  );
}

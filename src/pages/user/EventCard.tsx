import type { EventProgram } from "../../types/event";
import { MorphingPopover, MorphingPopoverTrigger, MorphingPopoverContent } from "../../components/common/MorphingPopover";
import { CalendarIcon } from "../../components/common/icons";
import { formatSessionYears } from "../../utils/academicCalendar";
import { formatDateTimeDMY, formatWeekdayDateDMY } from "../../utils/formatDate";
import "./EventCard.css";
import "./EventPreviewModal.css";

interface EventCardProps {
  event: EventProgram;
}

/** A campus event shown as a photo card (poster/title/date), matching the
    counsellor-profile cards (CounsellorCard.tsx) elsewhere in this
    dashboard. "View" morphs straight into the full event details, same
    effect as the landing page's footer popups (MorphingPopover). */
export function EventCard({ event }: EventCardProps) {
  const dateLabel = formatWeekdayDateDMY(event.eventDate);

  return (
    <div className="event-card">
      <div className="event-card__photo-wrap">
        {event.posterUrl ? (
          <img className="event-card__photo" src={event.posterUrl} alt={event.title} />
        ) : (
          <div className="event-card__photo event-card__photo--placeholder" aria-hidden="true">
            <CalendarIcon />
          </div>
        )}
      </div>

      <div className="event-card__body">
        <p className="event-card__title">{event.title}</p>
        <p className="event-card__date">{dateLabel}</p>

        <MorphingPopover>
          <MorphingPopoverTrigger className="event-card__view-trigger">View →</MorphingPopoverTrigger>
          <MorphingPopoverContent title="Event details" className="event-preview-modal">
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
                {event.organizerNames.length > 0 && (
                  <div className="event-preview-modal__row">
                    <span className="event-preview-modal__label">Conducted by</span>
                    <span>{event.organizerNames.join(", ")}</span>
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
                  <span>{formatDateTimeDMY(event.eventDate)}</span>
                </div>
              </div>
            </div>
          </MorphingPopoverContent>
        </MorphingPopover>
      </div>
    </div>
  );
}

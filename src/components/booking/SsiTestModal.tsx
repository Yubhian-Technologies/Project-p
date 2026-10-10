import { SsiTestForm, type SsiAnswersPayload } from "./SsiTestForm";
import type { Booking } from "../../types/booking";
import type { SsiResultInput } from "../../services/firebase/ssiTest";

interface SsiTestModalProps {
  booking: Booking;
  profile: {
    displayName?: string;
    studentOrProfessional?: "student" | "professional";
    whatsappNumber?: string;
    branch?: string;
    yearOrBatch?: string;
    bioData?: { dateOfBirth?: string };
  };
  /** Pre-filled WhatsApp number fetched from the booking intake if the profile has none. */
  initialWhatsappNumber?: string;
  onSubmit: (input: SsiResultInput) => Promise<void>;
  onClose: () => void;
}

/** The SSI questionnaire shown as a popup, right after a booking is accepted/scheduled. */
export function SsiTestModal({ booking, profile, initialWhatsappNumber, onSubmit, onClose }: SsiTestModalProps) {
  async function handleSubmit(answers: SsiAnswersPayload) {
    await onSubmit({
      bookingId: booking.id,
      userId: booking.userId,
      userEmail: booking.userEmail,
      counsellorId: booking.counsellorId,
      counsellorEmail: booking.counsellorEmail,
      ...answers,
    });
  }

  return (
    <SsiTestForm
      counsellorEmail={booking.counsellorEmail}
      profile={profile}
      initialWhatsappNumber={initialWhatsappNumber}
      onSubmit={handleSubmit}
      onClose={onClose}
      chrome="modal"
    />
  );
}

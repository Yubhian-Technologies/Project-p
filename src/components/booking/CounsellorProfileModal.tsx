import { Modal } from "../common/Modal";
import { CounsellorProfileDetails } from "./CounsellorProfileDetails";
import type { UserProfile } from "../../types/user";
import type { LiveStatus } from "../../utils/counsellorStatus";
import "./CounsellorProfileModal.css";

interface CounsellorProfileModalProps {
  profile: UserProfile;
  status: LiveStatus;
  bookingDisabled: boolean;
  onBook: () => void;
  onClose: () => void;
}

/** Used by BookingSection's "pick one of several counsellors/heads" flow —
    see CampusCounsellorsSection for the no-popup version shown when there's
    only ever the one person assigned to a student's own college. */
export function CounsellorProfileModal({
  profile,
  status,
  bookingDisabled,
  onBook,
  onClose,
}: CounsellorProfileModalProps) {
  return (
    <Modal title="Counsellor Profile" onClose={onClose} className="counsellor-profile-modal">
      <CounsellorProfileDetails profile={profile} status={status} bookingDisabled={bookingDisabled} onBook={onBook} inModal />
    </Modal>
  );
}

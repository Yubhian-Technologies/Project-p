import { Modal } from "../common/Modal";
import type { UserProfile } from "../../types/user";
import "./RequestCard.css";

interface StudentBioDataModalProps {
  studentProfile: UserProfile;
  onClose: () => void;
}

/** Shared by RequestDetailModal (the "Show Bio Data" button on any booking)
    and EmergencyAlertsSection ("View Profile" on a Crisis SOS card) — same
    bio data, same two layouts (student vs. working professional), just
    opened from two different places. */
export function StudentBioDataModal({ studentProfile, onClose }: StudentBioDataModalProps) {
  const isStudentBio = (studentProfile.studentOrProfessional ?? "student") === "student";
  return (
    <Modal title={isStudentBio ? "Student Bio Data" : "Working Professional Bio Data"} onClose={onClose}>
      <dl className="request-card__ssi-dl">
        {isStudentBio ? (
          <>
            <dt>Register No.</dt>
            <dd>{studentProfile.registerNumber || "—"}</dd>
            <dt>Batch</dt>
            <dd>{studentProfile.yearOrBatch || "—"}</dd>
            <dt>Branch</dt>
            <dd>{studentProfile.branch || "—"}</dd>
            <dt>Regular / Lateral</dt>
            <dd>
              {studentProfile.admissionType === "regular"
                ? "Regular"
                : studentProfile.admissionType === "lateral"
                  ? "Lateral"
                  : "—"}
            </dd>
            <dt>Gender</dt>
            <dd>{studentProfile.gender || "—"}</dd>
            <dt>Course</dt>
            <dd>{studentProfile.bioData?.course || "—"}</dd>
            <dt>Date of birth</dt>
            <dd>{studentProfile.bioData?.dateOfBirth || "—"}</dd>
            <dt>Hostel / Day Scholar</dt>
            <dd>{studentProfile.bioData?.hostelOrDayScholar || "—"}</dd>
            <dt>Mobile number</dt>
            <dd>{studentProfile.bioData?.mobileNumber || "—"}</dd>
            <dt>Email ID (personal)</dt>
            <dd>{studentProfile.bioData?.personalEmail || "—"}</dd>
            <dt>Father's name</dt>
            <dd>{studentProfile.bioData?.fatherName || "—"}</dd>
            <dt>Father's occupation</dt>
            <dd>{studentProfile.bioData?.fatherOccupation || "—"}</dd>
            <dt>Father's phone</dt>
            <dd>{studentProfile.bioData?.fatherPhone || "—"}</dd>
            <dt>Father's email</dt>
            <dd>{studentProfile.bioData?.fatherEmail || "—"}</dd>
            <dt>Mother's name</dt>
            <dd>{studentProfile.bioData?.motherName || "—"}</dd>
            <dt>Mother's occupation</dt>
            <dd>{studentProfile.bioData?.motherOccupation || "—"}</dd>
            <dt>Mother's phone</dt>
            <dd>{studentProfile.bioData?.motherPhone || "—"}</dd>
            <dt>Mother's email</dt>
            <dd>{studentProfile.bioData?.motherEmail || "—"}</dd>
            <dt>Correspondence address</dt>
            <dd>{studentProfile.bioData?.correspondenceAddress || "—"}</dd>
            <dt>Permanent address</dt>
            <dd>{studentProfile.bioData?.permanentAddress || "—"}</dd>
          </>
        ) : (
          <>
            <dt>Employee ID</dt>
            <dd>{studentProfile.bioData?.employeeId || "—"}</dd>
            <dt>Institution</dt>
            <dd>{studentProfile.bioData?.institution || "—"}</dd>
            <dt>Department</dt>
            <dd>{studentProfile.branch || "—"}</dd>
            <dt>Designation</dt>
            <dd>{studentProfile.bioData?.designation || "—"}</dd>
            <dt>Gender</dt>
            <dd>{studentProfile.gender || "—"}</dd>
            <dt>Age</dt>
            <dd>{studentProfile.bioData?.age || "—"}</dd>
            <dt>Preferred language</dt>
            <dd>{studentProfile.bioData?.preferredLanguage || "—"}</dd>
            <dt>Marital status</dt>
            <dd>{studentProfile.bioData?.maritalStatus || "—"}</dd>
            <dt>Phone Number</dt>
            <dd>{studentProfile.bioData?.mobileNumber || "—"}</dd>
            <dt>Email ID</dt>
            <dd>{studentProfile.bioData?.personalEmail || "—"}</dd>
            <dt>Address</dt>
            <dd>{studentProfile.bioData?.address || "—"}</dd>
          </>
        )}
      </dl>
    </Modal>
  );
}

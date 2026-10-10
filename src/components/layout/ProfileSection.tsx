import { useEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { useAuth } from "../../hooks/useAuth";
import { ROLE_LABELS } from "../../config/roles";
import { uploadAvatar, uploadSignatureImage } from "../../services/firebase/storage";
import {
  updateUserPhoto,
  updateUserBio,
  setAvailability,
  updateUserIntakeInfo,
  updateUserBioData,
  updateCounsellorProfile,
} from "../../services/firebase/firestore";
import { getSignatureURL, saveSignatureURL } from "../../services/firebase/signature";
import { AttendanceCheckCard } from "../attendance/AttendanceCheckCard";
import { ImportLoginsModal } from "../profile/ImportLoginsModal";
import { AddStudentModal } from "../profile/AddStudentModal";
import { authErrorMessage, changeOwnPassword } from "../../services/firebase/auth";
import { defaultAvailabilitySchedule } from "../../types/availability";
import type { DayAvailability } from "../../types/availability";
import { Card } from "../common/Card";
import { Avatar } from "../common/Avatar";
import { Button } from "../common/Button";
import { Select } from "../common/Select";
import { AvailabilityScheduleEditor } from "./AvailabilityScheduleEditor";
import "./ProfileSection.css";

function toCsv(list?: string[]): string {
  return (list ?? []).join(", ");
}

function fromCsv(value: string): string[] {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

interface ProfileSectionProps {
  onOpenFeedback?: () => void;
}

export function ProfileSection({ onOpenFeedback }: ProfileSectionProps) {
  const { currentUser, profile, refreshProfile } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bioDraft, setBioDraft] = useState(profile?.bio ?? "");
  const [savingBio, setSavingBio] = useState(false);
  const [savingAvailability, setSavingAvailability] = useState(false);

  const [nameDraft, setNameDraft] = useState(profile?.displayName ?? "");
  // "I am a" is set once at signup and never editable here afterward — a
  // Super Admin can still correct it via Edit User if someone picked wrong.
  const isStudent = (profile?.studentOrProfessional ?? "student") === "student";
  const [whatsappDraft, setWhatsappDraft] = useState(profile?.whatsappNumber ?? "");
  const [yearOrBatchDraft, setYearOrBatchDraft] = useState(profile?.yearOrBatch ?? "");
  const [branchDraft, setBranchDraft] = useState(profile?.branch ?? "");
  const [genderDraft, setGenderDraft] = useState(profile?.gender ?? "");
  const [courseDraft, setCourseDraft] = useState(profile?.bioData?.course ?? "");
  const [dateOfBirthDraft, setDateOfBirthDraft] = useState(profile?.bioData?.dateOfBirth ?? "");
  const [hostelOrDayScholarDraft, setHostelOrDayScholarDraft] = useState(
    profile?.bioData?.hostelOrDayScholar ?? "",
  );
  const [mobileNumberDraft, setMobileNumberDraft] = useState(profile?.bioData?.mobileNumber ?? "");
  const [personalEmailDraft, setPersonalEmailDraft] = useState(profile?.bioData?.personalEmail ?? "");
  const [fatherNameDraft, setFatherNameDraft] = useState(profile?.bioData?.fatherName ?? "");
  const [motherNameDraft, setMotherNameDraft] = useState(profile?.bioData?.motherName ?? "");
  const [fatherOccupationDraft, setFatherOccupationDraft] = useState(profile?.bioData?.fatherOccupation ?? "");
  const [motherOccupationDraft, setMotherOccupationDraft] = useState(profile?.bioData?.motherOccupation ?? "");
  const [fatherPhoneDraft, setFatherPhoneDraft] = useState(profile?.bioData?.fatherPhone ?? "");
  const [motherPhoneDraft, setMotherPhoneDraft] = useState(profile?.bioData?.motherPhone ?? "");
  const [fatherEmailDraft, setFatherEmailDraft] = useState(profile?.bioData?.fatherEmail ?? "");
  const [motherEmailDraft, setMotherEmailDraft] = useState(profile?.bioData?.motherEmail ?? "");
  const [correspondenceAddressDraft, setCorrespondenceAddressDraft] = useState(
    profile?.bioData?.correspondenceAddress ?? "",
  );
  const [permanentAddressDraft, setPermanentAddressDraft] = useState(profile?.bioData?.permanentAddress ?? "");
  const [savingIntake, setSavingIntake] = useState(false);

  const [counsellorNameDraft, setCounsellorNameDraft] = useState(profile?.displayName ?? "");
  const [counsellorWhatsappDraft, setCounsellorWhatsappDraft] = useState(profile?.whatsappNumber ?? "");
  const [additionalEmailDraft, setAdditionalEmailDraft] = useState(profile?.additionalEmail ?? "");
  const [specializationDraft, setSpecializationDraft] = useState(profile?.specialization ?? "");
  const [experienceDraft, setExperienceDraft] = useState(profile?.experience ?? "");
  const [locationDraft, setLocationDraft] = useState(profile?.location ?? "");
  const [expertiseDraft, setExpertiseDraft] = useState(toCsv(profile?.areasOfExpertise));
  const [educationDegreeDraft, setEducationDegreeDraft] = useState(profile?.educationDegree ?? "");
  const [educationInstitutionDraft, setEducationInstitutionDraft] = useState(profile?.educationInstitution ?? "");
  const [currentOrganizationDraft, setCurrentOrganizationDraft] = useState(profile?.currentOrganization ?? "");
  const [certificationsDraft, setCertificationsDraft] = useState(toCsv(profile?.certifications));
  const [sessionTypeDraft, setSessionTypeDraft] = useState<"online" | "offline" | "both">(
    profile?.sessionType ?? "offline",
  );
  const [languagesDraft, setLanguagesDraft] = useState(toCsv(profile?.languages));
  const [approachEmpatheticDraft, setApproachEmpatheticDraft] = useState(profile?.approachEmpathetic ?? "");
  const [approachEvidenceBasedDraft, setApproachEvidenceBasedDraft] = useState(
    profile?.approachEvidenceBased ?? "",
  );
  const [approachSolutionFocusedDraft, setApproachSolutionFocusedDraft] = useState(
    profile?.approachSolutionFocused ?? "",
  );
  const [scheduleDraft, setScheduleDraft] = useState<DayAvailability[]>(
    profile?.availabilitySchedule ?? defaultAvailabilitySchedule(),
  );
  const [savingCounsellorProfile, setSavingCounsellorProfile] = useState(false);

  const [showEditProfileForm, setShowEditProfileForm] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPasswordDraft, setCurrentPasswordDraft] = useState("");
  const [newPasswordDraft, setNewPasswordDraft] = useState("");
  const [confirmPasswordDraft, setConfirmPasswordDraft] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const signatureFileInputRef = useRef<HTMLInputElement>(null);
  const [signatureURL, setSignatureURL] = useState<string | null>(null);
  const [loadingSignature, setLoadingSignature] = useState(true);
  const [uploadingSignature, setUploadingSignature] = useState(false);
  const [signatureError, setSignatureError] = useState<string | null>(null);

  const [showImportLogins, setShowImportLogins] = useState(false);
  const [showAddStudent, setShowAddStudent] = useState(false);

  useEffect(() => {
    // Only Admin/Super Admin ever see the signature block (see canHaveSignature
    // below) — loadingSignature is never read for anyone else, so there's
    // nothing to reset for an ineligible viewer; just skip the fetch.
    const eligible = profile?.role === "admin" || profile?.role === "super-admin";
    if (!currentUser || !eligible) return;
    // eslint-disable-next-line react/set-state-in-effect -- starting a fetch, not resetting state from a prop change
    setLoadingSignature(true);
    getSignatureURL(currentUser.uid)
      .then(setSignatureURL)
      .finally(() => setLoadingSignature(false));
  }, [currentUser, profile?.role]);

  if (!profile || !currentUser) return null;

  const isCounsellorLike = profile.role === "counsellor" || profile.role === "head";
  const isUser = profile.role === "user";
  // Only Admin/Super Admin ever verify a consolidated report, so only they
  // need a signature on file to stamp one — Head/Counsellor never did
  // anything with theirs.
  const canHaveSignature = profile.role === "admin" || profile.role === "super-admin";
  const isHead = profile.role === "head";

  async function handleSignatureFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !currentUser) return;

    // Only PNG/JPG can actually be embedded by the verifyMonthlyReport Cloud
    // Function when stamping a consolidated report — anything else would
    // silently fall back to a text-only placeholder there.
    if (file.type !== "image/png" && file.type !== "image/jpeg") {
      setSignatureError("Please upload a PNG or JPG image.");
      return;
    }

    setSignatureError(null);
    setUploadingSignature(true);
    try {
      const url = await uploadSignatureImage(currentUser.uid, file);
      await saveSignatureURL(currentUser.uid, url);
      setSignatureURL(url);
    } catch {
      setSignatureError("Could not upload signature. Try a smaller image or a different format.");
    } finally {
      setUploadingSignature(false);
    }
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !currentUser) return;

    setError(null);
    setUploading(true);
    try {
      const photoURL = await uploadAvatar(currentUser.uid, file);
      await updateUserPhoto(currentUser.uid, photoURL);
      await refreshProfile();
    } catch {
      setError("Could not upload image. Try a smaller file or a different format.");
    } finally {
      setUploading(false);
    }
  }

  async function handleSaveBio() {
    if (!currentUser) return;
    setSavingBio(true);
    try {
      await updateUserBio(currentUser.uid, bioDraft.trim());
      await refreshProfile();
    } finally {
      setSavingBio(false);
    }
  }

  async function handleAvailabilityChange(value: string) {
    if (!currentUser) return;
    setSavingAvailability(true);
    try {
      await setAvailability(currentUser.uid, value === "available");
      await refreshProfile();
    } finally {
      setSavingAvailability(false);
    }
  }

  async function handleSaveIntake() {
    if (!currentUser) return;
    setSavingIntake(true);
    try {
      await updateUserIntakeInfo(currentUser.uid, {
        displayName: nameDraft.trim(),
        whatsappNumber: whatsappDraft.trim(),
        yearOrBatch: yearOrBatchDraft.trim(),
        branch: branchDraft.trim(),
        gender: genderDraft,
      });
      await updateUserBioData(currentUser.uid, {
        course: courseDraft.trim(),
        dateOfBirth: dateOfBirthDraft.trim(),
        hostelOrDayScholar: hostelOrDayScholarDraft,
        mobileNumber: mobileNumberDraft.trim(),
        personalEmail: personalEmailDraft.trim(),
        fatherName: fatherNameDraft.trim(),
        motherName: motherNameDraft.trim(),
        fatherOccupation: fatherOccupationDraft.trim(),
        motherOccupation: motherOccupationDraft.trim(),
        fatherPhone: fatherPhoneDraft.trim(),
        motherPhone: motherPhoneDraft.trim(),
        fatherEmail: fatherEmailDraft.trim(),
        motherEmail: motherEmailDraft.trim(),
        correspondenceAddress: correspondenceAddressDraft.trim(),
        permanentAddress: permanentAddressDraft.trim(),
      });
      await refreshProfile();
    } finally {
      setSavingIntake(false);
    }
  }

  async function handleSaveCounsellorProfile() {
    if (!currentUser) return;
    setSavingCounsellorProfile(true);
    try {
      await updateCounsellorProfile(currentUser.uid, {
        displayName: counsellorNameDraft.trim(),
        whatsappNumber: counsellorWhatsappDraft.trim(),
        additionalEmail: additionalEmailDraft.trim(),
        specialization: specializationDraft.trim(),
        experience: experienceDraft.trim(),
        location: locationDraft.trim(),
        areasOfExpertise: fromCsv(expertiseDraft),
        educationDegree: educationDegreeDraft.trim(),
        educationInstitution: educationInstitutionDraft.trim(),
        currentOrganization: currentOrganizationDraft.trim(),
        certifications: fromCsv(certificationsDraft),
        sessionType: sessionTypeDraft,
        languages: fromCsv(languagesDraft),
        approachEmpathetic: approachEmpatheticDraft.trim(),
        approachEvidenceBased: approachEvidenceBasedDraft.trim(),
        approachSolutionFocused: approachSolutionFocusedDraft.trim(),
        availabilitySchedule: scheduleDraft,
      });
      await refreshProfile();
    } finally {
      setSavingCounsellorProfile(false);
    }
  }

  async function handleChangePassword() {
    setPasswordError(null);
    setPasswordSuccess(false);
    if (newPasswordDraft.length < 6) {
      setPasswordError("New password must be at least 6 characters.");
      return;
    }
    if (newPasswordDraft !== confirmPasswordDraft) {
      setPasswordError("New password and confirmation do not match.");
      return;
    }
    setChangingPassword(true);
    try {
      await changeOwnPassword(currentPasswordDraft, newPasswordDraft);
      setCurrentPasswordDraft("");
      setNewPasswordDraft("");
      setConfirmPasswordDraft("");
      setPasswordSuccess(true);
    } catch (err) {
      setPasswordError(authErrorMessage(err, "Could not update your password. Please try again."));
    } finally {
      setChangingPassword(false);
    }
  }

  const intakeUnchanged =
    nameDraft === (profile.displayName ?? "") &&
    whatsappDraft === (profile.whatsappNumber ?? "") &&
    yearOrBatchDraft === (profile.yearOrBatch ?? "") &&
    branchDraft === (profile.branch ?? "") &&
    genderDraft === (profile.gender ?? "") &&
    courseDraft === (profile.bioData?.course ?? "") &&
    dateOfBirthDraft === (profile.bioData?.dateOfBirth ?? "") &&
    hostelOrDayScholarDraft === (profile.bioData?.hostelOrDayScholar ?? "") &&
    mobileNumberDraft === (profile.bioData?.mobileNumber ?? "") &&
    personalEmailDraft === (profile.bioData?.personalEmail ?? "") &&
    fatherNameDraft === (profile.bioData?.fatherName ?? "") &&
    motherNameDraft === (profile.bioData?.motherName ?? "") &&
    fatherOccupationDraft === (profile.bioData?.fatherOccupation ?? "") &&
    motherOccupationDraft === (profile.bioData?.motherOccupation ?? "") &&
    fatherPhoneDraft === (profile.bioData?.fatherPhone ?? "") &&
    motherPhoneDraft === (profile.bioData?.motherPhone ?? "") &&
    fatherEmailDraft === (profile.bioData?.fatherEmail ?? "") &&
    motherEmailDraft === (profile.bioData?.motherEmail ?? "") &&
    correspondenceAddressDraft === (profile.bioData?.correspondenceAddress ?? "") &&
    permanentAddressDraft === (profile.bioData?.permanentAddress ?? "");

  const counsellorProfileUnchanged =
    counsellorNameDraft === (profile.displayName ?? "") &&
    counsellorWhatsappDraft === (profile.whatsappNumber ?? "") &&
    additionalEmailDraft === (profile.additionalEmail ?? "") &&
    specializationDraft === (profile.specialization ?? "") &&
    experienceDraft === (profile.experience ?? "") &&
    locationDraft === (profile.location ?? "") &&
    expertiseDraft === toCsv(profile.areasOfExpertise) &&
    educationDegreeDraft === (profile.educationDegree ?? "") &&
    educationInstitutionDraft === (profile.educationInstitution ?? "") &&
    currentOrganizationDraft === (profile.currentOrganization ?? "") &&
    certificationsDraft === toCsv(profile.certifications) &&
    sessionTypeDraft === (profile.sessionType ?? "offline") &&
    languagesDraft === toCsv(profile.languages) &&
    approachEmpatheticDraft === (profile.approachEmpathetic ?? "") &&
    approachEvidenceBasedDraft === (profile.approachEvidenceBased ?? "") &&
    approachSolutionFocusedDraft === (profile.approachSolutionFocused ?? "") &&
    JSON.stringify(scheduleDraft) === JSON.stringify(profile.availabilitySchedule ?? defaultAvailabilitySchedule());

  return (
    <div className="profile-page">
      <Card className="profile-section">
        <div className="profile-section__avatar-block">
          <Avatar photoURL={profile.photoURL} label={profile.email} size="large" />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="profile-section__file-input"
            onChange={handleFileChange}
          />
          <Button
            variant="outlined"
            type="button"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? "Uploading…" : "Change photo"}
          </Button>
          {error && <p className="profile-section__error">{error}</p>}

          {isCounsellorLike && (
            <div className="profile-section__availability">
              <Select
                value={profile.available === false ? "leave" : "available"}
                onChange={handleAvailabilityChange}
                disabled={savingAvailability}
              >
                <option value="available">Available</option>
                <option value="leave">Leave</option>
              </Select>
              <p className="profile-section__availability-hint">
                In Session shows automatically while you have a live booking.
              </p>
            </div>
          )}

          {isCounsellorLike && !!profile.campusId && <AttendanceCheckCard span={12} />}
        </div>

        <div className="profile-section__main">
          <div className="profile-section__info-card">
            <dl className="profile-section__list">
              {profile.displayName && (
                <>
                  <dt>NAME</dt>
                  <dd>{profile.displayName}</dd>
                </>
              )}
              <dt>EMAIL</dt>
              <dd>{profile.email}</dd>
              <dt>ROLE</dt>
              <dd>{ROLE_LABELS[profile.role]}</dd>
              {isUser && profile.studentOrProfessional && (
                <>
                  <dt>I AM A</dt>
                  <dd>{profile.studentOrProfessional === "student" ? "Student" : "Working professional"}</dd>
                </>
              )}
              {isUser && profile.yearOrBatch && (
                <>
                  <dt>YEAR / BATCH</dt>
                  <dd>{profile.yearOrBatch}</dd>
                </>
              )}
              {isUser && profile.branch && (
                <>
                  <dt>BRANCH</dt>
                  <dd>{profile.branch}</dd>
                </>
              )}
              {isUser && profile.gender && (
                <>
                  <dt>GENDER</dt>
                  <dd>{profile.gender}</dd>
                </>
              )}
            </dl>
          </div>

          {isCounsellorLike && (
            <div className="profile-section__toggle-block">
              <p className="profile-section__subheading">PROFILE &amp; BIO DETAILS</p>
            {!showEditProfileForm ? (
              <Button type="button" variant="outlined" onClick={() => setShowEditProfileForm(true)}>
                Edit profile &amp; bio
              </Button>
            ) : (
              <div className="profile-section__intake">
                <p className="profile-section__intake-hint">
                  This builds your public professional profile, shown to users browsing counsellors.
                </p>

                <div className="profile-section__field">
                  <label htmlFor="counsellor-name">Name (displayed to users)</label>
                  <input
                    id="counsellor-name"
                    type="text"
                    value={counsellorNameDraft}
                    onChange={(e) => setCounsellorNameDraft(e.target.value)}
                  />
                </div>
                <div className="profile-section__field">
                  <label htmlFor="specialization">Specialization / Title</label>
                  <input
                    id="specialization"
                    type="text"
                    placeholder="e.g. Counselling Psychologist"
                    value={specializationDraft}
                    onChange={(e) => setSpecializationDraft(e.target.value)}
                  />
                </div>
                <div className="profile-section__field">
                  <label htmlFor="location">Location</label>
                  <input
                    id="location"
                    type="text"
                    placeholder="e.g. Vishnu College"
                    value={locationDraft}
                    onChange={(e) => setLocationDraft(e.target.value)}
                  />
                </div>
                <div className="profile-section__field">
                  <label htmlFor="experience">Experience</label>
                  <input
                    id="experience"
                    type="text"
                    placeholder="e.g. 5 years"
                    value={experienceDraft}
                    onChange={(e) => setExperienceDraft(e.target.value)}
                  />
                </div>
                <div className="profile-section__field">
                  <label htmlFor="counsellor-whatsapp">WhatsApp number</label>
                  <input
                    id="counsellor-whatsapp"
                    type="tel"
                    value={counsellorWhatsappDraft}
                    onChange={(e) => setCounsellorWhatsappDraft(e.target.value)}
                  />
                </div>
                <div className="profile-section__field">
                  <label htmlFor="additional-email">Additional email (optional)</label>
                  <input
                    id="additional-email"
                    type="email"
                    placeholder={profile.email}
                    value={additionalEmailDraft}
                    onChange={(e) => setAdditionalEmailDraft(e.target.value)}
                  />
                </div>

                <p className="profile-section__subheading">Areas of expertise &amp; languages</p>
                <div className="profile-section__field">
                  <label htmlFor="expertise">Areas of expertise (comma-separated)</label>
                  <input
                    id="expertise"
                    type="text"
                    placeholder="Anxiety, Academic Stress, Relationships"
                    value={expertiseDraft}
                    onChange={(e) => setExpertiseDraft(e.target.value)}
                  />
                </div>
                <div className="profile-section__field">
                  <label htmlFor="languages">Languages (comma-separated)</label>
                  <input
                    id="languages"
                    type="text"
                    placeholder="English, Telugu, Hindi"
                    value={languagesDraft}
                    onChange={(e) => setLanguagesDraft(e.target.value)}
                  />
                </div>

                <p className="profile-section__subheading">Qualifications &amp; credentials</p>
                <div className="profile-section__field">
                  <label htmlFor="education-degree">Education</label>
                  <input
                    id="education-degree"
                    type="text"
                    placeholder="e.g. M.Sc. in Psychology"
                    value={educationDegreeDraft}
                    onChange={(e) => setEducationDegreeDraft(e.target.value)}
                  />
                </div>
                <div className="profile-section__field">
                  <label htmlFor="education-institution">Institution</label>
                  <input
                    id="education-institution"
                    type="text"
                    placeholder="University name"
                    value={educationInstitutionDraft}
                    onChange={(e) => setEducationInstitutionDraft(e.target.value)}
                  />
                </div>
                <div className="profile-section__field">
                  <label htmlFor="current-organization">Current organization</label>
                  <input
                    id="current-organization"
                    type="text"
                    placeholder="Organization / institution"
                    value={currentOrganizationDraft}
                    onChange={(e) => setCurrentOrganizationDraft(e.target.value)}
                  />
                </div>
                <div className="profile-section__field">
                  <label htmlFor="certifications">Certificates (comma-separated)</label>
                  <input
                    id="certifications"
                    type="text"
                    placeholder="e.g. Certified CBT Practitioner, Trauma-Informed Care"
                    value={certificationsDraft}
                    onChange={(e) => setCertificationsDraft(e.target.value)}
                  />
                </div>
                <p className="profile-section__verified-note">✓ Certified Psychologist</p>

                <p className="profile-section__subheading">My approach</p>
                <div className="profile-section__field profile-section__field--full">
                  <label htmlFor="approach-empathetic">Empathetic</label>
                  <textarea
                    id="approach-empathetic"
                    rows={2}
                    placeholder="Creates a safe and non-judgmental environment."
                    value={approachEmpatheticDraft}
                    onChange={(e) => setApproachEmpatheticDraft(e.target.value)}
                  />
                </div>
                <div className="profile-section__field profile-section__field--full">
                  <label htmlFor="approach-evidence">Evidence-based</label>
                  <textarea
                    id="approach-evidence"
                    rows={2}
                    placeholder="Uses appropriate psychological techniques and structured interventions."
                    value={approachEvidenceBasedDraft}
                    onChange={(e) => setApproachEvidenceBasedDraft(e.target.value)}
                  />
                </div>
                <div className="profile-section__field profile-section__field--full">
                  <label htmlFor="approach-solution">Solution-focused</label>
                  <textarea
                    id="approach-solution"
                    rows={2}
                    placeholder="Works collaboratively toward practical and achievable goals."
                    value={approachSolutionFocusedDraft}
                    onChange={(e) => setApproachSolutionFocusedDraft(e.target.value)}
                  />
                </div>

                <p className="profile-section__subheading">Consultation</p>
                <div className="profile-section__field">
                  <label htmlFor="session-type">Session type</label>
                  <Select
                    id="session-type"
                    value={sessionTypeDraft}
                    onChange={(v) => setSessionTypeDraft(v as "online" | "offline" | "both")}
                  >
                    <option value="offline">Offline</option>
                    <option value="online">Online</option>
                    <option value="both">Online &amp; Offline</option>
                  </Select>
                </div>
                <div className="profile-section__field profile-section__field--full">
                  <label>Weekly availability</label>
                  <AvailabilityScheduleEditor value={scheduleDraft} onChange={setScheduleDraft} />
                </div>

                <div className="profile-section__bio">
                  <label htmlFor="bio">About</label>
                  <textarea
                    id="bio"
                    rows={3}
                    value={bioDraft}
                    onChange={(e) => setBioDraft(e.target.value)}
                    placeholder="Tell users a little about yourself…"
                  />
                </div>

                <div className="profile-section__edit-actions">
                  <Button
                    type="button"
                    variant="outlined"
                    disabled={
                      savingCounsellorProfile ||
                      savingBio ||
                      (counsellorProfileUnchanged && bioDraft === (profile.bio ?? ""))
                    }
                    onClick={async () => {
                      await handleSaveCounsellorProfile();
                      if (bioDraft !== (profile.bio ?? "")) {
                        await handleSaveBio();
                      }
                      setShowEditProfileForm(false);
                    }}
                  >
                    {savingCounsellorProfile || savingBio ? "Saving…" : "Save details"}
                  </Button>
                  <Button
                    type="button"
                    variant="outlined"
                    disabled={savingCounsellorProfile || savingBio}
                    onClick={() => setShowEditProfileForm(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {isUser && (
          <div className="profile-section__toggle-block">
            <p className="profile-section__subheading">PERSONAL DETAILS</p>
            {!showEditProfileForm ? (
              <Button type="button" variant="outlined" onClick={() => setShowEditProfileForm(true)}>
                Edit details
              </Button>
            ) : (
              <div className="profile-section__intake">
                <p className="profile-section__intake-hint">
                  These details are shared with the counsellor once they accept a session request.
                </p>
                <div className="profile-section__field">
                  <label htmlFor="intake-name">Name</label>
                  <input
                    id="intake-name"
                    type="text"
                    value={nameDraft}
                    onChange={(e) => setNameDraft(e.target.value)}
                  />
                </div>
                <div className="profile-section__field">
                  <label htmlFor="intake-occupation">I am a</label>
                  <p id="intake-occupation" className="profile-section__static-value">
                    {isStudent ? "Student" : "Working professional"}
                  </p>
                </div>
                <div className="profile-section__field">
                  <label htmlFor="intake-whatsapp">WhatsApp number</label>
                  <input
                    id="intake-whatsapp"
                    type="tel"
                    value={whatsappDraft}
                    onChange={(e) => setWhatsappDraft(e.target.value)}
                  />
                </div>
                {isStudent && (
                  <>
                    <div className="profile-section__field">
                      <label htmlFor="intake-year">Year / Batch</label>
                      <input
                        id="intake-year"
                        type="text"
                        placeholder="e.g. 2nd Year"
                        value={yearOrBatchDraft}
                        onChange={(e) => setYearOrBatchDraft(e.target.value)}
                      />
                    </div>
                    <div className="profile-section__field">
                      <label htmlFor="intake-branch">Branch</label>
                      <input
                        id="intake-branch"
                        type="text"
                        placeholder="e.g. CSE"
                        value={branchDraft}
                        onChange={(e) => setBranchDraft(e.target.value)}
                      />
                    </div>
                  </>
                )}
                <div className="profile-section__field">
                  <label htmlFor="intake-gender">Gender</label>
                  <Select id="intake-gender" value={genderDraft} onChange={setGenderDraft}>
                    <option value="">—</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                    <option value="Prefer not to say">Prefer not to say</option>
                  </Select>
                </div>
                {isStudent && (
                  <>
                    <div className="profile-section__field">
                      <label htmlFor="intake-course">Course</label>
                      <input
                        id="intake-course"
                        type="text"
                        placeholder="e.g. B.Tech"
                        value={courseDraft}
                        onChange={(e) => setCourseDraft(e.target.value)}
                      />
                    </div>
                    <div className="profile-section__field">
                      <label htmlFor="intake-hostel-or-day-scholar">Hostel / Day Scholar</label>
                      <Select
                        id="intake-hostel-or-day-scholar"
                        value={hostelOrDayScholarDraft}
                        onChange={(v) => setHostelOrDayScholarDraft(v as "" | "Hostel" | "Day Scholar")}
                      >
                        <option value="">—</option>
                        <option value="Hostel">Hostel</option>
                        <option value="Day Scholar">Day Scholar</option>
                      </Select>
                    </div>
                  </>
                )}
                <div className="profile-section__field">
                  <label htmlFor="intake-dob">Date of birth</label>
                  <input
                    id="intake-dob"
                    type="date"
                    value={dateOfBirthDraft}
                    onChange={(e) => setDateOfBirthDraft(e.target.value)}
                  />
                </div>
                <div className="profile-section__field">
                  <label htmlFor="intake-mobile">Mobile number</label>
                  <input
                    id="intake-mobile"
                    type="tel"
                    value={mobileNumberDraft}
                    onChange={(e) => setMobileNumberDraft(e.target.value)}
                  />
                </div>
                <div className="profile-section__field">
                  <label htmlFor="intake-personal-email">Email ID (personal)</label>
                  <input
                    id="intake-personal-email"
                    type="email"
                    value={personalEmailDraft}
                    onChange={(e) => setPersonalEmailDraft(e.target.value)}
                  />
                </div>

                {isStudent && (
                  <>
                    <p className="profile-section__subheading">Parent / Guardian details</p>
                    <div className="profile-section__field">
                      <label htmlFor="intake-father-name">Father's name</label>
                      <input
                        id="intake-father-name"
                        type="text"
                        value={fatherNameDraft}
                        onChange={(e) => setFatherNameDraft(e.target.value)}
                      />
                    </div>
                    <div className="profile-section__field">
                      <label htmlFor="intake-mother-name">Mother's name</label>
                      <input
                        id="intake-mother-name"
                        type="text"
                        value={motherNameDraft}
                        onChange={(e) => setMotherNameDraft(e.target.value)}
                      />
                    </div>
                    <div className="profile-section__field">
                      <label htmlFor="intake-father-occupation">Father's occupation</label>
                      <input
                        id="intake-father-occupation"
                        type="text"
                        value={fatherOccupationDraft}
                        onChange={(e) => setFatherOccupationDraft(e.target.value)}
                      />
                    </div>
                    <div className="profile-section__field">
                      <label htmlFor="intake-mother-occupation">Mother's occupation</label>
                      <input
                        id="intake-mother-occupation"
                        type="text"
                        value={motherOccupationDraft}
                        onChange={(e) => setMotherOccupationDraft(e.target.value)}
                      />
                    </div>
                    <div className="profile-section__field">
                      <label htmlFor="intake-father-phone">Father's phone number</label>
                      <input
                        id="intake-father-phone"
                        type="tel"
                        value={fatherPhoneDraft}
                        onChange={(e) => setFatherPhoneDraft(e.target.value)}
                      />
                    </div>
                    <div className="profile-section__field">
                      <label htmlFor="intake-mother-phone">Mother's phone number</label>
                      <input
                        id="intake-mother-phone"
                        type="tel"
                        value={motherPhoneDraft}
                        onChange={(e) => setMotherPhoneDraft(e.target.value)}
                      />
                    </div>
                    <div className="profile-section__field">
                      <label htmlFor="intake-father-email">Father's email ID</label>
                      <input
                        id="intake-father-email"
                        type="email"
                        value={fatherEmailDraft}
                        onChange={(e) => setFatherEmailDraft(e.target.value)}
                      />
                    </div>
                    <div className="profile-section__field">
                      <label htmlFor="intake-mother-email">Mother's email ID</label>
                      <input
                        id="intake-mother-email"
                        type="email"
                        value={motherEmailDraft}
                        onChange={(e) => setMotherEmailDraft(e.target.value)}
                      />
                    </div>
                    <div className="profile-section__field profile-section__field--full">
                      <label htmlFor="intake-correspondence-address">Correspondence address</label>
                      <textarea
                        id="intake-correspondence-address"
                        rows={2}
                        value={correspondenceAddressDraft}
                        onChange={(e) => setCorrespondenceAddressDraft(e.target.value)}
                      />
                    </div>
                    <div className="profile-section__field profile-section__field--full">
                      <label htmlFor="intake-permanent-address">Permanent address</label>
                      <textarea
                        id="intake-permanent-address"
                        rows={2}
                        value={permanentAddressDraft}
                        onChange={(e) => setPermanentAddressDraft(e.target.value)}
                      />
                    </div>
                  </>
                )}
                <div className="profile-section__edit-actions">
                  <Button
                    type="button"
                    variant="outlined"
                    disabled={savingIntake || intakeUnchanged}
                    onClick={async () => {
                      await handleSaveIntake();
                      setShowEditProfileForm(false);
                    }}
                  >
                    {savingIntake ? "Saving…" : "Save details"}
                  </Button>
                  <Button
                    type="button"
                    variant="outlined"
                    disabled={savingIntake}
                    onClick={() => setShowEditProfileForm(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="profile-section__utility-grid">
        {onOpenFeedback && (
          <div className="profile-section__password">
            <p className="profile-section__subheading">WORKSPACE</p>
            <Button type="button" variant="outlined" onClick={onOpenFeedback}>
              My feedback
            </Button>
          </div>
        )}

        <div className="profile-section__password">
          <p className="profile-section__subheading">SECURITY</p>
          {!showPasswordForm ? (
            <Button type="button" variant="outlined" onClick={() => setShowPasswordForm(true)}>
              Change password
            </Button>
          ) : (
            <>
              <div className="profile-section__field">
                <label htmlFor="current-password">Current password</label>
                <input
                  id="current-password"
                  type="password"
                  autoComplete="current-password"
                  value={currentPasswordDraft}
                  onChange={(e) => setCurrentPasswordDraft(e.target.value)}
                />
              </div>
              <div className="profile-section__field">
                <label htmlFor="new-password">New password</label>
                <input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  minLength={6}
                  value={newPasswordDraft}
                  onChange={(e) => setNewPasswordDraft(e.target.value)}
                />
              </div>
              <div className="profile-section__field">
                <label htmlFor="confirm-password">Confirm new password</label>
                <input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  minLength={6}
                  value={confirmPasswordDraft}
                  onChange={(e) => setConfirmPasswordDraft(e.target.value)}
                />
              </div>
              {passwordError && <p className="profile-section__error">{passwordError}</p>}
              {passwordSuccess && <p className="profile-section__success">Password updated successfully.</p>}
              <div className="profile-section__password-actions">
                <Button
                  type="button"
                  variant="outlined"
                  disabled={changingPassword || !currentPasswordDraft || newPasswordDraft.length < 6 || !confirmPasswordDraft}
                  onClick={handleChangePassword}
                >
                  {changingPassword ? "Updating…" : "Change password"}
                </Button>
                <Button
                  type="button"
                  variant="outlined"
                  disabled={changingPassword}
                  onClick={() => {
                    setShowPasswordForm(false);
                    setCurrentPasswordDraft("");
                    setNewPasswordDraft("");
                    setConfirmPasswordDraft("");
                    setPasswordError(null);
                    setPasswordSuccess(false);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </>
          )}
        </div>

        {canHaveSignature && (
          <div className="profile-section__password">
            <p className="profile-section__subheading">DIGITAL SIGNATURE</p>
            {loadingSignature ? (
              <p className="profile-section__intake-hint">Loading…</p>
            ) : (
              <>
                {signatureURL ? (
                  <img src={signatureURL} alt="Your digital signature" className="profile-section__signature-preview" />
                ) : (
                  <p className="profile-section__intake-hint">No signature uploaded yet.</p>
                )}
                <input
                  ref={signatureFileInputRef}
                  type="file"
                  accept="image/png,image/jpeg"
                  className="profile-section__file-input"
                  onChange={handleSignatureFileChange}
                />
                <Button
                  type="button"
                  variant="outlined"
                  disabled={uploadingSignature}
                  onClick={() => signatureFileInputRef.current?.click()}
                >
                  {uploadingSignature ? "Uploading…" : signatureURL ? "Change signature" : "Upload signature"}
                </Button>
                <p className="profile-section__intake-hint">Upload only PNG or JPG format.</p>
                {signatureError && <p className="profile-section__error">{signatureError}</p>}
              </>
            )}
          </div>
        )}

        {isHead && !!profile.campusId && (
          <div className="profile-section__password">
            <p className="profile-section__subheading">TEAM</p>
            <Button type="button" variant="outlined" onClick={() => setShowAddStudent(true)}>
              + Add User
            </Button>
            <Button type="button" variant="outlined" onClick={() => setShowImportLogins(true)}>
              Import Login Mails
            </Button>
          </div>
        )}
        </div>
      </div>
    </Card>
    {showImportLogins && profile.campusId && (
      <ImportLoginsModal campusId={profile.campusId} onClose={() => setShowImportLogins(false)} />
    )}
    {showAddStudent && profile.campusId && (
      <AddStudentModal campusId={profile.campusId} onClose={() => setShowAddStudent(false)} onCreated={async () => {}} />
    )}
  </div>
  );
}

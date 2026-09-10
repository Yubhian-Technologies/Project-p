import { useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { useAuth } from "../../hooks/useAuth";
import { ROLE_LABELS } from "../../config/roles";
import { uploadAvatar } from "../../services/firebase/storage";
import {
  updateUserPhoto,
  updateUserBio,
  setAvailability,
  updateUserIntakeInfo,
  updateCounsellorProfile,
} from "../../services/firebase/firestore";
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

export function ProfileSection() {
  const { currentUser, profile, refreshProfile } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bioDraft, setBioDraft] = useState(profile?.bio ?? "");
  const [savingBio, setSavingBio] = useState(false);
  const [savingAvailability, setSavingAvailability] = useState(false);

  const [nameDraft, setNameDraft] = useState(profile?.displayName ?? "");
  const [occupationDraft, setOccupationDraft] = useState<"student" | "professional">(
    profile?.studentOrProfessional ?? "student",
  );
  const [whatsappDraft, setWhatsappDraft] = useState(profile?.whatsappNumber ?? "");
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

  const [currentPasswordDraft, setCurrentPasswordDraft] = useState("");
  const [newPasswordDraft, setNewPasswordDraft] = useState("");
  const [confirmPasswordDraft, setConfirmPasswordDraft] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  if (!profile || !currentUser) return null;

  const isCounsellorLike = profile.role === "counsellor" || profile.role === "head";
  const isUser = profile.role === "user";

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

  async function handleToggleAvailability() {
    if (!currentUser || !profile) return;
    setSavingAvailability(true);
    try {
      await setAvailability(currentUser.uid, !profile.available);
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
        studentOrProfessional: occupationDraft,
        whatsappNumber: whatsappDraft.trim(),
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
    occupationDraft === (profile.studentOrProfessional ?? "student") &&
    whatsappDraft === (profile.whatsappNumber ?? "");

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
    sessionTypeDraft === (profile.sessionType ?? "offline") &&
    languagesDraft === toCsv(profile.languages) &&
    approachEmpatheticDraft === (profile.approachEmpathetic ?? "") &&
    approachEvidenceBasedDraft === (profile.approachEvidenceBased ?? "") &&
    approachSolutionFocusedDraft === (profile.approachSolutionFocused ?? "") &&
    JSON.stringify(scheduleDraft) === JSON.stringify(profile.availabilitySchedule ?? defaultAvailabilitySchedule());

  return (
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
          <Button
            type="button"
            variant={profile.available ? "filled" : "outlined"}
            disabled={savingAvailability}
            onClick={handleToggleAvailability}
          >
            {profile.available ? "Available" : "Unavailable"} — tap to toggle
          </Button>
        )}
      </div>

      <div className="profile-section__main">
        <dl className="profile-section__list">
          {profile.displayName && (
            <>
              <dt>Name</dt>
              <dd>{profile.displayName}</dd>
            </>
          )}
          <dt>Email</dt>
          <dd>{profile.email}</dd>
          <dt>Role</dt>
          <dd>{ROLE_LABELS[profile.role]}</dd>
        </dl>

        {isCounsellorLike && (
          <>
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
              <p className="profile-section__verified-note">✓ Verified Psychologist</p>

              <p className="profile-section__subheading">My approach</p>
              <div className="profile-section__field">
                <label htmlFor="approach-empathetic">Empathetic</label>
                <textarea
                  id="approach-empathetic"
                  rows={2}
                  placeholder="Creates a safe and non-judgmental environment."
                  value={approachEmpatheticDraft}
                  onChange={(e) => setApproachEmpatheticDraft(e.target.value)}
                />
              </div>
              <div className="profile-section__field">
                <label htmlFor="approach-evidence">Evidence-based</label>
                <textarea
                  id="approach-evidence"
                  rows={2}
                  placeholder="Uses appropriate psychological techniques and structured interventions."
                  value={approachEvidenceBasedDraft}
                  onChange={(e) => setApproachEvidenceBasedDraft(e.target.value)}
                />
              </div>
              <div className="profile-section__field">
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
              <div className="profile-section__field">
                <label>Weekly availability</label>
                <AvailabilityScheduleEditor value={scheduleDraft} onChange={setScheduleDraft} />
              </div>

              <Button
                type="button"
                variant="outlined"
                disabled={savingCounsellorProfile || counsellorProfileUnchanged}
                onClick={handleSaveCounsellorProfile}
              >
                {savingCounsellorProfile ? "Saving…" : "Save details"}
              </Button>
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
              <Button
                type="button"
                variant="outlined"
                disabled={savingBio || bioDraft === (profile.bio ?? "")}
                onClick={handleSaveBio}
              >
                {savingBio ? "Saving…" : "Save bio"}
              </Button>
            </div>

            <div className="profile-section__password">
              <p className="profile-section__subheading">Change password</p>
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
              <Button
                type="button"
                variant="outlined"
                disabled={changingPassword || !currentPasswordDraft || newPasswordDraft.length < 6 || !confirmPasswordDraft}
                onClick={handleChangePassword}
              >
                {changingPassword ? "Updating…" : "Change password"}
              </Button>
            </div>
          </>
        )}

        {isUser && (
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
              <Select
                id="intake-occupation"
                value={occupationDraft}
                onChange={(v) => setOccupationDraft(v as "student" | "professional")}
              >
                <option value="student">Student</option>
                <option value="professional">Working professional</option>
              </Select>
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
            <Button type="button" variant="outlined" disabled={savingIntake || intakeUnchanged} onClick={handleSaveIntake}>
              {savingIntake ? "Saving…" : "Save details"}
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}

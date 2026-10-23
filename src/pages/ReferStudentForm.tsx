import { useEffect, useState, type FormEvent } from "react";
import { listCampuses } from "../services/firebase/campuses";
import { listColleges } from "../services/firebase/colleges";
import {
  studentReferralErrorMessage,
  submitStudentReferral,
} from "../services/firebase/studentReferrals";
import type { Campus } from "../types/campus";
import type { College } from "../types/college";
import "./ReferStudentForm.css";

const personTypes = ["Student", "Working professional", "Other"];
const relationships = [
  "Faculty member",
  "Parent / guardian",
  "Fellow student / colleague",
  "Non-teaching staff",
  "Other",
];
const concerns = [
  "Academic stress or exam pressure",
  "Work-related stress or burnout",
  "Anxiety, worry or overthinking",
  "Low mood, withdrawal or loss of interest",
  "Behavioural or emotional changes",
  "Relationship or interpersonal concerns",
  "Attendance, adjustment or engagement concerns",
  "Sleep or lifestyle difficulties",
  "Concern about safety or self-harm",
  "Other / unsure",
];
const durations = ["Within the last few days", "Several weeks", "Several months", "Not sure"];
const priorities = [
  "Routine — general wellbeing concern",
  "Priority — concern is affecting daily functioning",
  "Urgent — immediate assessment is needed",
];
const awarenessOptions = ["Yes, the person is aware", "No, the person is not aware", "Not sure"];
const agreementOptions = ["Yes", "Not yet discussed", "Not sure"];
const followUpMethods = ["WhatsApp", "Phone call", "Institutional email"];

interface InstitutionOption {
  value: string;
  label: string;
}

function makeInstitutionOptions(campuses: Campus[], colleges: College[]): InstitutionOption[] {
  const options: InstitutionOption[] = [];
  campuses.forEach((campus) => {
    const campusColleges = colleges
      .filter((college) => college.campusId === campus.id)
      .sort((a, b) => a.name.localeCompare(b.name));
    if (campusColleges.length) {
      campusColleges.forEach((college) => {
        options.push({ value: `college:${college.id}`, label: `${college.name} — ${campus.name}` });
      });
    } else {
      options.push({ value: `campus:${campus.id}`, label: campus.name });
    }
  });
  return options.sort((a, b) => a.label.localeCompare(b.label));
}

function RadioOptions({ name, options, required = false, onChange }: {
  name: string;
  options: string[];
  required?: boolean;
  onChange?: (value: string) => void;
}) {
  return (
    <div className="referral-options">
      {options.map((option) => (
        <label className="referral-option" key={option}>
          <input
            type="radio"
            name={name}
            value={option}
            required={required}
            onChange={onChange ? (event) => onChange(event.currentTarget.value) : undefined}
          />
          <span>{option}</span>
        </label>
      ))}
    </div>
  );
}

export function ReferStudentForm() {
  const [institutions, setInstitutions] = useState<InstitutionOption[]>([]);
  const [institutionsLoading, setInstitutionsLoading] = useState(true);
  const [institutionsError, setInstitutionsError] = useState("");
  const [concernError, setConcernError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [draftReady, setDraftReady] = useState(false);
  const [selectedRelationship, setSelectedRelationship] = useState("");
  const [selectedInstitution, setSelectedInstitution] = useState("");
  const [selectedPersonType, setSelectedPersonType] = useState("");

  useEffect(() => {
    let active = true;
    listCampuses()
      .then(async (campuses) => {
        const collegesByCampus = await Promise.all(campuses.map((campus) => listColleges(campus.id)));
        return { campuses, colleges: collegesByCampus.flat() };
      })
      .then(({ campuses, colleges }) => {
        if (active) setInstitutions(makeInstitutionOptions(campuses, colleges));
      })
      .catch(() => {
        if (active) setInstitutionsError("The institution list could not be loaded.");
      })
      .finally(() => {
        if (active) setInstitutionsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.querySelector('input[name="concerns"]:checked')) {
      setConcernError("Please select at least one concern.");
      return;
    }
    setConcernError("");
    if (!form.reportValidity()) return;

    const data = new FormData(form);
    const selectedConcerns = data.getAll("concerns").map(String);
    const institutionValue = String(data.get("institution") ?? "");
    const institutionLabel = institutionValue === "other"
      ? String(data.get("institutionOther") ?? "").trim()
      : institutions.find((institution) => institution.value === institutionValue)?.label ?? institutionValue;
    setSubmitError("");
    setIsSubmitting(true);
    try {
      await submitStudentReferral({
        referrerName: String(data.get("referrerName") ?? ""),
        referrerContact: String(data.get("referrerContact") ?? ""),
        personType: String(data.get("personType") ?? ""),
        personTypeOther: String(data.get("personTypeOther") ?? ""),
        relationship: String(data.get("relationship") ?? ""),
        relationshipOther: String(data.get("relationshipOther") ?? ""),
        personName: String(data.get("personName") ?? ""),
        institution: institutionLabel,
        department: String(data.get("department") ?? ""),
        personContact: String(data.get("personContact") ?? ""),
        concerns: selectedConcerns,
        description: String(data.get("description") ?? ""),
        duration: String(data.get("duration") ?? ""),
        priority: String(data.get("priority") ?? ""),
        awareness: String(data.get("awareness") ?? ""),
        agreement: String(data.get("agreement") ?? ""),
        followUp: String(data.get("followUp") ?? ""),
        confirmation: data.get("confirmation") === "on",
        website: String(data.get("website") ?? ""),
      });
      setDraftReady(true);
      form.reset();
      setSelectedRelationship("");
      setSelectedInstitution("");
      setSelectedPersonType("");
    } catch (error) {
      console.error("Student referral submission failed", error);
      setSubmitError(studentReferralErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="referral-form-wrap">
      {draftReady ? (
        <section className="referral-success" role="status" aria-live="polite">
          <span className="referral-success__eyebrow">Next step</span>
          <h3>Referral submitted successfully</h3>
          <p>
            Thank you for reaching out to Vishnu Wellness Centre. Your referral has been sent to authorised Wellness Centre
            personnel for review. One of our Wellness Counsellors will follow up as soon as possible.
          </p>
          <button className="referral-submit" type="button" onClick={() => setDraftReady(false)}>
            Submit another referral
          </button>
          <div className="referral-emergency">
            <strong>Need immediate assistance?</strong>
            <p>
              If there is an emergency or an immediate risk to someone&apos;s safety, do not wait for an email response.
              Contact <a href="tel:+918985502211">+91 8985502211</a> or seek immediate help from emergency services.
            </p>
          </div>
          <p className="referral-signoff">Vishnu Wellness Centre — We&apos;re here to support your wellbeing.</p>
        </section>
      ) : (
        <form className="referral-form" onSubmit={handleSubmit}>
          <label className="referral-honeypot" aria-hidden="true">
            Leave this field blank
            <input name="website" tabIndex={-1} autoComplete="off" />
          </label>
          <p className="referral-form__intro">
            Help us connect a student or working professional with appropriate wellness support. Please share only information relevant to the concern.
          </p>

          <fieldset>
            <legend>A. Your details</legend>
            <label className="referral-field">
              <span className="referral-field__label">Your name <span className="referral-required" aria-hidden="true">*</span></span>
              <input name="referrerName" autoComplete="name" required />
            </label>
            <label className="referral-field">
              <span className="referral-field__label">WhatsApp / contact number <span className="referral-required" aria-hidden="true">*</span></span>
              <input name="referrerContact" type="tel" autoComplete="tel" required />
            </label>
            <div className="referral-field">
              <span className="referral-field__label">Relationship to the person being referred <span className="referral-required" aria-hidden="true">*</span></span>
              <RadioOptions
                name="relationship"
                options={relationships}
                required
                onChange={setSelectedRelationship}
              />
            </div>
            {selectedRelationship === "Other" && (
              <label className="referral-field">
                <span className="referral-field__label">Please specify your relationship <span className="referral-required" aria-hidden="true">*</span></span>
                <input name="relationshipOther" required maxLength={80} />
              </label>
            )}
          </fieldset>

          <fieldset>
            <legend>B. Person being referred</legend>
            <div className="referral-field">
              <span className="referral-field__label">Person&apos;s role <span className="referral-required" aria-hidden="true">*</span></span>
              <RadioOptions name="personType" options={personTypes} required onChange={setSelectedPersonType} />
            </div>
            {selectedPersonType === "Other" && (
              <label className="referral-field">
                <span className="referral-field__label">Please specify the person&apos;s role <span className="referral-required" aria-hidden="true">*</span></span>
                <input name="personTypeOther" required maxLength={80} />
              </label>
            )}
            <label className="referral-field">
              <span className="referral-field__label">Full name <span className="referral-required" aria-hidden="true">*</span></span>
              <input name="personName" required />
            </label>
            <label className="referral-field">
              <span className="referral-field__label">Institution / campus <span className="referral-required" aria-hidden="true">*</span></span>
              <select
                name="institution"
                required
                defaultValue=""
                onChange={(event) => setSelectedInstitution(event.currentTarget.value)}
              >
                <option value="" disabled>
                  {institutionsLoading ? "Loading institutions..." : "Select institution"}
                </option>
                {institutions.map((institution) => (
                  <option value={institution.value} key={institution.value}>{institution.label}</option>
                ))}
                <option value="other">Other institution / workplace</option>
              </select>
            </label>
            {selectedInstitution === "other" && (
              <label className="referral-field">
                <span className="referral-field__label">Institution / workplace name <span className="referral-required" aria-hidden="true">*</span></span>
                <input name="institutionOther" required maxLength={180} />
              </label>
            )}
              {institutionsError && (
                <p className="referral-error" role="alert">
                  {institutionsError} You can still choose “Other institution / workplace” above.
                </p>
              )}
            {!institutionsLoading && !institutionsError && institutions.length === 0 && (
                <p className="referral-form__intro">No institutions are listed yet. Choose “Other institution / workplace” to enter the details.</p>
            )}
            <label className="referral-field">
              <span className="referral-field__label">Department / year of study / designation <span className="referral-optional">(optional)</span></span>
              <input name="department" />
            </label>
            <label className="referral-field">
              <span className="referral-field__label">Contact details <span className="referral-required" aria-hidden="true">*</span></span>
              <input name="personContact" type="text" required />
            </label>
          </fieldset>

          <fieldset>
            <legend>C. Reason for referral</legend>
            <div className="referral-field">
              <span className="referral-field__label">What have you noticed? Select all that apply. You do not need to diagnose the person. <span className="referral-required" aria-hidden="true">*</span></span>
              <div className="referral-options">
                {concerns.map((concern) => (
                  <label className="referral-option" key={concern}>
                    <input type="checkbox" name="concerns" value={concern} />
                    <span>{concern}</span>
                  </label>
                ))}
              </div>
              {concernError && <p className="referral-error" role="alert">{concernError}</p>}
            </div>
            <label className="referral-field">
              <span className="referral-field__label">Brief description of your concern <span className="referral-optional">(optional)</span></span>
              <textarea name="description" rows={3} />
            </label>
            <div className="referral-field">
              <span className="referral-field__label">How long have you noticed this concern? <span className="referral-required" aria-hidden="true">*</span></span>
              <RadioOptions name="duration" options={durations} required />
            </div>
          </fieldset>

          <fieldset>
            <legend>D. Priority of support</legend>
            <div className="referral-field">
              <span className="referral-field__label">How soon do you think support is needed? <span className="referral-required" aria-hidden="true">*</span></span>
              <RadioOptions name="priority" options={priorities} required />
            </div>
            <p className="referral-warning">
              If there is an immediate risk of harm, do not rely on this form. Contact the designated campus emergency contact
              and appropriate emergency services immediately.
            </p>
          </fieldset>

          <fieldset>
            <legend>E. Student awareness and follow-up</legend>
            <div className="referral-field">
              <span className="referral-field__label">Is the person aware of this referral? <span className="referral-required" aria-hidden="true">*</span></span>
              <RadioOptions name="awareness" options={awarenessOptions} required />
            </div>
            <div className="referral-field">
              <span className="referral-field__label">Has the person agreed to be contacted by the Wellness Centre? <span className="referral-required" aria-hidden="true">*</span></span>
              <RadioOptions name="agreement" options={agreementOptions} required />
            </div>
            <div className="referral-field">
              <span className="referral-field__label">Preferred follow-up method for the referrer <span className="referral-required" aria-hidden="true">*</span></span>
              <RadioOptions name="followUp" options={followUpMethods} required />
            </div>
          </fieldset>

          <section className="referral-privacy">
            <h3>Privacy and confidentiality</h3>
            <p>
              The information provided will be shared with authorised Wellness Centre personnel for the purpose of reviewing and
              responding to this referral. Information will be handled in accordance with institutional procedures and applicable
              legal requirements. Confidentiality may have limits where disclosure is legally required or necessary to address
              serious safety concerns.
            </p>
          </section>
          <label className="referral-consent">
            <input type="checkbox" name="confirmation" required />
            <span>
              I confirm that the information provided is accurate to the best of my knowledge and understand how this referral
              information will be used. <span className="referral-required" aria-hidden="true">*</span>
            </span>
          </label>
          {submitError && <p className="referral-error" role="alert">{submitError}</p>}
          <button className="referral-submit" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Sending referral..." : "Submit the form"}
          </button>
          <p className="referral-submit-note">Your referral will be emailed securely to authorised Wellness Centre personnel.</p>
        </form>
      )}
    </div>
  );
}

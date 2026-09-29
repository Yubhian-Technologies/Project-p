import { useState } from "react";
import { Modal } from "../common/Modal";
import { Card } from "../common/Card";
import { Button } from "../common/Button";
import { Select } from "../common/Select";
import {
  SSI_FORM_TITLE,
  SSI_LEVELS,
  SSI_LEVEL1_FIELDS,
  SSI_PAGE1_NOTE,
  SSI_LIKERT_OPTIONS,
  SSI_LIKERT_QUESTIONS,
  SSI_LEVEL3_QUESTIONS,
  SSI_CONSENT_ITEMS,
  SSI_WHATSAPP_NOTE,
} from "../../config/ssiForm";
import { buildLikertResult, type SsiAnswerItem } from "../../services/firebase/ssiTest";
import { sanitizePhoneInput, isValidWhatsappNumber } from "../../utils/phone";
import "./SsiTestModal.css";

/** The collected answers/scores, independent of who they get attached to (a
    specific booking's counsellor, or a student's college). */
export interface SsiAnswersPayload {
  level1: Record<string, string>;
  likertAnswers: SsiAnswerItem[];
  level3Answers: SsiAnswerItem[];
  likertScore: number;
  likertMax: number;
  depressionScore: number;
  anxietyScore: number;
  stressScore: number;
  whatsappNumber: string;
  consentGiven: boolean;
  consentItems: string[];
}

export interface SsiTestFormProps {
  /** When set (booking flow), the top meta line + consent note name this
      specific counsellor. When omitted (standalone dashboard section), the
      test isn't tied to anyone in particular — generic copy is shown instead. */
  counsellorEmail?: string;
  profile: {
    displayName?: string;
    studentOrProfessional?: "student" | "professional";
    whatsappNumber?: string;
  };
  /** Pre-filled WhatsApp number fetched from the booking intake if the profile has none. */
  initialWhatsappNumber?: string;
  onSubmit: (answers: SsiAnswersPayload) => Promise<void>;
  onClose: () => void;
  /** "modal" (default) wraps the questionnaire in a popup, matching the booking flow.
      "inline" renders it as a plain page section, for the standalone dashboard tab. */
  chrome?: "modal" | "inline";
}

/**
 * The 4-page SSI (pre-session wellbeing screening) questionnaire. Shared by the
 * booking-flow popup (SsiTestModal) and the standalone "SSI Test" dashboard
 * section, so both present the exact same pages/questions. This component only
 * ever collects answers and hands them up via `onSubmit` — it has no idea
 * whether they'll be attached to a specific booking/counsellor or to a college.
 */
export function SsiTestForm({ counsellorEmail, profile, initialWhatsappNumber, onSubmit, onClose, chrome = "modal" }: SsiTestFormProps) {
  const [step, setStep] = useState(1);
  const [level1, setLevel1] = useState<Record<string, string>>({});
  const [likert, setLikert] = useState<Record<string, number>>({});
  const [lvl3, setLvl3] = useState<Record<string, string>>({});
  const [whatsapp, setWhatsapp] = useState(
    () => initialWhatsappNumber?.trim() || profile.whatsappNumber?.trim() || "",
  );
  const [consentChecks, setConsentChecks] = useState<Record<number, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const level = SSI_LEVELS.find((l) => l.id === step) ?? SSI_LEVELS[0];

  const level1Ready = SSI_LEVEL1_FIELDS.every((f) => !f.required || (level1[f.id] ?? "").trim());
  const likertReady = SSI_LIKERT_QUESTIONS.every((q) => likert[q.id] !== undefined);
  const level3Ready = SSI_LEVEL3_QUESTIONS.every((q) => !q.required || (lvl3[q.id] ?? "").trim());
  const consentReady = SSI_CONSENT_ITEMS.every((_, i) => Boolean(consentChecks[i]));
  const whatsappValid = isValidWhatsappNumber(whatsapp);
  const confirmReady = whatsappValid && consentReady;

  function next() {
    setError("");
    if (step === 1 && !level1Ready) {
      setError("Please complete all the required details.");
      return;
    }
    if (step === 2 && !likertReady) {
      setError("Please answer every question before continuing.");
      return;
    }
    if (step === 3 && !level3Ready) {
      setError("Please complete all the required answers.");
      return;
    }
    setStep((s) => Math.min(4, s + 1));
  }

  async function submit() {
    if (!confirmReady) {
      setError("Please fill in a valid 10-digit WhatsApp number and tick every consent box to continue.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const likertResult = buildLikertResult(likert);
      await onSubmit({
        level1,
        likertAnswers: likertResult.items,
        level3Answers: SSI_LEVEL3_QUESTIONS.map((q) => ({
          id: q.id,
          label: q.label,
          answer: lvl3[q.id] ?? "",
          kind: q.kind,
        })),
        likertScore: likertResult.score,
        likertMax: likertResult.max,
        depressionScore: likertResult.depression,
        anxietyScore: likertResult.anxiety,
        stressScore: likertResult.stress,
        whatsappNumber: whatsapp.trim(),
        consentGiven: true,
        consentItems: SSI_CONSENT_ITEMS.filter((_, i) => consentChecks[i]),
      });
      setDone(true);
    } catch (err) {
      console.error("Failed to submit SSI test:", err);
      setError("Couldn't submit your test. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    const doneBody = (
      <div className="ssi-modal__done">
        <p>
          {counsellorEmail ? (
            <>
              Your SSI test has been submitted and will be shared with <strong>{counsellorEmail}</strong>{" "}
              before your session.
            </>
          ) : (
            "Your SSI test has been submitted and will be shared with your college's Wellness Counsellor/Head team."
          )}
        </p>
        <Button type="button" onClick={onClose}>
          Finish
        </Button>
      </div>
    );
    return chrome === "modal" ? (
      <Modal title="SSI Test Submitted" onClose={onClose}>
        {doneBody}
      </Modal>
    ) : (
      <Card className="ssi-modal">{doneBody}</Card>
    );
  }

  const formBody = (
    <>
      {chrome === "modal" && counsellorEmail && (
        <div className="ssi-modal__meta">
          Session with <strong>{counsellorEmail}</strong>
        </div>
      )}

      {/* Level progress */}
      <div className="ssi-modal__steps">
        {SSI_LEVELS.map((l) => (
          <span
            key={l.id}
            className={`ssi-modal__step-dot${l.id === step ? " ssi-modal__step-dot--active" : ""}${l.id < step ? " ssi-modal__step-dot--done" : ""}`}
          >
            {l.id}
          </span>
        ))}
      </div>

      {/* Level header: consent + how to answer */}
      <div className="ssi-modal__level-head">
        <h3 className="ssi-modal__level-title">{level.title}</h3>
        <p className="ssi-modal__consent">{level.consent}</p>
        <p className="ssi-modal__guidance">{level.guidance}</p>
      </div>

      {/* ── Level 1: basic details ──────────────────────────────────── */}
      {step === 1 && (
        <div className="ssi-modal__fields">
          {SSI_LEVEL1_FIELDS.map((f) => (
            <div key={f.id} className="ssi-modal__field">
              <label className="ssi-modal__label" htmlFor={`ssi-${f.id}`}>
                {f.label} {f.required && <span className="ssi-modal__required">*</span>}
              </label>
              {f.kind === "text" ? (
                <input
                  id={`ssi-${f.id}`}
                  className="ssi-modal__input"
                  type="text"
                  value={level1[f.id] ?? ""}
                  onChange={(e) => setLevel1((prev) => ({ ...prev, [f.id]: e.target.value }))}
                />
              ) : (
                <Select id={`ssi-${f.id}`} value={level1[f.id] ?? ""} onChange={(v) => setLevel1((prev) => ({ ...prev, [f.id]: v }))}>
                  {(f.options ?? []).map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </Select>
              )}
            </div>
          ))}
          <p className="ssi-modal__note">{SSI_PAGE1_NOTE}</p>
        </div>
      )}

      {/* ── Level 2: likert questions (shared options) ──────────────── */}
      {step === 2 && (
        <>
          <div className="ssi-modal__legend">
            {SSI_LIKERT_OPTIONS.map((o) => (
              <p key={o.value} className="ssi-modal__legend-item">
                <span className="ssi-modal__legend-num">{o.short}</span>
                {o.label}
              </p>
            ))}
          </div>
          {SSI_LIKERT_QUESTIONS.map((q, qi) => (
            <div key={q.id} className="ssi-modal__question">
              <span className="ssi-modal__q-label">
                {qi + 1}. {q.label}
              </span>
              <div className="ssi-modal__likert">
                {SSI_LIKERT_OPTIONS.map((o) => {
                  const selected = likert[q.id] === o.value;
                  return (
                    <button
                      key={o.value}
                      type="button"
                      aria-pressed={selected}
                      className={`ssi-modal__likert-opt${selected ? " ssi-modal__likert-opt--selected" : ""}`}
                      onClick={() => setLikert((prev) => ({ ...prev, [q.id]: o.value }))}
                    >
                      {o.short}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </>
      )}

      {/* ── Level 3: blanks + option-marking questions ──────────────── */}
      {step === 3 &&
        SSI_LEVEL3_QUESTIONS.map((q, qi) => (
          <div key={q.id} className="ssi-modal__question">
            <span className="ssi-modal__q-label">
              {qi + 1}. {q.label} {q.required && <span className="ssi-modal__required">*</span>}
            </span>
            {q.kind === "text" ? (
              <textarea
                className="ssi-modal__textarea"
                rows={3}
                value={lvl3[q.id] ?? ""}
                onChange={(e) => setLvl3((prev) => ({ ...prev, [q.id]: e.target.value }))}
              />
            ) : (
              <div className="ssi-modal__options">
                {(q.options ?? []).map((o) => {
                  const selected = lvl3[q.id] === o;
                  return (
                    <button
                      key={o}
                      type="button"
                      aria-pressed={selected}
                      className={`ssi-modal__option${selected ? " ssi-modal__option--selected" : ""}`}
                      onClick={() => setLvl3((prev) => ({ ...prev, [q.id]: o }))}
                    >
                      {o}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ))}

      {/* ── Level 4: whatsapp + consent + submit ────────────────────── */}
      {step === 4 && (
        <div className="ssi-modal__fields">
          <div className="ssi-modal__field">
            <label className="ssi-modal__label" htmlFor="ssi-whatsapp">
              Your Contact Details (WhatsApp number) <span className="ssi-modal__required">*</span>
            </label>
            <input
              id="ssi-whatsapp"
              className="ssi-modal__input"
              type="tel"
              inputMode="numeric"
              placeholder="e.g. 98765 43210"
              value={whatsapp}
              onChange={(e) => setWhatsapp(sanitizePhoneInput(e.target.value))}
            />
            {whatsapp && !whatsappValid && (
              <p className="ssi-modal__field-error">
                Enter a valid 10-digit mobile number (e.g. 98765 43210 or +91 98765 43210).
              </p>
            )}
            <p className="ssi-modal__note">{SSI_WHATSAPP_NOTE}</p>
          </div>

          <p className="ssi-modal__label">I understand that: <span className="ssi-modal__required">*</span></p>
          {SSI_CONSENT_ITEMS.map((item, i) => (
            <label key={i} className="ssi-modal__consent-check">
              <input
                type="checkbox"
                checked={Boolean(consentChecks[i])}
                onChange={(e) => setConsentChecks((prev) => ({ ...prev, [i]: e.target.checked }))}
              />
              <span>{item}</span>
            </label>
          ))}
          <p className="ssi-modal__consent-note">
            {counsellorEmail
              ? `Your responses will only be accessed by your authorised Wellness Counsellor (${counsellorEmail}).`
              : "Your responses will only be accessed by your college's authorised Wellness Counsellor/Head."}
          </p>
        </div>
      )}

      {error && (
        <p role="alert" className="ssi-modal__error">
          {error}
        </p>
      )}

      <div className="ssi-modal__actions">
        {step < 4 ? (
          <Button type="button" onClick={next}>
            Continue →
          </Button>
        ) : (
          <Button type="button" disabled={submitting} onClick={submit}>
            {submitting ? "Submitting…" : "Submit Test"}
          </Button>
        )}
        {step > 1 && (
          <Button
            type="button"
            variant="outlined"
            disabled={submitting}
            onClick={() => {
              setError("");
              setStep((s) => s - 1);
            }}
          >
            ← Back
          </Button>
        )}
      </div>
    </>
  );

  return chrome === "modal" ? (
    <Modal title={SSI_FORM_TITLE} className="ssi-modal" onClose={onClose}>
      {formBody}
    </Modal>
  ) : (
    <Card className="ssi-modal">
      <h3 className="ssi-modal__level-title" style={{ marginBottom: 4 }}>
        {SSI_FORM_TITLE}
      </h3>
      {formBody}
    </Card>
  );
}

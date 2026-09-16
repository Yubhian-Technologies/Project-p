import { useEffect, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import {
  submitWorkReport,
  listWorkReportsByUid,
  type WorkReport,
  type WorkReportType,
} from "../../services/firebase/workReports";
import { Select } from "../../components/common/Select";
import {
  RefreshIcon,
  CheckIcon,
  AlertTriangleIcon,
  CalendarIcon,
  ClockIcon,
  UserIcon,
} from "../../components/common/icons";
import "./WorkReportsSection.css";

const REPORT_TYPES: { value: WorkReportType; label: string }[] = [
  { value: "daily", label: "Daily Report" },
  { value: "weekly", label: "Weekly Report" },
  { value: "other", label: "Other" },
];

function FileTextIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function typeLabel(t: WorkReportType) {
  return REPORT_TYPES.find((r) => r.value === t)?.label ?? t;
}

export function WorkReportsSection() {
  const { profile } = useAuth();

  // ── form state ──────────────────────────────────────────────────────
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [reportType, setReportType] = useState<WorkReportType>("weekly");
  const [periodLabel, setPeriodLabel] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState("");

  // ── list state ──────────────────────────────────────────────────────
  const [reports, setReports] = useState<WorkReport[]>([]);
  const [loadingList, setLoadingList] = useState(true);

  async function loadReports() {
    if (!profile?.uid) return;
    setLoadingList(true);
    try {
      setReports(await listWorkReportsByUid(profile.uid));
    } finally {
      setLoadingList(false);
    }
  }

  useEffect(() => {
    loadReports();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.uid]);

  // ── submit ──────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setSubmitError("Please enter a report title."); return; }
    if (!body.trim()) { setSubmitError("Please enter the report content."); return; }
    if (!periodLabel.trim()) { setSubmitError("Please enter the period (e.g. Week 1, Sep 2026)."); return; }

    setSubmitting(true);
    setSubmitError("");
    setSubmitSuccess("");

    try {
      await submitWorkReport(
        title.trim(),
        body.trim(),
        reportType,
        periodLabel.trim(),
        profile?.displayName || profile?.email || "Counsellor",
        profile?.uid ?? "",
      );
      setSubmitSuccess("Report submitted successfully!");
      setTitle("");
      setBody("");
      setPeriodLabel("");
      await loadReports();
    } catch (err) {
      setSubmitError("Submission failed. Please try again.");
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="wr-section">
      {/* ── Submit Card ───────────────────────────────────────────── */}
      <div className="wr-submit-card">
        <h2 className="wr-submit-card__title">
          <span className="wr-submit-card__title-icon">
            <FileTextIcon />
          </span>
          Submit Work Report
        </h2>

        <form className="wr-submit-card__form" onSubmit={handleSubmit}>
          {/* Title */}
          <div className="wr-submit-card__field wr-submit-card__field--full">
            <label className="wr-submit-card__label" htmlFor="wr-title">
              Report Title
            </label>
            <input
              id="wr-title"
              className="wr-submit-card__input"
              type="text"
              placeholder="e.g. Weekly Work Summary – Sep 2026"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          {/* Report Type */}
          <div className="wr-submit-card__field">
            <label className="wr-submit-card__label" htmlFor="wr-type">
              Report Type
            </label>
            <Select
              id="wr-type"
              value={reportType}
              onChange={(v) => setReportType(v as WorkReportType)}
            >
              {REPORT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>
          </div>

          {/* Period */}
          <div className="wr-submit-card__field">
            <label className="wr-submit-card__label" htmlFor="wr-period">
              Period
            </label>
            <input
              id="wr-period"
              className="wr-submit-card__input"
              type="text"
              placeholder="e.g. Week 1, Sep 2026"
              value={periodLabel}
              onChange={(e) => setPeriodLabel(e.target.value)}
              required
            />
          </div>

          {/* Body */}
          <div className="wr-submit-card__field wr-submit-card__field--full">
            <label className="wr-submit-card__label" htmlFor="wr-body">
              Report Content
            </label>
            <textarea
              id="wr-body"
              className="wr-submit-card__textarea"
              placeholder="Describe your activities, sessions conducted, outcomes, challenges, and any notes for this period…"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              required
            />
          </div>

          {/* Actions */}
          <div className="wr-submit-card__actions">
            <button
              type="submit"
              className="wr-btn wr-btn--primary"
              disabled={submitting}
            >
              {submitting ? "Submitting…" : "Submit Report"}
            </button>

            {submitError && (
              <span className="wr-submit-card__error">
                <AlertTriangleIcon /> {submitError}
              </span>
            )}
            {submitSuccess && (
              <span className="wr-submit-card__success">
                <CheckIcon /> {submitSuccess}
              </span>
            )}
          </div>
        </form>
      </div>

      {/* ── My Reports ───────────────────────────────────────────────── */}
      <div>
        <div className="wr-list__header">
          <h3 className="wr-list__title">My Submitted Reports</h3>
          <button type="button" className="wr-btn wr-btn--ghost" onClick={loadReports}>
            <RefreshIcon /> Refresh
          </button>
        </div>

        {loadingList ? (
          <p style={{ color: "var(--neu-text-muted)", fontSize: 14 }}>Loading…</p>
        ) : reports.length === 0 ? (
          <div className="wr-list__empty">
            <div className="wr-list__empty-icon">
              <FileTextIcon />
            </div>
            <p>No work reports submitted yet.</p>
          </div>
        ) : (
          <div className="wr-list">
            {reports.map((r) => (
              <div key={r.id} className="wr-list__row">
                <div className="wr-list__row-top">
                  <div>
                    <div className="wr-list__row-title">{r.title}</div>
                    <div className="wr-list__row-meta">
                      <CalendarIcon /> {r.periodLabel}
                      &nbsp;·&nbsp;
                      <ClockIcon /> {formatDate(r.submittedAt)}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexShrink: 0, flexWrap: "wrap" }}>
                    <span className="wr-badge wr-badge--type">{typeLabel(r.reportType)}</span>
                    <span className={`wr-badge wr-badge--${r.status}`}>
                      {r.status === "verified" ? <><CheckIcon /> Verified</> : "⏳ Pending"}
                    </span>
                  </div>
                </div>

                <div className="wr-list__row-body">{r.body}</div>

                {r.status === "verified" && (
                  <div className="wr-list__row-notes">
                    <UserIcon />
                    <div>
                      <strong>Verified by {r.verifiedBy}</strong>
                      {r.headNotes ? ` — ${r.headNotes}` : ""}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

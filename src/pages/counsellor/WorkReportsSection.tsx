import { useEffect, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import {
  submitWorkReport,
  listWorkReportsByUid,
  deleteWorkReport,
  type WorkReport,
  type WorkReportType,
} from "../../services/firebase/workReports";
import { Select } from "../../components/common/Select";
import { Modal } from "../../components/common/Modal";
import {
  RefreshIcon,
  CheckIcon,
  AlertTriangleIcon,
  CalendarIcon,
  ClockIcon,
  UserIcon,
  TrashIcon,
  FileTextIcon,
  EyeIcon,
} from "../../components/common/icons";
import "./WorkReportsSection.css";

const REPORT_TYPES: { value: WorkReportType; label: string }[] = [
  { value: "daily", label: "Daily Report" },
  { value: "weekly", label: "Weekly Report" },
  { value: "other", label: "Other" },
];

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
  const [listError, setListError] = useState("");
  const [selectedReport, setSelectedReport] = useState<WorkReport | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function loadReports() {
    if (!profile?.uid) return;
    setLoadingList(true);
    setListError("");
    try {
      const next = await listWorkReportsByUid(profile.uid);
      setReports((prev) => {
        const map = new Map(prev.map((r) => [r.id, r]));
        next.forEach((r) => map.set(r.id, r));
        return [...map.values()].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
      });
    } catch (err) {
      console.warn("Failed to load work reports:", err);
      setListError(
        "Couldn't load your reports right now. If you just submitted one, it's saved — hit Refresh in a minute.",
      );
    } finally {
      setLoadingList(false);
    }
  }

  useEffect(() => {
    loadReports();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.uid]);

  // ── delete ──────────────────────────────────────────────────────────
  async function handleDelete(report: WorkReport) {
    if (!window.confirm(`Delete report "${report.title}"? This cannot be undone.`)) return;
    setDeletingId(report.id);
    try {
      await deleteWorkReport(report.id);
      setReports((prev) => prev.filter((r) => r.id !== report.id));
      if (selectedReport?.id === report.id) {
        setSelectedReport(null);
      }
    } catch (err) {
      console.error("Failed to delete report:", err);
      alert("Failed to delete report. Please try again.");
    } finally {
      setDeletingId(null);
    }
  }

  // ── submit ──────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError("");
    setSubmitSuccess("");
    if (!title.trim()) { setSubmitError("Please enter a report title."); return; }
    if (!body.trim()) { setSubmitError("Please enter the report content."); return; }
    if (!periodLabel.trim()) { setSubmitError("Please enter the period (e.g. Week 1, Sep 2026)."); return; }

    setSubmitting(true);

    try {
      const created = await submitWorkReport(
        title.trim(),
        body.trim(),
        reportType,
        periodLabel.trim(),
        profile?.displayName || profile?.email || "Counsellor",
        profile?.uid ?? "",
      );
      setSubmitError("");
      setSubmitSuccess("Report submitted successfully!");
      setTitle("");
      setBody("");
      setPeriodLabel("");
      setReports((prev) => [created, ...prev.filter((r) => r.id !== created.id)]);
      try {
        await loadReports();
      } catch (err) {
        console.warn("Report saved, but the list refresh failed:", err);
      }
    } catch (err) {
      setSubmitSuccess("");
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
          <p style={{ color: "#64748B", fontSize: 14 }}>Loading…</p>
        ) : listError ? (
          <div className="wr-list__empty">
            <div className="wr-list__empty-icon">
              <AlertTriangleIcon />
            </div>
            <p>{listError}</p>
          </div>
        ) : reports.length === 0 ? (
          <div className="wr-list__empty">
            <div className="wr-list__empty-icon">
              <FileTextIcon />
            </div>
            <p>No reports submitted yet!</p>
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
                  <div style={{ display: "flex", gap: 8, flexShrink: 0, flexWrap: "wrap", alignItems: "center" }}>
                    <span className="wr-badge wr-badge--type">{typeLabel(r.reportType)}</span>
                    <span className={`wr-badge wr-badge--${r.status}`}>
                      {r.status === "verified" ? <><CheckIcon /> Verified</> : "⏳ Pending"}
                    </span>
                    <button
                      type="button"
                      className="wr-btn wr-btn--view"
                      onClick={() => setSelectedReport(r)}
                    >
                      <EyeIcon /> View Details
                    </button>
                    <button
                      type="button"
                      className="wr-btn wr-btn--danger"
                      disabled={deletingId === r.id}
                      onClick={() => handleDelete(r)}
                    >
                      <TrashIcon /> {deletingId === r.id ? "Deleting…" : "Delete"}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Report Details Modal ───────────────────────────────────────── */}
      {selectedReport && (
        <Modal
          title={
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span>{selectedReport.title}</span>
            </div>
          }
          onClose={() => setSelectedReport(null)}
        >
          <div className="wr-modal__details">
            <div className="wr-modal__badges">
              <span className="wr-badge wr-badge--type">{typeLabel(selectedReport.reportType)}</span>
              <span className={`wr-badge wr-badge--${selectedReport.status}`}>
                {selectedReport.status === "verified" ? <><CheckIcon /> Verified</> : "⏳ Pending"}
              </span>
            </div>

            <div className="wr-modal__meta-grid">
              <div className="wr-modal__meta-item">
                <span className="wr-modal__meta-label">Submitted By</span>
                <span className="wr-modal__meta-val"><UserIcon /> {selectedReport.submittedBy}</span>
              </div>
              <div className="wr-modal__meta-item">
                <span className="wr-modal__meta-label">Period</span>
                <span className="wr-modal__meta-val"><CalendarIcon /> {selectedReport.periodLabel}</span>
              </div>
              <div className="wr-modal__meta-item">
                <span className="wr-modal__meta-label">Date Submitted</span>
                <span className="wr-modal__meta-val"><ClockIcon /> {formatDate(selectedReport.submittedAt)}</span>
              </div>
            </div>

            <div className="wr-modal__section">
              <h4 className="wr-modal__section-title">Report Content</h4>
              <div className="wr-modal__body-text">{selectedReport.body}</div>
            </div>

            {selectedReport.status === "verified" && (
              <div className="wr-modal__section wr-modal__section--verified">
                <h4 className="wr-modal__section-title">Head Verification Notes</h4>
                <div className="wr-modal__verified-box">
                  <UserIcon />
                  <div>
                    <strong>Verified by {selectedReport.verifiedBy}</strong>
                    {selectedReport.verifiedAt ? ` on ${formatDate(selectedReport.verifiedAt)}` : ""}
                    <p style={{ margin: "4px 0 0 0" }}>{selectedReport.headNotes || "No additional remarks."}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="wr-modal__actions">
              <button
                type="button"
                className="wr-btn wr-btn--danger"
                disabled={deletingId === selectedReport.id}
                onClick={() => handleDelete(selectedReport)}
              >
                <TrashIcon /> {deletingId === selectedReport.id ? "Deleting…" : "Delete Report"}
              </button>
              <button
                type="button"
                className="wr-btn wr-btn--ghost"
                onClick={() => setSelectedReport(null)}
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}



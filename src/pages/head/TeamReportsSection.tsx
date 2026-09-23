import { useEffect, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import {
  listAllWorkReports,
  verifyWorkReport,
  type WorkReport,
  type WorkReportType,
} from "../../services/firebase/workReports";
import { Modal } from "../../components/common/Modal";
import { ReportContentPreview } from "../../components/common/ReportContentPreview";
import {
  CheckIcon,
  RefreshIcon,
  CalendarIcon,
  ClockIcon,
  UserIcon,
  ClipboardListIcon,
  HourglassIcon,
  EyeIcon,
} from "../../components/common/icons";
import { downloadWorkReport } from "../../utils/downloadWorkReport";
import "./TeamReportsSection.css";

type Tab = "pending" | "verified";
type TypeFilter = "all" | WorkReportType;

const TYPE_FILTERS: { value: TypeFilter; label: string }[] = [
  { value: "all", label: "All Types" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "other", label: "Other" },
];

const REPORT_TYPE_LABELS: Record<WorkReportType, string> = {
  daily: "Daily",
  weekly: "Weekly",
  other: "Other",
};

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

export function TeamReportsSection() {
  const { profile } = useAuth();

  const [tab, setTab] = useState<Tab>("pending");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [reports, setReports] = useState<WorkReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<WorkReport | null>(null);
  const [headNotes, setHeadNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // ── download (PDF) ─────────────────────────────────────────────────
  async function handleDownload(report: WorkReport) {
    setDownloadingId(report.id);
    try {
      await downloadWorkReport(report);
    } finally {
      setDownloadingId(null);
    }
  }

  async function loadReports() {
    setLoading(true);
    try {
      setReports(await listAllWorkReports());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReports();
  }, []);

  const pending = reports.filter((r) => r.status === "pending");
  const verified = reports.filter((r) => r.status === "verified");
  const displayed = (tab === "pending" ? pending : verified).filter(
    (r) => typeFilter === "all" || r.reportType === typeFilter,
  );

  function openReport(r: WorkReport) {
    setSelectedReport(r);
    setHeadNotes("");
  }

  async function handleVerify(id: string) {
    setSaving(true);
    try {
      await verifyWorkReport(
        id,
        profile?.displayName || profile?.email || "Head",
        profile?.uid ?? "",
        headNotes.trim(),
      );
      setHeadNotes("");
      if (selectedReport?.id === id) {
        setSelectedReport((prev) => prev ? {
          ...prev,
          status: "verified",
          verifiedBy: profile?.displayName || profile?.email || "Head",
          verifiedAt: new Date().toISOString(),
          headNotes: headNotes.trim(),
        } : null);
      }
      await loadReports();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="tr-section">
      {/* ── Tab bar ──────────────────────────────────────────────── */}
      <div className="tr-tabs">
        <button
          type="button"
          className={`tr-tab${tab === "pending" ? " tr-tab--active" : ""}`}
          onClick={() => setTab("pending")}
        >
          <ClipboardListIcon />
          Pending Review
          <span className="tr-tab__badge">{pending.length}</span>
        </button>
        <button
          type="button"
          className={`tr-tab${tab === "verified" ? " tr-tab--active" : ""}`}
          onClick={() => setTab("verified")}
        >
          <CheckIcon />
          Verified Reports
          <span className="tr-tab__badge">{verified.length}</span>
        </button>
      </div>

      {/* ── Report-type filter ──────────────────────────────────────── */}
      <div className="tr-type-filter">
        {TYPE_FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            className={`tr-type-filter__chip${typeFilter === f.value ? " tr-type-filter__chip--active" : ""}`}
            onClick={() => setTypeFilter(f.value)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* ── Content ──────────────────────────────────────────────── */}
      <div>
        <div className="tr-list__header">
          <h3 className="tr-list__title">
            {tab === "pending" ? "Pending Counsellor Reports" : "Verified Team Reports"}
          </h3>
          <button type="button" className="tr-btn tr-btn--ghost" onClick={loadReports}>
            <RefreshIcon /> Refresh
          </button>
        </div>

        {loading ? (
          <p style={{ color: "#64748B", fontSize: 14, marginTop: 12 }}>
            Loading reports…
          </p>
        ) : displayed.length === 0 ? (
          <div className="tr-list__empty">
            <div className="tr-list__empty-icon">
              <ClipboardListIcon />
            </div>
            <p>
              {tab === "pending"
                ? "No pending reports. All caught up! ✅"
                : "No verified reports yet."}
            </p>
          </div>
        ) : (
          <div className="tr-list">
            {displayed.map((r) => (
              <div key={r.id} className="tr-card tr-card--clickable" onClick={() => openReport(r)}>
                <div className="tr-card__top">
                  <div className="tr-card__title">{r.title}</div>
                  <span className={`tr-status tr-status--${r.status}`}>
                    {r.status === "verified" ? <><CheckIcon /> Verified</> : <><HourglassIcon /> Pending</>}
                  </span>
                </div>

                <div className="tr-card__meta">
                  <UserIcon /> {r.submittedBy}
                  &nbsp;·&nbsp;
                  <CalendarIcon /> {r.periodLabel}
                  &nbsp;·&nbsp;
                  <ClockIcon /> {formatDate(r.submittedAt)}
                </div>

                <button
                  type="button"
                  className="tr-btn tr-btn--view"
                  onClick={(e) => {
                    e.stopPropagation();
                    openReport(r);
                  }}
                >
                  <EyeIcon /> View Details
                </button>
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
          <div className="tr-modal__details">
            <div className="tr-modal__badges">
              <span className="tr-badge tr-badge--type">{REPORT_TYPE_LABELS[selectedReport.reportType]}</span>
              <span className={`tr-badge tr-badge--${selectedReport.status}`}>
                {selectedReport.status === "verified" ? <><CheckIcon /> Verified</> : <><HourglassIcon /> Pending</>}
              </span>
            </div>

            <div className="tr-modal__meta-grid">
              <div className="tr-modal__meta-item">
                <span className="tr-modal__meta-label">Submitted By</span>
                <span className="tr-modal__meta-val"><UserIcon /> {selectedReport.submittedBy}</span>
              </div>
              <div className="tr-modal__meta-item">
                <span className="tr-modal__meta-label">Period</span>
                <span className="tr-modal__meta-val"><CalendarIcon /> {selectedReport.periodLabel}</span>
              </div>
              <div className="tr-modal__meta-item">
                <span className="tr-modal__meta-label">Date Submitted</span>
                <span className="tr-modal__meta-val"><ClockIcon /> {formatDate(selectedReport.submittedAt)}</span>
              </div>
            </div>

            <div className="tr-modal__section">
              <h4 className="tr-modal__section-title">Report Content</h4>
              <ReportContentPreview
                downloading={downloadingId === selectedReport.id}
                onDownload={() => void handleDownload(selectedReport)}
              />
            </div>

            {selectedReport.status === "verified" ? (
              <div className="tr-modal__section tr-modal__section--verified">
                <h4 className="tr-modal__section-title">Verification Info</h4>
                <div className="tr-modal__verified-box">
                  <UserIcon />
                  <div>
                    <strong>Verified by {selectedReport.verifiedBy}</strong>
                    {selectedReport.verifiedAt ? ` on ${formatDate(selectedReport.verifiedAt)}` : ""}
                    <p style={{ margin: "4px 0 0 0" }}>{selectedReport.headNotes || "No additional remarks."}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="tr-modal__section">
                <h4 className="tr-modal__section-title">Verify Report</h4>
                <div className="tr-verify-panel">
                  <label className="tr-verify-panel__label" htmlFor={`tr-modal-notes-${selectedReport.id}`}>
                    Notes / Feedback (optional)
                  </label>
                  <textarea
                    id={`tr-modal-notes-${selectedReport.id}`}
                    className="tr-verify-panel__textarea"
                    placeholder="Add feedback before verifying…"
                    value={headNotes}
                    onChange={(e) => setHeadNotes(e.target.value)}
                  />
                  <div className="tr-verify-panel__actions">
                    <button
                      type="button"
                      className="tr-btn tr-btn--verify"
                      disabled={saving}
                      onClick={() => handleVerify(selectedReport.id)}
                    >
                      <CheckIcon /> {saving ? "Saving…" : "Confirm & Verify"}
                    </button>
                  </div>
                </div>
              </div>
            )}

          </div>
        </Modal>
      )}
    </div>
  );
}


import { useEffect, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import {
  listAllWorkReports,
  verifyWorkReport,
  type WorkReport,
  type WorkReportType,
} from "../../services/firebase/workReports";
import {
  CheckIcon,
  RefreshIcon,
  CalendarIcon,
  ClockIcon,
  UserIcon,
} from "../../components/common/icons";
import "./TeamReportsSection.css";

type Tab = "pending" | "verified";

const REPORT_TYPE_LABELS: Record<WorkReportType, string> = {
  daily: "Daily",
  weekly: "Weekly",
  other: "Other",
};

function ClipboardListIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
      <rect x="9" y="3" width="6" height="4" rx="1" />
      <line x1="9" y1="12" x2="15" y2="12" />
      <line x1="9" y1="16" x2="13" y2="16" />
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

export function TeamReportsSection() {
  const { profile } = useAuth();

  const [tab, setTab] = useState<Tab>("pending");
  const [reports, setReports] = useState<WorkReport[]>([]);
  const [loading, setLoading] = useState(true);

  // id of report with verify panel open
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [headNotes, setHeadNotes] = useState("");
  const [saving, setSaving] = useState(false);

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
  const displayed = tab === "pending" ? pending : verified;

  function openVerify(id: string) {
    setVerifyingId(id);
    setHeadNotes("");
  }

  function closeVerify() {
    setVerifyingId(null);
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
      closeVerify();
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
          <p style={{ color: "var(--neu-text-muted)", fontSize: 14, marginTop: 12 }}>
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
              <div key={r.id} className="tr-card">
                {/* Top row */}
                <div className="tr-card__top">
                  <div>
                    <div className="tr-card__title">{r.title}</div>
                    <div className="tr-card__meta">
                      <UserIcon /> {r.submittedBy}
                      &nbsp;·&nbsp;
                      <CalendarIcon /> {r.periodLabel}
                      &nbsp;·&nbsp;
                      <ClockIcon /> {formatDate(r.submittedAt)}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 8, flexShrink: 0, flexWrap: "wrap", alignItems: "center" }}>
                    <span className="tr-badge tr-badge--type">
                      {REPORT_TYPE_LABELS[r.reportType]}
                    </span>
                    <span className={`tr-badge tr-badge--${r.status}`}>
                      {r.status === "verified" ? <><CheckIcon /> Verified</> : "⏳ Pending"}
                    </span>

                    {r.status === "pending" && verifyingId !== r.id && (
                      <button
                        type="button"
                        className="tr-btn tr-btn--verify"
                        onClick={() => openVerify(r.id)}
                      >
                        <CheckIcon /> Verify
                      </button>
                    )}
                  </div>
                </div>

                {/* Report body */}
                <div className="tr-card__body">{r.body}</div>

                {/* Verified stamp */}
                {r.status === "verified" && (
                  <div className="tr-card__verified-row">
                    <UserIcon />
                    <div>
                      <strong>Verified by {r.verifiedBy}</strong>
                      {r.verifiedAt ? ` on ${formatDate(r.verifiedAt)}` : ""}
                      {r.headNotes ? ` — ${r.headNotes}` : ""}
                    </div>
                  </div>
                )}

                {/* Inline verify panel */}
                {verifyingId === r.id && (
                  <div className="tr-verify-panel">
                    <label className="tr-verify-panel__label" htmlFor={`tr-notes-${r.id}`}>
                      Notes / Feedback (optional)
                    </label>
                    <textarea
                      id={`tr-notes-${r.id}`}
                      className="tr-verify-panel__textarea"
                      placeholder="Add any feedback or remarks for this report…"
                      value={headNotes}
                      onChange={(e) => setHeadNotes(e.target.value)}
                    />
                    <div className="tr-verify-panel__actions">
                      <button
                        type="button"
                        className="tr-btn tr-btn--verify"
                        disabled={saving}
                        onClick={() => handleVerify(r.id)}
                      >
                        <CheckIcon /> {saving ? "Saving…" : "Confirm & Verify"}
                      </button>
                      <button
                        type="button"
                        className="tr-btn tr-btn--cancel"
                        disabled={saving}
                        onClick={closeVerify}
                      >
                        Cancel
                      </button>
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

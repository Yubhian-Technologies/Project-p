import { useEffect, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import {
  listAllWorkReports,
  verifyWorkReport,
  type WorkReport,
} from "../../services/firebase/workReports";
import { listPendingTransferRequestsForCampus } from "../../services/firebase/bookings";
import { Modal } from "../../components/common/Modal";
import { Button } from "../../components/common/Button";
import {
  ClipboardListIcon,
  RefreshIcon,
  BellIcon,
  CalendarIcon,
  FolderOpenIcon,
  AlertTriangleIcon,
  UserIcon,
  MapPinIcon,
  EyeIcon,
  UsersIcon,
  HelpCircleIcon,
  MessageCircleIcon,
  CheckIcon,
} from "../../components/common/icons";
import "./HeadHomeActivityOverview.css";

interface HeadHomeActivityOverviewProps {
  onSelectSection: (sectionId: string) => void;
}

export function HeadHomeActivityOverview({ onSelectSection }: HeadHomeActivityOverviewProps) {
  const { profile } = useAuth();
  const [reports, setReports] = useState<WorkReport[]>([]);
  const [loadingReports, setLoadingReports] = useState(true);
  const [transferCount, setTransferCount] = useState(0);
  const [selectedReport, setSelectedReport] = useState<WorkReport | null>(null);

  // Verification state in modal
  const [isVerifying, setIsVerifying] = useState(false);
  const [headNotes, setHeadNotes] = useState("");
  const [savingVerify, setSavingVerify] = useState(false);

  async function loadData() {
    setLoadingReports(true);
    try {
      const allReports = await listAllWorkReports();
      setReports(allReports);

      if (profile?.campusId) {
        const transfers = await listPendingTransferRequestsForCampus(profile.campusId);
        setTransferCount(transfers.length);
      }
    } catch (err) {
      console.error("Failed to load activity feed", err);
    } finally {
      setLoadingReports(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [profile?.campusId]);

  const pendingReports = reports.filter((r) => r.status === "pending");
  const recentReports = reports.slice(0, 5); // top 5 recent

  async function handleVerify(reportId: string) {
    if (!profile) return;
    setSavingVerify(true);
    try {
      await verifyWorkReport(
        reportId,
        profile.displayName || profile.email || "Head",
        profile.uid,
        headNotes.trim()
      );
      setSelectedReport((prev) =>
        prev && prev.id === reportId
          ? {
              ...prev,
              status: "verified",
              verifiedBy: profile.displayName || profile.email || "Head",
              verifiedAt: new Date().toISOString(),
              headNotes: headNotes.trim(),
            }
          : null
      );
      setIsVerifying(false);
      await loadData();
    } catch (err) {
      console.error("Failed to verify report", err);
    } finally {
      setSavingVerify(false);
    }
  }

  return (
    <div className="hha-overview">
      {/* ── Header Bar ────────────────────────────────────────── */}
      <div className="hha-header">
        <div>
          <h3 className="hha-header__title">
            <ClipboardListIcon />
            <span>Department Activity & Submissions Feed</span>
          </h3>
          <p className="hha-header__sub">
            Real-time updates on submitted work reports, transfer requests, and department alerts.
          </p>
        </div>
        <Button type="button" variant="outlined" onClick={loadData}>
          <RefreshIcon /> Refresh Activity
        </Button>
      </div>

      {/* ── Main Activity Grid ─────────────────────────────────── */}
      <div className="hha-grid">
        {/* Left Column: Work Reports Feed */}
        <div className="hha-card hha-card--main">
          <div className="hha-card__header">
            <div className="hha-card__title-wrap">
              <span className="hha-card__icon"><ClipboardListIcon /></span>
              <div>
                <h4 className="hha-card__title">Submitted Work Reports</h4>
                <span className="hha-card__subtitle">
                  Reports shared by counsellors requiring head review
                </span>
              </div>
            </div>
            {pendingReports.length > 0 ? (
              <span className="hha-badge hha-badge--pending">
                {pendingReports.length} Pending Review
              </span>
            ) : (
              <span className="hha-badge hha-badge--all-clear"><CheckIcon /> Up to Date</span>
            )}
          </div>

          {loadingReports ? (
            <p className="hha-loading">Loading recent work reports…</p>
          ) : recentReports.length === 0 ? (
            <div className="hha-empty">
              <p>No work reports submitted by counsellors yet.</p>
            </div>
          ) : (
            <div className="hha-feed">
              {recentReports.map((report) => (
                <div key={report.id} className="hha-feed__item">
                  <div className="hha-feed__item-left">
                    <div className="hha-feed__item-top">
                      <span className="hha-feed__item-title">{report.title}</span>
                      <span
                        className={`hha-tag hha-tag--${
                          report.status === "pending" ? "pending" : "verified"
                        }`}
                      >
                        {report.status === "pending" ? "Pending Review" : "Verified"}
                      </span>
                    </div>
                    <div className="hha-feed__item-meta">
                      <span><UserIcon /> {report.submittedBy || "Counsellor"}</span>
                      <span><CalendarIcon /> {new Date(report.submittedAt).toLocaleDateString("en-IN")}</span>
                      <span><MapPinIcon /> {report.periodLabel || report.reportType}</span>
                    </div>
                  </div>

                  <div className="hha-feed__item-actions">
                    <button
                      type="button"
                      className="hha-btn-view"
                      onClick={() => {
                        setSelectedReport(report);
                        setIsVerifying(false);
                      }}
                    >
                      <EyeIcon /> View Details
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="hha-card__footer">
            <button
              type="button"
              className="hha-link-btn"
              onClick={() => onSelectSection("work-reports")}
            >
              Go to Full Work Reports Section →
            </button>
          </div>
        </div>

        {/* Right Column: Requests & Section Shortcuts */}
        <div className="hha-card hha-card--side">
          <div className="hha-card__header">
            <div className="hha-card__title-wrap">
              <span className="hha-card__icon"><BellIcon /></span>
              <div>
                <h4 className="hha-card__title">Pending Alerts & Requests</h4>
                <span className="hha-card__subtitle">Quick overview of pending actions</span>
              </div>
            </div>
          </div>

          <div className="hha-status-list">
            {/* Session Transfers */}
            <div className="hha-status-item">
              <div className="hha-status-item__left">
                <span className="hha-status-icon"><RefreshIcon /></span>
                <div>
                  <strong>Session Transfer Requests</strong>
                  <p>{transferCount > 0 ? `${transferCount} pending transfers` : "No pending transfers"}</p>
                </div>
              </div>
              <button
                type="button"
                className="hha-status-btn"
                onClick={() => onSelectSection("transfer-requests")}
              >
                Review →
              </button>
            </div>

            {/* Session Requests */}
            <div className="hha-status-item">
              <div className="hha-status-item__left">
                <span className="hha-status-icon"><CalendarIcon /></span>
                <div>
                  <strong>Booking Requests</strong>
                  <p>Manage incoming student appointments</p>
                </div>
              </div>
              <button
                type="button"
                className="hha-status-btn"
                onClick={() => onSelectSection("requests")}
              >
                View →
              </button>
            </div>

            {/* Monthly Reports */}
            <div className="hha-status-item">
              <div className="hha-status-item__left">
                <span className="hha-status-icon"><FolderOpenIcon /></span>
                <div>
                  <strong>Monthly Reports</strong>
                  <p>Department monthly upload status</p>
                </div>
              </div>
              <button
                type="button"
                className="hha-status-btn"
                onClick={() => onSelectSection("monthly-reports")}
              >
                Open →
              </button>
            </div>

            {/* Emergency Alerts */}
            <div className="hha-status-item hha-status-item--urgent">
              <div className="hha-status-item__left">
                <span className="hha-status-icon"><AlertTriangleIcon /></span>
                <div>
                  <strong>Emergency SOS Alerts</strong>
                  <p>High priority crisis interventions</p>
                </div>
              </div>
              <button
                type="button"
                className="hha-status-btn hha-status-btn--urgent"
                onClick={() => onSelectSection("emergency")}
              >
                Alerts →
              </button>
            </div>
          </div>

          {/* Quick Shortcuts */}
          <div className="hha-shortcuts">
            <span className="hha-shortcuts__label">Quick Department Jumps:</span>
            <div className="hha-shortcuts__grid">
              <button type="button" onClick={() => onSelectSection("team-reports")}>
                <ClipboardListIcon /> Team Reports
              </button>
              <button type="button" onClick={() => onSelectSection("team-management")}>
                <UsersIcon /> Team Workload
              </button>
              <button type="button" onClick={() => onSelectSection("flash-qa")}>
                <HelpCircleIcon /> Flash Q/A
              </button>
              <button type="button" onClick={() => onSelectSection("community")}>
                <MessageCircleIcon /> Community
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── View Work Report Details Modal ────────────────────── */}
      {selectedReport && (
        <Modal
          onClose={() => {
            setSelectedReport(null);
            setIsVerifying(false);
          }}
          title={`Work Report: ${selectedReport.title}`}
        >
          <div className="hha-modal">
            <div className="hha-modal__meta">
              <div className="hha-modal__chip">
                <strong>Submitted By:</strong> {selectedReport.submittedBy || "Counsellor"}
              </div>
              <div className="hha-modal__chip">
                <strong>Submitted On:</strong>{" "}
                {new Date(selectedReport.submittedAt).toLocaleString("en-IN")}
              </div>
              <div className="hha-modal__chip">
                <strong>Period / Type:</strong>{" "}
                {selectedReport.periodLabel || selectedReport.reportType}
              </div>
              <div className="hha-modal__chip">
                <strong>Status:</strong>{" "}
                <span
                  className={`hha-tag hha-tag--${
                    selectedReport.status === "pending" ? "pending" : "verified"
                  }`}
                >
                  {selectedReport.status === "pending" ? "Pending Review" : "✓ Verified"}
                </span>
              </div>
            </div>

            <div className="hha-modal__body">
              <h5 className="hha-modal__section-heading">Report Body / Shared Summary:</h5>
              <div className="hha-modal__content-box">{selectedReport.body}</div>
            </div>

            {selectedReport.status === "verified" && selectedReport.headNotes && (
              <div className="hha-modal__notes">
                <strong>Head Verification Notes:</strong>
                <p>{selectedReport.headNotes}</p>
                <span className="hha-modal__notes-by">
                  — Verified by {selectedReport.verifiedBy} on{" "}
                  {selectedReport.verifiedAt
                    ? new Date(selectedReport.verifiedAt).toLocaleDateString("en-IN")
                    : "record"}
                </span>
              </div>
            )}

            {selectedReport.status === "pending" && (
              <div className="hha-modal__action-area">
                {!isVerifying ? (
                  <Button type="button" variant="filled" onClick={() => setIsVerifying(true)}>
                    ✓ Verify & Approve Report
                  </Button>
                ) : (
                  <div className="hha-modal__verify-form">
                    <label htmlFor="hha-head-notes">Add Head Review Notes (Optional):</label>
                    <textarea
                      id="hha-head-notes"
                      rows={3}
                      value={headNotes}
                      onChange={(e) => setHeadNotes(e.target.value)}
                      placeholder="e.g. Excellent progress this week. Approved."
                    />
                    <div className="hha-modal__verify-btns">
                      <Button
                        type="button"
                        variant="filled"
                        onClick={() => handleVerify(selectedReport.id)}
                        disabled={savingVerify}
                      >
                        {savingVerify ? "Saving…" : "Confirm Verification"}
                      </Button>
                      <Button
                        type="button"
                        variant="outlined"
                        onClick={() => setIsVerifying(false)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}

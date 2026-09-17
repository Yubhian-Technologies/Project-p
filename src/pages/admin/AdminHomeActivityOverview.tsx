import { useEffect, useState } from "react";
import {
  listMonthlyReports,
  type MonthlyReport,
} from "../../services/firebase/monthlyReports";
import {
  listAllWorkReports,
  type WorkReport,
} from "../../services/firebase/workReports";
import { Modal } from "../../components/common/Modal";
import { Button } from "../../components/common/Button";
import {
  TrendingUpIcon,
  RefreshIcon,
  FolderOpenIcon,
  ClipboardListIcon,
  UserIcon,
  CalendarIcon,
  FileTextIcon,
  DownloadIcon,
  EyeIcon,
  BuildingIcon,
  KeyIcon,
  SparklesIcon,
  StarIcon,
} from "../../components/common/icons";
import "./AdminHomeActivityOverview.css";

interface AdminHomeActivityOverviewProps {
  onSelectSection: (sectionId: string) => void;
}

export function AdminHomeActivityOverview({ onSelectSection }: AdminHomeActivityOverviewProps) {
  const [monthlyReports, setMonthlyReports] = useState<MonthlyReport[]>([]);
  const [workReports, setWorkReports] = useState<WorkReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedWorkReport, setSelectedWorkReport] = useState<WorkReport | null>(null);

  async function loadData() {
    setLoading(true);
    try {
      const [mReports, wReports] = await Promise.all([
        listMonthlyReports(),
        listAllWorkReports(),
      ]);
      setMonthlyReports(mReports);
      setWorkReports(wReports);
    } catch (err) {
      console.error("Failed to load admin home activity", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const MONTHS = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];

  return (
    <div className="aha-overview">
      {/* ── Header Bar ────────────────────────────────────────── */}
      <div className="aha-header">
        <div>
          <h3 className="aha-header__title">
            <TrendingUpIcon />
            <span>System Activity & Submissions Overview</span>
          </h3>
          <p className="aha-header__sub">
            All submitted monthly reports, counsellor work reports, and platform section status.
          </p>
        </div>
        <Button type="button" variant="outlined" onClick={loadData}>
          <RefreshIcon /> Refresh Activity
        </Button>
      </div>

      {/* ── Main Bento Grid ───────────────────────────────────── */}
      <div className="aha-grid">
        {/* Left Column: Monthly Reports Feed */}
        <div className="aha-card aha-card--main">
          <div className="aha-card__header">
            <div className="aha-card__title-wrap">
              <span className="aha-card__icon"><FolderOpenIcon /></span>
              <div>
                <h4 className="aha-card__title">Head Monthly Reports Submitted</h4>
                <span className="aha-card__subtitle">
                  Reports uploaded by department heads across all campuses
                </span>
              </div>
            </div>
            <span className="aha-badge aha-badge--blue">
              {monthlyReports.length} Reports Total
            </span>
          </div>

          {loading ? (
            <p className="aha-loading">Loading submitted monthly reports…</p>
          ) : monthlyReports.length === 0 ? (
            <div className="aha-empty">
              <p>No monthly reports uploaded by department heads yet.</p>
            </div>
          ) : (
            <div className="aha-feed">
              {monthlyReports.slice(0, 5).map((report) => (
                <div key={report.id} className="aha-feed__item">
                  <div className="aha-feed__item-left">
                    <div className="aha-feed__item-top">
                      <span className="aha-feed__item-title">{report.title}</span>
                      <span className="aha-tag aha-tag--month">
                        {MONTHS[(report.month - 1 + 12) % 12]} {report.year}
                      </span>
                    </div>
                    <div className="aha-feed__item-meta">
                      <span><UserIcon /> {report.uploadedBy || "Department Head"}</span>
                      <span><CalendarIcon /> {new Date(report.uploadedAt).toLocaleDateString("en-IN")}</span>
                      <span><FileTextIcon /> {report.fileName}</span>
                    </div>
                  </div>

                  <div className="aha-feed__item-actions">
                    <a
                      href={report.downloadURL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="aha-btn-dl"
                    >
                      <DownloadIcon /> View / Download
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="aha-card__footer">
            <button
              type="button"
              className="aha-link-btn"
              onClick={() => onSelectSection("monthly-reports")}
            >
              Go to Full Monthly Reports Section →
            </button>
          </div>
        </div>

        {/* Right Column: Work Reports & Shortcuts */}
        <div className="aha-card aha-card--side">
          <div className="aha-card__header">
            <div className="aha-card__title-wrap">
              <span className="aha-card__icon"><ClipboardListIcon /></span>
              <div>
                <h4 className="aha-card__title">Counsellor Work Reports</h4>
                <span className="aha-card__subtitle">Recent submissions from counsellors</span>
              </div>
            </div>
          </div>

          {loading ? (
            <p className="aha-loading">Loading work reports…</p>
          ) : workReports.length === 0 ? (
            <p className="aha-empty">No work reports submitted yet.</p>
          ) : (
            <div className="aha-mini-list">
              {workReports.slice(0, 4).map((report) => (
                <div key={report.id} className="aha-mini-item">
                  <div>
                    <strong className="aha-mini-item__title">{report.title}</strong>
                    <span className="aha-mini-item__sub">
                      By {report.submittedBy} • {new Date(report.submittedAt).toLocaleDateString("en-IN")}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="aha-btn-sm"
                    onClick={() => setSelectedWorkReport(report)}
                  >
                    <EyeIcon /> View
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Section Shortcuts */}
          <div className="aha-shortcuts">
            <span className="aha-shortcuts__label">Admin Platform Shortcuts:</span>
            <div className="aha-shortcuts__grid">
              <button type="button" onClick={() => onSelectSection("campuses")}>
                <BuildingIcon /> Campuses
              </button>
              <button type="button" onClick={() => onSelectSection("logins")}>
                <KeyIcon /> Logins & Roles
              </button>
              <button type="button" onClick={() => onSelectSection("events")}>
                <SparklesIcon /> Events Overview
              </button>
              <button type="button" onClick={() => onSelectSection("analytics")}>
                <TrendingUpIcon /> Analytics
              </button>
              <button type="button" onClick={() => onSelectSection("counsellor-ratings")}>
                <StarIcon /> Ratings
              </button>
              <button type="button" onClick={() => onSelectSection("monthly-reports")}>
                <FolderOpenIcon /> Monthly Reports
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── View Work Report Modal ────────────────────────────── */}
      {selectedWorkReport && (
        <Modal
          onClose={() => setSelectedWorkReport(null)}
          title={`Work Report: ${selectedWorkReport.title}`}
        >
          <div className="aha-modal">
            <div className="aha-modal__meta">
              <div><strong>Counsellor:</strong> {selectedWorkReport.submittedBy}</div>
              <div><strong>Submitted:</strong> {new Date(selectedWorkReport.submittedAt).toLocaleString("en-IN")}</div>
              <div><strong>Period:</strong> {selectedWorkReport.periodLabel || selectedWorkReport.reportType}</div>
              <div>
                <strong>Status:</strong>{" "}
                <span className={`aha-tag aha-tag--${selectedWorkReport.status === "pending" ? "pending" : "verified"}`}>
                  {selectedWorkReport.status === "pending" ? "Pending Review" : "Verified"}
                </span>
              </div>
            </div>

            <div className="aha-modal__body">
              <h5>Report Content:</h5>
              <div className="aha-modal__content-box">{selectedWorkReport.body}</div>
            </div>

            {selectedWorkReport.headNotes && (
              <div className="aha-modal__notes">
                <strong>Head Verification Notes:</strong>
                <p>{selectedWorkReport.headNotes}</p>
                <span>— Verified by {selectedWorkReport.verifiedBy}</span>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}

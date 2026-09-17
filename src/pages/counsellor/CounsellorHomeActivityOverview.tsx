import { useEffect, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import {
  listWorkReportsByUid,
  type WorkReport,
} from "../../services/firebase/workReports";
import { listBookingsForCounsellor } from "../../services/firebase/bookings";
import type { Booking } from "../../types/booking";
import { Modal } from "../../components/common/Modal";
import {
  TrendingUpIcon,
  CalendarIcon,
  CheckIcon,
  ClipboardListIcon,
  EyeIcon,
  ZapIcon,
  StarIcon,
  SparklesIcon,
  BookOpenIcon,
  MessageCircleIcon,
  AlertTriangleIcon,
} from "../../components/common/icons";
import "./CounsellorHomeActivityOverview.css";

interface CounsellorHomeActivityOverviewProps {
  onSelectSection: (sectionId: string) => void;
}

export function CounsellorHomeActivityOverview({ onSelectSection }: CounsellorHomeActivityOverviewProps) {
  const { profile } = useAuth();
  const [myReports, setMyReports] = useState<WorkReport[]>([]);
  const [myBookings, setMyBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<WorkReport | null>(null);

  useEffect(() => {
    if (!profile?.uid) return;

    setLoading(true);
    Promise.all([
      listWorkReportsByUid(profile.uid),
      listBookingsForCounsellor(profile.uid),
    ])
      .then(([reportsData, bookingsData]) => {
        setMyReports(reportsData);
        setMyBookings(bookingsData);
      })
      .catch((err) => console.error("Failed to load counsellor overview data", err))
      .finally(() => setLoading(false));
  }, [profile?.uid]);

  const pendingBookings = myBookings.filter(
    (b) => b.status === "pending" || b.status === "accepted" || b.status === "scheduled"
  );

  return (
    <div className="cha-overview">
      <div className="cha-header">
        <div>
          <h3 className="cha-header__title"><TrendingUpIcon /> Workspace Activity & Notifications Feed</h3>
          <p className="cha-header__sub">
            Recent session requests, work report statuses, and workspace shortcuts.
          </p>
        </div>
      </div>

      <div className="cha-grid">
        {/* Left Column: Session Requests & My Work Reports */}
        <div className="cha-card cha-card--main">
          <div className="cha-card__header">
            <div className="cha-card__title-wrap">
              <span className="cha-card__icon"><CalendarIcon /></span>
              <div>
                <h4 className="cha-card__title">Incoming Session Requests</h4>
                <span className="cha-card__subtitle">Student appointments awaiting review</span>
              </div>
            </div>
            {pendingBookings.length > 0 ? (
              <span className="cha-badge cha-badge--pending">{pendingBookings.length} Active</span>
            ) : (
              <span className="cha-badge cha-badge--clear"><CheckIcon width={12} height={12} /> All Clear</span>
            )}
          </div>

          {pendingBookings.length === 0 ? (
            <div className="cha-empty">No active session requests at this time.</div>
          ) : (
            <div className="cha-feed">
              {pendingBookings.slice(0, 4).map((booking) => (
                <div key={booking.id} className="cha-feed__item">
                  <div>
                    <strong className="cha-feed__title">{booking.userEmail}</strong>
<span className="cha-feed__meta">
  <CalendarIcon width={12} height={12} />
  {booking.scheduledAt ? new Date(booking.scheduledAt).toLocaleString("en-IN") : "Pending Slot"} • Status: {booking.status.toUpperCase()}
</span>
                  </div>
                  <button
                    type="button"
                    className="cha-btn-action"
                    onClick={() => onSelectSection("requests")}
                  >
                    Review Request →
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Submitted Work Reports Status Section */}
          <div className="cha-card__header" style={{ marginTop: 16 }}>
            <div className="cha-card__title-wrap">
              <span className="cha-card__icon"><ClipboardListIcon /></span>
              <div>
                <h4 className="cha-card__title">My Submitted Work Reports</h4>
                <span className="cha-card__subtitle">Status of work reports shared with department head</span>
              </div>
            </div>
          </div>

          {loading ? (
            <p className="cha-loading">Loading my work reports…</p>
          ) : myReports.length === 0 ? (
            <div className="cha-empty">No work reports submitted yet.</div>
          ) : (
            <div className="cha-feed">
              {myReports.slice(0, 4).map((report) => (
                <div key={report.id} className="cha-feed__item">
                  <div>
                    <strong className="cha-feed__title">{report.title}</strong>
<span className="cha-feed__meta">
  <CalendarIcon width={12} height={12} />
  Submitted {new Date(report.submittedAt).toLocaleDateString("en-IN")} • Status:{" "}
                      <span className={`cha-tag cha-tag--${report.status}`}>
                        {report.status === "pending" ? "Pending Head Review" : "✓ Verified by Head"}
                      </span>
                    </span>
                  </div>
                  <button
                    type="button"
                    className="cha-btn-view"
                    onClick={() => setSelectedReport(report)}
                  >
                    <EyeIcon width={13} height={13} /> View Report
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Shortcuts & Quick Jumps */}
        <div className="cha-card cha-card--side">
          <div className="cha-card__header">
            <div className="cha-card__title-wrap">
              <span className="cha-card__icon"><ZapIcon /></span>
              <div>
                <h4 className="cha-card__title">Workspace Shortcuts</h4>
                <span className="cha-card__subtitle">Jump to section</span>
              </div>
            </div>
          </div>

          <div className="cha-shortcuts__list">
<button type="button" onClick={() => onSelectSection("requests")}>
  <CalendarIcon /> Session Requests ({pendingBookings.length})
</button>
<button type="button" onClick={() => onSelectSection("work-reports")}>
  <ClipboardListIcon /> Work Reports ({myReports.length})
</button>
<button type="button" onClick={() => onSelectSection("feedback")}>
  <StarIcon /> My Session Feedback
</button>
<button type="button" onClick={() => onSelectSection("events")}>
  <SparklesIcon /> Events & Programs
</button>
<button type="button" onClick={() => onSelectSection("journal")}>
  <BookOpenIcon /> Counselling Journal
</button>
<button type="button" onClick={() => onSelectSection("community")}>
  <MessageCircleIcon /> Wellness Community
</button>
<button type="button" className="cha-btn-urgent" onClick={() => onSelectSection("emergency")}>
  <AlertTriangleIcon /> Emergency Alerts
</button>
          </div>
        </div>
      </div>

      {/* ── View Work Report Modal ────────────────────────────── */}
      {selectedReport && (
        <Modal
          onClose={() => setSelectedReport(null)}
          title={`My Work Report: ${selectedReport.title}`}
        >
          <div className="cha-modal">
            <div className="cha-modal__meta">
              <div><strong>Submitted:</strong> {new Date(selectedReport.submittedAt).toLocaleString("en-IN")}</div>
              <div><strong>Period:</strong> {selectedReport.periodLabel || selectedReport.reportType}</div>
              <div>
                <strong>Status:</strong>{" "}
                <span className={`cha-tag cha-tag--${selectedReport.status}`}>
                  {selectedReport.status === "pending" ? "Pending Head Review" : "✓ Verified by Head"}
                </span>
              </div>
            </div>

            <div className="cha-modal__body">
              <h5>Report Body / Shared Summary:</h5>
              <div className="cha-modal__content-box">{selectedReport.body}</div>
            </div>

            {selectedReport.headNotes && (
              <div className="cha-modal__notes">
                <strong>Head Verification Notes:</strong>
                <p>{selectedReport.headNotes}</p>
                <span>— Verified by {selectedReport.verifiedBy}</span>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}

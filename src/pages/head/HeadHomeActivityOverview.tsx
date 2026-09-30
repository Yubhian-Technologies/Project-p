import { useEffect, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { listPendingTransferRequestsForCampus } from "../../services/firebase/bookings";
import { Button } from "../../components/common/Button";
import {
  ClipboardListIcon,
  RefreshIcon,
  BellIcon,
  CalendarIcon,
  FolderOpenIcon,
  AlertTriangleIcon,
  UsersIcon,
  HelpCircleIcon,
  MessageCircleIcon,
} from "../../components/common/icons";
import "./HeadHomeActivityOverview.css";

interface HeadHomeActivityOverviewProps {
  onSelectSection: (sectionId: string) => void;
}

export function HeadHomeActivityOverview({ onSelectSection }: HeadHomeActivityOverviewProps) {
  const { profile } = useAuth();
  const [transferCount, setTransferCount] = useState(0);

  async function loadData() {
    if (!profile?.campusId) return;
    try {
      const transfers = await listPendingTransferRequestsForCampus(profile.campusId);
      setTransferCount(transfers.length);
    } catch (err) {
      console.error("Failed to load activity feed", err);
    }
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.campusId]);

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
            Real-time updates on transfer requests and department alerts.
          </p>
        </div>
        <Button type="button" variant="outlined" onClick={loadData}>
          <RefreshIcon /> Refresh Activity
        </Button>
      </div>

      <div className="hha-card">
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

          {/* Consolidated Reports */}
          <div className="hha-status-item">
            <div className="hha-status-item__left">
              <span className="hha-status-icon"><FolderOpenIcon /></span>
              <div>
                <strong>Consolidated Reports</strong>
                <p>Department report status</p>
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
  );
}

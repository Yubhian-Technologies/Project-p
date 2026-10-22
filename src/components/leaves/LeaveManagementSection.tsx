import { useEffect, useState, useMemo } from "react";
import { useAuth } from "../../hooks/useAuth";
import { Button } from "../common/Button";
import { ApplyLeaveModal } from "./ApplyLeaveModal";
import { LeaveDetailsModal } from "./LeaveDetailsModal";
import {
  subscribeLeavesByApplicant,
  subscribeLeavesForCampus,
  cancelLeave,
  formatLeaveRange,
  getTodayDateString,
  isLeaveActiveOnDate,
} from "../../services/firebase/leaves";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../services/firebase/config";
import type { LeaveRequest } from "../../types/leave";
import "./LeaveManagementSection.css";

interface LeaveManagementSectionProps {
  isHeadView?: boolean;
}

export function LeaveManagementSection({ isHeadView = false }: LeaveManagementSectionProps) {
  const { profile } = useAuth();
  const [myLeaves, setMyLeaves] = useState<LeaveRequest[]>([]);
  const [teamLeaves, setTeamLeaves] = useState<LeaveRequest[]>([]);
  const [activeTab, setActiveTab] = useState<"my-leaves" | "team-leaves">("my-leaves");
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
  const [selectedLeave, setSelectedLeave] = useState<LeaveRequest | null>(null);
  const [collegeName, setCollegeName] = useState<string>("");
  const [campusName, setCampusName] = useState<string>("");
  const [cancellingLeaveId, setCancellingLeaveId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const today = getTodayDateString();

  // Load college and campus names for display
  useEffect(() => {
    async function loadMeta() {
      if (profile?.campusId) {
        try {
          const snap = await getDoc(doc(db, "campuses", profile.campusId));
          if (snap.exists()) setCampusName((snap.data() as { name?: string }).name || "");
        } catch {
          // ignore
        }
      }
      if (profile?.collegeId) {
        try {
          const snap = await getDoc(doc(db, "colleges", profile.collegeId));
          if (snap.exists()) setCollegeName((snap.data() as { name?: string }).name || "");
        } catch {
          // ignore
        }
      }
    }
    loadMeta();
  }, [profile?.campusId, profile?.collegeId]);

  // Subscribe to own leaves
  useEffect(() => {
    if (!profile?.uid) return;
    const unsubscribe = subscribeLeavesByApplicant(profile.uid, (data) => {
      setMyLeaves(data);
    });
    return () => unsubscribe();
  }, [profile?.uid]);

  // If Head, also subscribe to all campus leaves
  useEffect(() => {
    if (!isHeadView || !profile?.campusId) return;
    const unsubscribe = subscribeLeavesForCampus(profile.campusId, (data) => {
      setTeamLeaves(data);
    });
    return () => unsubscribe();
  }, [isHeadView, profile?.campusId]);

  const displayedLeaves = activeTab === "my-leaves" ? myLeaves : teamLeaves;

  const metrics = useMemo(() => {
    const list = myLeaves;
    const pending = list.filter((l) => l.status === "pending").length;
    const approved = list.filter((l) => l.status === "approved").length;
    const activeToday = list.filter((l) => isLeaveActiveOnDate(l, today)).length;
    return { pending, approved, activeToday, total: list.length };
  }, [myLeaves, today]);

  const handleCancelLeave = async (leave: LeaveRequest) => {
    const confirmMsg =
      leave.status === "approved"
        ? "This leave has already been approved by the Principal/Vice-Principal. Are you sure you want to cancel it?"
        : "Are you sure you want to cancel this pending leave request?";

    if (!window.confirm(confirmMsg)) return;

    setActionError(null);
    setCancellingLeaveId(leave.id);
    try {
      if (!profile?.uid) return;
      await cancelLeave(leave.id, profile.uid, "Cancelled by applicant");
      setSelectedLeave(null);
    } catch (err) {
      console.error("Failed to cancel leave:", err);
      setActionError("Failed to cancel leave. Please try again.");
    } finally {
      setCancellingLeaveId(null);
    }
  };

  const getStatusBadge = (leave: LeaveRequest) => {
    switch (leave.status) {
      case "approved": {
        const roleLabel =
          leave.reviewedByRole === "vice-principal"
            ? "VP"
            : leave.reviewedByRole === "principal"
            ? "Principal"
            : leave.reviewedByRole || "Authority";
        return (
          <div className="leave-badge leave-badge--approved" title={`Approved by ${leave.reviewedByName} (${roleLabel})`}>
            <span className="leave-badge__dot" />
            <span>Approved by {roleLabel}</span>
          </div>
        );
      }
      case "pending":
        return (
          <div className="leave-badge leave-badge--pending">
            <span className="leave-badge__dot" />
            <span>Pending Review</span>
          </div>
        );
      case "disapproved":
        return (
          <div className="leave-badge leave-badge--disapproved">
            <span className="leave-badge__dot" />
            <span>Disapproved</span>
          </div>
        );
      case "cancelled":
        return (
          <div className="leave-badge leave-badge--cancelled">
            <span className="leave-badge__dot" />
            <span>Cancelled</span>
          </div>
        );
    }
  };

  return (
    <div className="leave-section">
      <div className="leave-section__header">
        <div>
          <h2 className="leave-section__title">Leave Management</h2>
          <p className="leave-section__subtitle">
            Apply for leave and track approvals from your college Principal and Vice-Principal.
          </p>
        </div>
        <Button
          variant="filled"
          onClick={() => setIsApplyModalOpen(true)}
          className="leave-section__apply-btn"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Apply for Leave
        </Button>
      </div>

      {actionError && <div className="leave-section__error">{actionError}</div>}

      {/* Metric Cards */}
      <div className="leave-metrics-grid">
        <div className="leave-metric-card">
          <span className="leave-metric-card__label">Active Leave Today</span>
          <span className={`leave-metric-card__value ${metrics.activeToday > 0 ? "is-active" : ""}`}>
            {metrics.activeToday > 0 ? "On Leave" : "Available"}
          </span>
          <span className="leave-metric-card__hint">
            {metrics.activeToday > 0 ? "Profile badge is active" : "Normal booking status"}
          </span>
        </div>

        <div className="leave-metric-card">
          <span className="leave-metric-card__label">Pending Approvals</span>
          <span className="leave-metric-card__value leave-metric-card__value--pending">
            {metrics.pending}
          </span>
          <span className="leave-metric-card__hint">Awaiting Principal / VP</span>
        </div>

        <div className="leave-metric-card">
          <span className="leave-metric-card__label">Approved Leaves</span>
          <span className="leave-metric-card__value leave-metric-card__value--approved">
            {metrics.approved}
          </span>
          <span className="leave-metric-card__hint">Granted by Principal / VP</span>
        </div>

        <div className="leave-metric-card">
          <span className="leave-metric-card__label">Total Applications</span>
          <span className="leave-metric-card__value">{metrics.total}</span>
          <span className="leave-metric-card__hint">All applications history</span>
        </div>
      </div>

      {/* Head Tabs */}
      {isHeadView && (
        <div className="leave-tabs">
          <button
            type="button"
            className={`leave-tab ${activeTab === "my-leaves" ? "is-active" : ""}`}
            onClick={() => setActiveTab("my-leaves")}
          >
            My Leaves ({myLeaves.length})
          </button>
          <button
            type="button"
            className={`leave-tab ${activeTab === "team-leaves" ? "is-active" : ""}`}
            onClick={() => setActiveTab("team-leaves")}
          >
            Team Leaves Overview ({teamLeaves.length})
          </button>
        </div>
      )}

      {/* Leaves List */}
      <div className="leave-list-container">
        <div className="leave-list-header">
          <h3>{activeTab === "my-leaves" ? "My Leave Applications" : "Campus Team Leaves"}</h3>
          <span className="leave-list-count">{displayedLeaves.length} records</span>
        </div>

        {displayedLeaves.length === 0 ? (
          <div className="leave-empty-state">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            <h4>No leave records found</h4>
            <p>
              {activeTab === "my-leaves"
                ? "You haven't submitted any leave applications yet. Click 'Apply for Leave' above when you need time off."
                : "No counsellors in your campus have applied for leave yet."}
            </p>
          </div>
        ) : (
          <div className="leave-cards-grid">
            {displayedLeaves.map((leave) => {
              const isActiveToday = isLeaveActiveOnDate(leave, today);
              const canCancel =
                activeTab === "my-leaves" &&
                (leave.status === "pending" || leave.status === "approved");

              return (
                <div
                  key={leave.id}
                  className={`leave-card ${isActiveToday ? "leave-card--active-today" : ""}`}
                >
                  <div className="leave-card__header">
                    <div className="leave-card__meta">
                      {activeTab === "team-leaves" && (
                        <div className="leave-card__applicant">
                          <strong>{leave.applicantName}</strong>
                          <span>
                            {leave.applicantRole === "head" ? "Head" : "Counsellor"} •{" "}
                            {leave.collegeName || "Campus College"}
                          </span>
                        </div>
                      )}
                      <div className="leave-card__type">
                        <span className="leave-type-pill">{leave.type.toUpperCase()} LEAVE</span>
                        {isActiveToday && (
                          <span className="leave-active-today-pill">Active Today</span>
                        )}
                      </div>
                    </div>
                    {getStatusBadge(leave)}
                  </div>

                  <div className="leave-card__body">
                    <div className="leave-card__detail-row">
                      <span className="leave-card__detail-label">Dates:</span>
                      <strong className="leave-card__detail-value">
                        {formatLeaveRange(leave)}
                      </strong>
                    </div>
                  </div>

                  <div className="leave-card__footer">
                    <button
                      type="button"
                      className="leave-view-btn"
                      onClick={() => setSelectedLeave(leave)}
                    >
                      View Details →
                    </button>
                    {canCancel && (
                      <button
                        type="button"
                        className="leave-cancel-btn"
                        disabled={cancellingLeaveId === leave.id}
                        onClick={() => handleCancelLeave(leave)}
                      >
                        {cancellingLeaveId === leave.id ? "Cancelling..." : "Cancel"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <ApplyLeaveModal
        isOpen={isApplyModalOpen}
        onClose={() => setIsApplyModalOpen(false)}
        collegeName={collegeName}
        campusName={campusName}
      />

      <LeaveDetailsModal
        leave={selectedLeave}
        isOpen={Boolean(selectedLeave)}
        onClose={() => setSelectedLeave(null)}
        canCancel={Boolean(
          selectedLeave &&
            activeTab === "my-leaves" &&
            (selectedLeave.status === "pending" || selectedLeave.status === "approved")
        )}
        onCancelLeave={handleCancelLeave}
        cancelling={Boolean(selectedLeave && cancellingLeaveId === selectedLeave.id)}
      />
    </div>
  );
}

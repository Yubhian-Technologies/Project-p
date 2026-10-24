import { useEffect, useState, useMemo } from "react";
import { useAuth } from "../../hooks/useAuth";
import {
  subscribeLeavesForColleges,
  approveLeave,
  disapproveLeave,
  formatLeaveRange,
  getTodayDateString,
  isLeaveActiveOnDate,
} from "../../services/firebase/leaves";
import { LeaveDetailsModal } from "./LeaveDetailsModal";
import type { LeaveRequest } from "../../types/leave";
import { Clock, CheckCircle2, XCircle, Ban } from "lucide-react";
import "./PrincipalLeaveApprovalSection.css";

export function PrincipalLeaveApprovalSection() {
  const { profile } = useAuth();
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [activeTab, setActiveTab] = useState<"pending" | "approved" | "disapproved" | "all">("pending");
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [selectedLeave, setSelectedLeave] = useState<LeaveRequest | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const today = getTodayDateString();
  const isPrincipalOrVp =
    profile?.role === "admin" &&
    profile.adminAccess?.scope === "campuses" &&
    (profile.adminAccess.designation === "principal" ||
      profile.adminAccess.designation === "vice-principal");

  const reviewerDesignation = useMemo(() => {
    return profile?.adminAccess?.designation === "vice-principal"
      ? "vice-principal" as const
      : "principal" as const;
  }, [profile]);

  const collegeIds = useMemo(() => {
    return profile?.adminAccess?.collegeIds ?? [];
  }, [profile]);

  useEffect(() => {
    if (!isPrincipalOrVp || collegeIds.length === 0) return;

    return subscribeLeavesForColleges(collegeIds, setLeaves);
  }, [isPrincipalOrVp, collegeIds]);

  const filteredLeaves = useMemo(() => {
    switch (activeTab) {
      case "pending":
        return leaves.filter((l) => l.status === "pending");
      case "approved":
        return leaves.filter((l) => l.status === "approved");
      case "disapproved":
        return leaves.filter((l) => l.status === "disapproved");
      case "all":
        return leaves;
    }
  }, [leaves, activeTab]);

  const metrics = useMemo(() => {
    const pending = leaves.filter((l) => l.status === "pending").length;
    const approved = leaves.filter((l) => l.status === "approved").length;
    const onLeaveToday = leaves.filter((l) => isLeaveActiveOnDate(l, today)).length;
    return { pending, approved, onLeaveToday, total: leaves.length };
  }, [leaves, today]);

  const handleApprove = async (leave: LeaveRequest) => {
    if (!profile) return;
    setActionError(null);
    setProcessingId(leave.id);

    try {
      const reviewerName = profile.displayName || profile.email;
      await approveLeave(
        leave.id,
        {
          uid: profile.uid,
          name: reviewerName,
          role: reviewerDesignation,
        },
        "Approved",
      );
    } catch (err) {
      console.error("Failed to approve leave:", err);
      setActionError("Failed to approve leave. Please try again.");
    } finally {
      setProcessingId(null);
    }
  };

  const handleConfirmDisapprove = async (leave: LeaveRequest, remarks: string) => {
    if (!profile) return;
    setActionError(null);
    setProcessingId(leave.id);

    try {
      const reviewerName = profile.displayName || profile.email;
      await disapproveLeave(
        leave.id,
        {
          uid: profile.uid,
          name: reviewerName,
          role: reviewerDesignation,
        },
        remarks.trim() || "Disapproved by college administration",
      );
      setSelectedLeave(null);
    } catch (err) {
      console.error("Failed to disapprove leave:", err);
      setActionError("Failed to disapprove leave. Please try again.");
    } finally {
      setProcessingId(null);
    }
  };

  if (!isPrincipalOrVp) return null;

  if (collegeIds.length === 0) {
    return (
      <div className="principal-leave-section">
        <div className="principal-leave-error" role="alert">
          Leave approvals are unavailable because no college is assigned to this account. Please contact the platform administrator.
        </div>
      </div>
    );
  }

  return (
    <div className="principal-leave-section">
      <div className="principal-leave-header">
        <div>
          <h2 className="principal-leave-title">Leave Approvals</h2>
          <p className="principal-leave-subtitle">
            Review and grant leave applications for your college's Counsellors and Wellness Heads.
          </p>
        </div>
      </div>

      {actionError && <div className="principal-leave-error">{actionError}</div>}

      {/* KPI Tiles */}
      <div className="principal-leave-metrics">
        <div className="principal-leave-kpi principal-leave-kpi--pending">
          <span className="principal-leave-kpi__label">Pending Action</span>
          <span className="principal-leave-kpi__value">{metrics.pending}</span>
          <span className="principal-leave-kpi__hint">Awaiting your approval</span>
        </div>

        <div className="principal-leave-kpi principal-leave-kpi--today">
          <span className="principal-leave-kpi__label">On Leave Today</span>
          <span className="principal-leave-kpi__value">{metrics.onLeaveToday}</span>
          <span className="principal-leave-kpi__hint">Staff currently away</span>
        </div>

        <div className="principal-leave-kpi principal-leave-kpi--approved">
          <span className="principal-leave-kpi__label">Approved Total</span>
          <span className="principal-leave-kpi__value">{metrics.approved}</span>
          <span className="principal-leave-kpi__hint">Active or past approvals</span>
        </div>

        <div className="principal-leave-kpi">
          <span className="principal-leave-kpi__label">All Requests</span>
          <span className="principal-leave-kpi__value">{metrics.total}</span>
          <span className="principal-leave-kpi__hint">Total recorded history</span>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="principal-leave-tabs">
        <button
          type="button"
          className={`principal-leave-tab ${activeTab === "pending" ? "is-active" : ""}`}
          onClick={() => setActiveTab("pending")}
        >
          Pending Review ({metrics.pending})
        </button>
        <button
          type="button"
          className={`principal-leave-tab ${activeTab === "approved" ? "is-active" : ""}`}
          onClick={() => setActiveTab("approved")}
        >
          Approved Leaves ({metrics.approved})
        </button>
        <button
          type="button"
          className={`principal-leave-tab ${activeTab === "disapproved" ? "is-active" : ""}`}
          onClick={() => setActiveTab("disapproved")}
        >
          Disapproved
        </button>
        <button
          type="button"
          className={`principal-leave-tab ${activeTab === "all" ? "is-active" : ""}`}
          onClick={() => setActiveTab("all")}
        >
          All History ({metrics.total})
        </button>
      </div>

      {/* List */}
      <div className="principal-leave-list">
        {filteredLeaves.length === 0 ? (
          <div className="principal-leave-empty">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            <h4>No {activeTab} leave applications</h4>
            <p>
              {activeTab === "pending"
                ? "All leave requests have been reviewed. There are no pending applications awaiting your decision."
                : "No applications found matching this filter."}
            </p>
          </div>
        ) : (
          <div className="principal-leave-cards">
            {filteredLeaves.map((leave) => {
              const isToday = isLeaveActiveOnDate(leave, today);
              const isPending = leave.status === "pending";

              return (
                <div
                  key={leave.id}
                  className={`principal-leave-card ${isToday ? "is-active-today" : ""}`}
                >
                  <div className="principal-leave-card__header">
                    <div className="principal-leave-card__profile">
                      <div className="principal-leave-card__avatar">
                        {leave.applicantPhotoURL ? (
                          <img src={leave.applicantPhotoURL} alt={leave.applicantName} />
                        ) : (
                          <span>{leave.applicantName.charAt(0).toUpperCase()}</span>
                        )}
                      </div>
                      <div>
                        <strong className="principal-leave-card__name">{leave.applicantName}</strong>
                        <span className="principal-leave-card__role">
                          {leave.applicantRole === "head" ? "Campus Head" : "Wellness Counsellor"} •{" "}
                          {leave.collegeName || "Assigned College"}
                        </span>
                      </div>
                    </div>

                    <div className="principal-leave-card__status-wrapper">
                      <span className="principal-leave-type-pill">
                        {leave.type.toUpperCase()}
                      </span>
                      {leave.status === "approved" && (
                        <span className="principal-leave-pill principal-leave-pill--approved">
                          <CheckCircle2 size={13} />
                          <span>Approved</span>
                        </span>
                      )}
                      {leave.status === "pending" && (
                        <span className="principal-leave-pill principal-leave-pill--pending">
                          <Clock size={13} />
                          <span>Awaiting Decision</span>
                        </span>
                      )}
                      {leave.status === "disapproved" && (
                        <span className="principal-leave-pill principal-leave-pill--disapproved">
                          <XCircle size={13} />
                          <span>Disapproved</span>
                        </span>
                      )}
                      {leave.status === "cancelled" && (
                        <span className="principal-leave-pill principal-leave-pill--cancelled">
                          <Ban size={13} />
                          <span>Cancelled</span>
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="principal-leave-card__body">
                    <div className="principal-leave-card__row">
                      <span className="principal-leave-label">Leave Duration:</span>
                      <strong>{formatLeaveRange(leave)}</strong>
                      {isToday && (
                        <span className="principal-leave-today-badge">Active Today</span>
                      )}
                    </div>
                  </div>

                  <div className="principal-leave-card__actions">
                    <button
                      type="button"
                      className="btn-principal-view"
                      onClick={() => setSelectedLeave(leave)}
                    >
                      {isPending ? "View Details & Decide →" : "View Details →"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <LeaveDetailsModal
        leave={selectedLeave}
        isOpen={Boolean(selectedLeave)}
        onClose={() => setSelectedLeave(null)}
        canReview={selectedLeave?.status === "pending"}
        onApprove={async (l) => {
          await handleApprove(l);
          setSelectedLeave(null);
        }}
        onDisapprove={handleConfirmDisapprove}
        approving={processingId === selectedLeave?.id}
        disapproving={processingId === selectedLeave?.id}
      />
    </div>
  );
}

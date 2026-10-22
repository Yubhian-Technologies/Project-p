import { useState } from "react";
import { Modal } from "../common/Modal";
import { Button } from "../common/Button";
import { formatLeaveRange } from "../../services/firebase/leaves";
import type { LeaveRequest } from "../../types/leave";
import {
  Clock,
  CheckCircle2,
  XCircle,
  Ban,
  Calendar,
  Check,
  X,
} from "lucide-react";
import "./LeaveDetailsModal.css";

interface LeaveDetailsModalProps {
  leave: LeaveRequest | null;
  isOpen: boolean;
  onClose: () => void;
  // Applicant actions
  canCancel?: boolean;
  onCancelLeave?: (leave: LeaveRequest) => void;
  cancelling?: boolean;
  // Principal / Vice-Principal review actions
  canReview?: boolean;
  onApprove?: (leave: LeaveRequest) => void;
  onDisapprove?: (leave: LeaveRequest, remarks: string) => void;
  approving?: boolean;
  disapproving?: boolean;
}

export function LeaveDetailsModal({
  leave,
  isOpen,
  onClose,
  canCancel = false,
  onCancelLeave,
  cancelling = false,
  canReview = false,
  onApprove,
  onDisapprove,
  approving = false,
  disapproving = false,
}: LeaveDetailsModalProps) {
  const [showDisapproveInput, setShowDisapproveInput] = useState(false);
  const [remarks, setRemarks] = useState("");
  const [remarksError, setRemarksError] = useState("");

  if (!isOpen || !leave) return null;

  const handleDisapproveSubmit = () => {
    if (!remarks.trim()) {
      setRemarksError("Please provide a reason or remarks for disapproval.");
      return;
    }
    setRemarksError("");
    onDisapprove?.(leave, remarks.trim());
  };

  const getStatusBadge = () => {
    switch (leave.status) {
      case "approved": {
        const roleLabel =
          leave.reviewedByRole === "vice-principal"
            ? "Vice-Principal"
            : leave.reviewedByRole === "principal"
            ? "Principal"
            : leave.reviewedByRole || "College Authority";
        return (
          <div className="leave-details-status leave-details-status--approved">
            <span className="leave-details-status__icon">
              <CheckCircle2 size={20} />
            </span>
            <div>
              <strong>Approved</strong>
              <p>Approved by {leave.reviewedByName || "College Authority"} ({roleLabel})</p>
            </div>
          </div>
        );
      }
      case "pending":
        return (
          <div className="leave-details-status leave-details-status--pending">
            <span className="leave-details-status__icon">
              <Clock size={20} />
            </span>
            <div>
              <strong>Pending Review</strong>
              <p>Awaiting review and decision</p>
            </div>
          </div>
        );
      case "disapproved": {
        const roleLabel =
          leave.reviewedByRole === "vice-principal"
            ? "Vice-Principal"
            : leave.reviewedByRole === "principal"
            ? "Principal"
            : leave.reviewedByRole || "College Authority";
        return (
          <div className="leave-details-status leave-details-status--disapproved">
            <span className="leave-details-status__icon">
              <XCircle size={20} />
            </span>
            <div>
              <strong>Disapproved</strong>
              <p>Disapproved by {leave.reviewedByName || "College Authority"} ({roleLabel})</p>
            </div>
          </div>
        );
      }
      case "cancelled":
        return (
          <div className="leave-details-status leave-details-status--cancelled">
            <span className="leave-details-status__icon">
              <Ban size={20} />
            </span>
            <div>
              <strong>Cancelled</strong>
              <p>Cancelled by applicant</p>
            </div>
          </div>
        );
    }
  };

  const durationLabel =
    leave.duration === "full_day"
      ? "Full Day"
      : leave.duration === "half_day_morning"
      ? "Half Day (Morning)"
      : "Half Day (Afternoon)";

  return (
    <Modal title="Leave Application Details" onClose={onClose} className="leave-details-modal">
      <div className="leave-details-content">
        {getStatusBadge()}

        {/* Applicant Section */}
        <div className="leave-details-grid">
          <div className="leave-details-item">
            <span className="leave-details-label">Applicant</span>
            <div className="leave-details-value leave-details-applicant">
              {leave.applicantPhotoURL && (
                <img src={leave.applicantPhotoURL} alt={leave.applicantName} className="leave-details-avatar" />
              )}
              <div>
                <strong>{leave.applicantName}</strong>
                <span className="leave-details-role">
                  {leave.applicantRole === "head" ? "Campus Head" : "Wellness Counsellor"}
                </span>
              </div>
            </div>
          </div>

          <div className="leave-details-item">
            <span className="leave-details-label">Institution / College</span>
            <span className="leave-details-value">
              {leave.collegeName || "Assigned College"}
              {leave.campusName && <span className="leave-details-campus"> ({leave.campusName})</span>}
            </span>
          </div>

          <div className="leave-details-item">
            <span className="leave-details-label">Leave Type</span>
            <span className="leave-details-pill">{leave.type.toUpperCase()} LEAVE</span>
          </div>

          <div className="leave-details-item">
            <span className="leave-details-label">Duration Mode</span>
            <span className="leave-details-value">{durationLabel}</span>
          </div>

          <div className="leave-details-item leave-details-item--full">
            <span className="leave-details-label">Date Range</span>
            <div className="leave-details-dates">
              <Calendar size={18} className="leave-details-dates-icon" />
              <strong>{formatLeaveRange(leave)}</strong>
            </div>
          </div>

          <div className="leave-details-item leave-details-item--full">
            <span className="leave-details-label">Reason for Leave</span>
            <div className="leave-details-reason-box">
              <p>{leave.reason}</p>
            </div>
          </div>

          {/* Review Audit Trail */}
          {(leave.status === "approved" || leave.status === "disapproved") && leave.reviewedByName && (
            <div className="leave-details-item leave-details-item--full">
              <span className="leave-details-label">Decision Audit Trail</span>
              <div className="leave-details-audit-card">
                <div className="leave-details-audit-header">
                  <strong>
                    {leave.reviewedByName} (
                    {leave.reviewedByRole === "vice-principal"
                      ? "Vice-Principal"
                      : "Principal"}
                    )
                  </strong>
                  {leave.reviewedAt && (
                    <span className="leave-details-audit-time">
                      {new Date(leave.reviewedAt).toLocaleString()}
                    </span>
                  )}
                </div>
                {leave.reviewRemarks && (
                  <p className="leave-details-audit-remarks">
                    <strong>Remarks: </strong>"{leave.reviewRemarks}"
                  </p>
                )}
              </div>
            </div>
          )}

          {leave.status === "cancelled" && leave.cancelledAt && (
            <div className="leave-details-item leave-details-item--full">
              <span className="leave-details-label">Cancellation Details</span>
              <div className="leave-details-audit-card leave-details-audit-card--cancelled">
                <p>
                  Cancelled on {new Date(leave.cancelledAt).toLocaleString()}
                  {leave.cancellationReason && ` — Reason: ${leave.cancellationReason}`}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Principal / VP Review Actions */}
        {canReview && leave.status === "pending" && (
          <div className="leave-details-review-box">
            {!showDisapproveInput ? (
              <div className="leave-details-review-actions">
                <Button
                  type="button"
                  variant="primary"
                  disabled={approving || disapproving}
                  onClick={() => onApprove?.(leave)}
                  className="leave-approve-btn"
                >
                  <Check size={16} />
                  <span>{approving ? "Approving..." : "Approve Leave"}</span>
                </Button>
                <Button
                  type="button"
                  variant="outlined"
                  disabled={approving || disapproving}
                  onClick={() => setShowDisapproveInput(true)}
                  className="leave-disapprove-prompt-btn"
                >
                  <X size={16} />
                  <span>Disapprove</span>
                </Button>
              </div>
            ) : (
              <div className="leave-details-disapprove-form">
                <label htmlFor="leave-modal-remarks">Remarks / Reason for Disapproval:</label>
                <textarea
                  id="leave-modal-remarks"
                  rows={3}
                  value={remarks}
                  onChange={(e) => {
                    setRemarks(e.target.value);
                    if (remarksError) setRemarksError("");
                  }}
                  placeholder="Enter remarks explaining why this leave cannot be granted..."
                />
                {remarksError && <p className="leave-modal-error">{remarksError}</p>}
                <div className="leave-details-disapprove-actions">
                  <Button
                    type="button"
                    variant="outlined"
                    onClick={() => {
                      setShowDisapproveInput(false);
                      setRemarks("");
                      setRemarksError("");
                    }}
                  >
                    Back
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    disabled={disapproving}
                    onClick={handleDisapproveSubmit}
                    className="leave-disapprove-btn"
                  >
                    {disapproving ? "Submitting..." : "Confirm Disapproval"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Applicant Cancel Action */}
        {canCancel && (leave.status === "pending" || leave.status === "approved") && (
          <div className="leave-details-cancel-bar">
            <Button
              type="button"
              variant="outlined"
              disabled={cancelling}
              onClick={() => onCancelLeave?.(leave)}
              className="leave-modal-cancel-btn"
            >
              {cancelling ? "Cancelling..." : "Cancel This Leave Application"}
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}

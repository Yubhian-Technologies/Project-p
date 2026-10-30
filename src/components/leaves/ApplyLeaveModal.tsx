import { useState } from "react";
import { Modal } from "../common/Modal";
import { Button } from "../common/Button";
import { Select } from "../common/Select";
import { useAuth } from "../../hooks/useAuth";
import { applyLeave, getTodayDateString } from "../../services/firebase/leaves";
import type { LeaveDuration, LeaveType } from "../../types/leave";
import "./ApplyLeaveModal.css";

interface ApplyLeaveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  collegeName?: string;
  campusName?: string;
}

export function ApplyLeaveModal({
  isOpen,
  onClose,
  onSuccess,
  collegeName,
  campusName,
}: ApplyLeaveModalProps) {
  const { profile } = useAuth();
  const today = getTodayDateString();

  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [duration, setDuration] = useState<LeaveDuration>("full_day");
  const [type, setType] = useState<LeaveType>("casual");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    if (!startDate || !endDate) {
      setError("Please select both start and end dates.");
      return;
    }

    if (endDate < startDate) {
      setError("End date cannot be earlier than start date.");
      return;
    }

    if (!reason.trim() || reason.trim().length < 5) {
      setError("Please provide a brief reason for the leave (at least 5 characters).");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await applyLeave({
        applicantUid: profile.uid,
        applicantName: profile.displayName || profile.email || "Staff Member",
        applicantEmail: profile.email,
        applicantRole: profile.role === "head" ? "head" : "counsellor",
        applicantPhotoURL: profile.photoURL,
        campusId: profile.campusId || "",
        campusName: campusName || "",
        collegeId: profile.collegeId || "",
        collegeName: collegeName || "",
        startDate,
        endDate,
        duration,
        type,
        reason: reason.trim(),
      });

      // Reset form
      setReason("");
      onSuccess?.();
      onClose();
    } catch (err) {
      console.error("Failed to submit leave application:", err);
      setError("Failed to submit leave. Please check your network and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal onClose={onClose} title="Apply for Leave">
      <form onSubmit={handleSubmit} className="apply-leave-form">
        {error && <div className="apply-leave-form__error">{error}</div>}

        <div className="apply-leave-form__info-box">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
          <div>
            <strong>Principal & Vice-Principal Review:</strong>
            <p>
              Your leave request will be routed directly to your college Principal and Vice-Principal. Approval by either authority will approve your leave and update your availability status.
            </p>
          </div>
        </div>

        <div className="apply-leave-form__row">
          <div className="apply-leave-form__field">
            <label htmlFor="leave-start-date">Start Date</label>
            <input
              id="leave-start-date"
              type="date"
              value={startDate}
              min={today}
              onChange={(e) => {
                setStartDate(e.target.value);
                if (e.target.value > endDate) setEndDate(e.target.value);
              }}
              required
            />
          </div>

          <div className="apply-leave-form__field">
            <label htmlFor="leave-end-date">End Date</label>
            <input
              id="leave-end-date"
              type="date"
              value={endDate}
              min={startDate || today}
              onChange={(e) => setEndDate(e.target.value)}
              required
            />
          </div>
        </div>

        <div className="apply-leave-form__row">
          <div className="apply-leave-form__field">
            <label htmlFor="leave-duration">Duration</label>
            <Select
              id="leave-duration"
              value={duration}
              onChange={(v) => setDuration(v as LeaveDuration)}
            >
              <option value="full_day">Full Day</option>
              <option value="half_day_morning">Half Day (Morning Session)</option>
              <option value="half_day_afternoon">Half Day (Afternoon Session)</option>
            </Select>
          </div>

          <div className="apply-leave-form__field">
            <label htmlFor="leave-type">Leave Type</label>
            <Select
              id="leave-type"
              value={type}
              onChange={(v) => setType(v as LeaveType)}
            >
              <option value="casual">Casual Leave</option>
              <option value="sick">Sick / Medical Leave</option>
              <option value="personal">Personal Leave</option>
              <option value="emergency">Emergency Leave</option>
              <option value="duty">On-Duty / Official Work</option>
              <option value="other">Other</option>
            </Select>
          </div>
        </div>

        <div className="apply-leave-form__field">
          <label htmlFor="leave-reason">Reason for Leave</label>
          <textarea
            id="leave-reason"
            rows={3}
            placeholder="Please specify reason, any scheduled appointments handover, or notes..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required
          />
        </div>

        <div className="apply-leave-form__actions">
          <Button type="button" variant="outlined" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" variant="filled" disabled={submitting}>
            {submitting ? "Submitting..." : "Submit Leave Request"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

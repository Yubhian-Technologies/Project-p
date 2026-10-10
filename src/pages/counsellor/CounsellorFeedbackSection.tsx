import { useEffect, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { listFeedbackForCounsellor } from "../../services/firebase/feedback";
import type { SessionFeedback } from "../../types/feedback";
import { Card } from "../../components/common/Card";
import { Button } from "../../components/common/Button";
import { Modal } from "../../components/common/Modal";
import { StarRating } from "../../components/common/StarRating";
import { formatDateTimeDMY } from "../../utils/formatDate";
import "./CounsellorFeedbackSection.css";

export function CounsellorFeedbackSection() {
  const { profile } = useAuth();
  const [feedbackList, setFeedbackList] = useState<SessionFeedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFeedback, setSelectedFeedback] = useState<SessionFeedback | null>(null);

  useEffect(() => {
    if (!profile) return;
    listFeedbackForCounsellor(profile.uid)
      .then((list) => {
        setFeedbackList(list);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [profile]);

  if (loading) return <p className="counsellor-feedback__loading">Loading feedback…</p>;

  const average =
    feedbackList.length > 0
      ? feedbackList.reduce((sum, f) => sum + f.rating, 0) / feedbackList.length
      : 0;

  return (
    <div className="counsellor-feedback">
      <div className="counsellor-feedback__overview">
        <div className="counsellor-feedback__stat">
          {feedbackList.length > 0 ? (
            <StarRating value={average} size="large" count={feedbackList.length} />
          ) : (
            <span className="counsellor-feedback__stat-value">—</span>
          )}
          <span className="counsellor-feedback__stat-label">Overall rating</span>
        </div>
        <div className="counsellor-feedback__stat">
          <span className="counsellor-feedback__stat-value">{feedbackList.length}</span>
          <span className="counsellor-feedback__stat-label">Feedback received</span>
        </div>
      </div>

      {feedbackList.length === 0 && <p>No session feedback yet.</p>}

      <div className="counsellor-feedback__list">
        {feedbackList.map((feedback) => (
          <Card key={feedback.bookingId} className="counsellor-feedback__row">
            <div className="counsellor-feedback__head">
              <div>
                <p className="counsellor-feedback__student">
                  {feedback.userEmail || "Student"}
                </p>
                <p className="counsellor-feedback__date">
                  {formatDateTimeDMY(feedback.submittedAt)}
                </p>
              </div>
              <StarRating value={feedback.rating} size="large" />
            </div>

            <div className="counsellor-feedback__actions">
              <Button
                type="button"
                variant="outlined"
                onClick={() => setSelectedFeedback(feedback)}
              >
                See feedback for this user
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {selectedFeedback && (
        <Modal
          title="User Session Feedback"
          className="counsellor-feedback__modal"
          onClose={() => setSelectedFeedback(null)}
        >
          <div className="counsellor-feedback__detail-card">
            <div className="counsellor-feedback__detail-header">
              <div>
                <h4 className="counsellor-feedback__detail-email">
                  {selectedFeedback.userEmail || "Student"}
                </h4>
                <p className="counsellor-feedback__detail-date">
                  {formatDateTimeDMY(selectedFeedback.submittedAt)}
                </p>
              </div>
              <div className="counsellor-feedback__detail-rating">
                <StarRating value={selectedFeedback.rating} size="large" />
              </div>
            </div>

            <div className="counsellor-feedback__question-list">
              {selectedFeedback.answers && selectedFeedback.answers.length > 0 ? (
                selectedFeedback.answers.map((answer, i) => (
                  <div key={i} className="counsellor-feedback__question-card">
                    <span className="counsellor-feedback__question-label">
                      {answer.label.toUpperCase()}
                    </span>
                    <span className="counsellor-feedback__question-value">
                      {answer.value}
                    </span>
                  </div>
                ))
              ) : (
                <div className="counsellor-feedback__question-card">
                  <span className="counsellor-feedback__question-label">OVERALL SESSION RATING</span>
                  <span className="counsellor-feedback__question-value">{selectedFeedback.rating} / 5</span>
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
import { useEffect, useMemo, useState } from "react";
import { listBookableProfiles } from "../../services/firebase/bookings";
import { getAllFeedback, aggregateAllCounsellorFeedback } from "../../services/firebase/feedback";
import type { CounsellorFeedbackAggregate } from "../../services/firebase/feedback";
import { listCampuses } from "../../services/firebase/campuses";
import type { Campus } from "../../types/campus";
import type { UserProfile } from "../../types/user";
import { formatDateDMY } from "../../utils/formatDate";
import { useViewMore } from "../../hooks/useViewMore";
import { Card } from "../../components/common/Card";
import { Select } from "../../components/common/Select";
import { Button } from "../../components/common/Button";
import { StarRating } from "../../components/common/StarRating";
import "./CounsellorRatingsSection.css";

const STARS = [5, 4, 3, 2, 1];

export function CounsellorRatingsSection() {
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [campusId, setCampusId] = useState("");
  const [counsellors, setCounsellors] = useState<UserProfile[]>([]);
  const [aggregates, setAggregates] = useState<CounsellorFeedbackAggregate[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedUid, setExpandedUid] = useState<string | null>(null);

  useEffect(() => {
    listCampuses().then(setCampuses);
  }, []);

  useEffect(() => {
    setLoading(true);
    async function load() {
      const [profiles, feedback] = await Promise.all([
        listBookableProfiles(),
        getAllFeedback(campusId || undefined),
      ]);
      setCounsellors(profiles.filter((p) => p.role === "counsellor"));
      setAggregates(aggregateAllCounsellorFeedback(feedback));
      setExpandedUid(null);
      setLoading(false);
    }
    load();
  }, [campusId]);

  const aggregateByCounsellor = useMemo(
    () => new Map(aggregates.map((a) => [a.counsellorId, a])),
    [aggregates],
  );

  const ranked = useMemo(
    () =>
      counsellors
        .map((profile) => ({ profile, aggregate: aggregateByCounsellor.get(profile.uid) ?? null }))
        .sort((a, b) => {
          const av = a.aggregate?.average ?? 0;
          const bv = b.aggregate?.average ?? 0;
          if (av !== bv) return bv - av;
          return (b.aggregate?.count ?? 0) - (a.aggregate?.count ?? 0);
        }),
    [counsellors, aggregateByCounsellor],
  );

  const { visible: visibleRanked, hiddenCount, showMore } = useViewMore(ranked, 7);

  const totalFeedback = aggregates.reduce((sum, a) => sum + a.count, 0);
  const overallAverage =
    totalFeedback > 0
      ? aggregates.reduce((sum, a) => sum + a.average * a.count, 0) / totalFeedback
      : 0;

  if (loading) return <p className="counsellor-ratings__loading">Loading ratings…</p>;

  return (
    <div className="counsellor-ratings">
      <div className="counsellor-ratings__field">
        <label htmlFor="counsellor-ratings-campus">Campus</label>
        <Select id="counsellor-ratings-campus" value={campusId} onChange={setCampusId}>
          <option value="">All campuses</option>
          {campuses.map((campus) => (
            <option key={campus.id} value={campus.id}>
              {campus.name}
            </option>
          ))}
        </Select>
      </div>

      <div className="counsellor-ratings__overview">
        <div className="counsellor-ratings__stat">
          {totalFeedback > 0 ? (
            <StarRating value={overallAverage} size="large" count={totalFeedback} />
          ) : (
            <span className="counsellor-ratings__stat-value">—</span>
          )}
          <span className="counsellor-ratings__stat-label">Overall counsellor rating</span>
        </div>
        <div className="counsellor-ratings__stat">
          <span className="counsellor-ratings__stat-value">{ranked.length}</span>
          <span className="counsellor-ratings__stat-label">Counsellors</span>
        </div>
        <div className="counsellor-ratings__stat">
          <span className="counsellor-ratings__stat-value">{totalFeedback}</span>
          <span className="counsellor-ratings__stat-label">Feedback received</span>
        </div>
      </div>

      <div className="counsellor-ratings__list">
        {ranked.length === 0 && <p>No counsellors are set up yet.</p>}
        {visibleRanked.map(({ profile, aggregate }) => (
          <CounsellorRatingRow
            key={profile.uid}
            profile={profile}
            aggregate={aggregate}
            expanded={expandedUid === profile.uid}
            onToggle={() => setExpandedUid(expandedUid === profile.uid ? null : profile.uid)}
          />
        ))}
        {hiddenCount > 0 && (
          <Button type="button" variant="outlined" style={{ alignSelf: "center" }} onClick={showMore}>
            View More ({hiddenCount} more)
          </Button>
        )}
      </div>
    </div>
  );
}

interface CounsellorRatingRowProps {
  profile: UserProfile;
  aggregate: CounsellorFeedbackAggregate | null;
  expanded: boolean;
  onToggle: () => void;
}

function CounsellorRatingRow({ profile, aggregate, expanded, onToggle }: CounsellorRatingRowProps) {
  const { visible: visibleFeedback, hiddenCount, showMore } = useViewMore(aggregate?.feedback ?? [], 7);

  return (
    <Card className="counsellor-ratings__row" onClick={onToggle}>
      <div className="counsellor-ratings__row-head">
        <div>
          <p className="counsellor-ratings__name">{profile.displayName || profile.email}</p>
          <p className="counsellor-ratings__email">{profile.email}</p>
        </div>
        <div className="counsellor-ratings__row-rating">
          {aggregate ? (
            <StarRating value={aggregate.average} size="large" count={aggregate.count} />
          ) : (
            <span className="counsellor-ratings__no-rating">No feedback yet</span>
          )}
        </div>
      </div>

      {expanded && aggregate && (
        <div className="counsellor-ratings__detail">
          <div className="counsellor-ratings__distribution">
            {STARS.map((star) => {
              const count = aggregate.distribution[star - 1] ?? 0;
              const pct = aggregate.count > 0 ? (count / aggregate.count) * 100 : 0;
              return (
                <div key={star} className="counsellor-ratings__bar-row">
                  <span className="counsellor-ratings__bar-label">{star}★</span>
                  <div className="counsellor-ratings__bar-track">
                    <div className="counsellor-ratings__bar-fill" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="counsellor-ratings__bar-count">{count}</span>
                </div>
              );
            })}
          </div>

          {aggregate.perQuestion.length > 0 && (
            <div className="counsellor-ratings__question-averages">
              <p className="counsellor-ratings__reviews-heading">Question averages</p>
              {aggregate.perQuestion.map((q) => (
                <p key={q.label} className="counsellor-ratings__question-average">
                  {q.label}: <strong>{q.average.toFixed(1)}</strong>
                  <span className="counsellor-ratings__review-date"> ({q.count} response{q.count === 1 ? "" : "s"})</span>
                </p>
              ))}
            </div>
          )}

          <div className="counsellor-ratings__reviews">
            <p className="counsellor-ratings__reviews-heading">Feedback details</p>
            {visibleFeedback.map((feedback) => (
              <div key={feedback.bookingId} className="counsellor-ratings__review">
                <div className="counsellor-ratings__review-meta">
                  <StarRating value={feedback.rating} size="small" />
                  <span className="counsellor-ratings__review-user">
                    {feedback.userEmail || "Student"}
                  </span>
                  <span className="counsellor-ratings__review-date">
                    {formatDateDMY(feedback.submittedAt)}
                  </span>
                </div>
                {feedback.answers && feedback.answers.length > 0 ? (
                  <ul className="counsellor-ratings__review-answers">
                    {feedback.answers.map((answer, i) => (
                      <li key={i}>
                        <span className="counsellor-ratings__answer-label">{answer.label}:</span>{" "}
                        {answer.value}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="counsellor-ratings__review-empty">No additional answers.</p>
                )}
              </div>
            ))}
            {hiddenCount > 0 && (
              <Button
                type="button"
                variant="outlined"
                style={{ alignSelf: "center" }}
                onClick={(e) => {
                  e.stopPropagation();
                  showMore();
                }}
              >
                View More ({hiddenCount} more)
              </Button>
            )}
          </div>
        </div>
      )}

      {expanded && !aggregate && (
        <div className="counsellor-ratings__detail">
          <p className="counsellor-ratings__review-empty">
            This counsellor hasn't received any session feedback yet.
          </p>
        </div>
      )}
    </Card>
  );
}
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../../hooks/useAuth";
import { useAcademicYear } from "../../../hooks/useAcademicYear";
import { listCampuses } from "../../../services/firebase/campuses";
import { listSsiCollegeResultsForCampus, type SsiCollegeResult } from "../../../services/firebase/ssiCollegeResults";
import type { Campus } from "../../../types/campus";
import {
  SSI_ANALYTICS_PERIODS,
  ssiAnalyticsChipLabel,
  ssiAnalyticsPeriodLabel,
  filterSsiResultsByPeriod,
  computeSsiAnalyticsSummary,
  type SsiAnalyticsPeriod,
} from "../../../utils/ssiAnalytics";
import { Card } from "../../../components/common/Card";
import { Select } from "../../../components/common/Select";
import "../../../components/ssi/SsiCollegeResultsSection.css";
import "./AnalyticsSection.css";

/**
 * Admin's view of SSI check-ins — aggregate counts only, never the raw
 * per-student list/answers a Head/Counsellor sees in
 * SsiCollegeResultsSection.tsx. Same severity colors/period convention,
 * reused via ssiAnalytics.ts so "Today"/"This Week"/"This Month" mean the
 * same thing in both places.
 */
export function SsiAnalyticsSection() {
  const { profile } = useAuth();
  const { includes: inAcademicYear, selectedLabel: academicYearLabel } = useAcademicYear();
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [campusId, setCampusId] = useState(() =>
    profile?.role === "admin" && profile.adminAccess?.scope === "campuses" && profile.adminAccess.campusIds?.length === 1
      ? profile.adminAccess.campusIds[0]
      : "");
  const [allResults, setResults] = useState<SsiCollegeResult[]>([]);
  const [loadingResults, setLoadingResults] = useState(false);
  const [period, setPeriod] = useState<SsiAnalyticsPeriod>("all");
  const [now] = useState(() => new Date());

  const scopedCampusIds =
    profile?.role === "admin" && profile.adminAccess?.scope === "campuses"
      ? profile.adminAccess.campusIds ?? []
      : null;

  useEffect(() => {
    listCampuses().then((c) => {
      const visible = scopedCampusIds ? c.filter((campus) => scopedCampusIds.includes(campus.id)) : c;
      setCampuses(visible);
      // Admin assigned to a single campus has nothing to choose.
      if (scopedCampusIds && visible.length === 1) setCampusId(visible[0].id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!campusId) return;
    setLoadingResults(true);
    listSsiCollegeResultsForCampus(campusId)
      .then(setResults)
      .finally(() => setLoadingResults(false));
  }, [campusId]);

  // A college-restricted Admin only ever sees their own colleges, and every
  // admin sees just the academic year chosen in the header.
  const scopedCollegeIds =
    profile?.role === "admin" && profile.adminAccess?.scope === "campuses" && profile.adminAccess.collegeIds?.length
      ? profile.adminAccess.collegeIds
      : null;
  const results = useMemo(
    () =>
      allResults
        .filter((r) => !scopedCollegeIds || scopedCollegeIds.includes(r.collegeId))
        .filter((r) => inAcademicYear(r.submittedAt, r.campusId ?? campusId, r.collegeId)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allResults, inAcademicYear, academicYearLabel, campusId],
  );
  const filteredResults = useMemo(() => filterSsiResultsByPeriod(results, period, now), [results, period, now]);
  const summary = useMemo(() => computeSsiAnalyticsSummary(filteredResults), [filteredResults]);

  const hideCampusPicker = scopedCampusIds?.length === 1;

  return (
    <div className="ssi-results">
      {!hideCampusPicker && (
      <div className="analytics-section__field">
        <label htmlFor="ssi-analytics-campus">Campus</label>
        <Select id="ssi-analytics-campus" value={campusId} onChange={setCampusId}>
          <option value="" disabled>
            Select a campus…
          </option>
          {campuses.map((campus) => (
            <option key={campus.id} value={campus.id}>
              {campus.name}
            </option>
          ))}
        </Select>
      </div>
      )}

      {!campusId && scopedCampusIds?.length !== 1 && <p>Select a campus to view SSI check-in analytics.</p>}

      {campusId && !loadingResults && (
        <Card className="ssi-results__header-card">
          <div className="ssi-results__header-row">
            <div>
              <p className="ssi-results__subtitle">
                Aggregate counts only — student-level answers stay visible to that campus's own Head/Counsellors.
              </p>
            </div>
            <div className="ssi-results__period-chips" role="group" aria-label="Period">
              {SSI_ANALYTICS_PERIODS.map((p) => (
                <button
                  key={p}
                  type="button"
                  className={`ssi-results__chip${period === p ? " ssi-results__chip--active" : ""}`}
                  aria-pressed={period === p}
                  onClick={() => setPeriod(p)}
                >
                  {ssiAnalyticsChipLabel(p)}
                </button>
              ))}
            </div>
          </div>

          <p className="ssi-results__period-note">
            Showing results for <strong>{ssiAnalyticsPeriodLabel(period, now)}</strong>
          </p>

          <div className="ssi-results__summary">
            <div className="ssi-results__summary-card">
              <span className="ssi-results__summary-val">{summary.total}</span>
              <span className="ssi-results__summary-label">Took the test</span>
            </div>
            <div className="ssi-results__summary-card ssi-results__summary-card--normal">
              <span className="ssi-results__summary-val">{summary.normal}</span>
              <span className="ssi-results__summary-label">🟢 Normal</span>
            </div>
            <div className="ssi-results__summary-card ssi-results__summary-card--medium">
              <span className="ssi-results__summary-val">{summary.medium}</span>
              <span className="ssi-results__summary-label">🟡 Medium</span>
            </div>
            <div className="ssi-results__summary-card ssi-results__summary-card--severe">
              <span className="ssi-results__summary-val">{summary.severe}</span>
              <span className="ssi-results__summary-label">🔴 Severe — needs immediate action</span>
            </div>
            <div className="ssi-results__summary-card ssi-results__summary-card--action">
              <span className="ssi-results__summary-val">
                {summary.actionTaken} / {summary.actionNeeded}
              </span>
              <span className="ssi-results__summary-label">Action taken</span>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

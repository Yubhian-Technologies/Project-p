import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../../hooks/useAuth";
import { listCampuses } from "../../../services/firebase/campuses";
import { listSsiCollegeResultsForCampus, type SsiCollegeResult } from "../../../services/firebase/ssiCollegeResults";
import type { Campus } from "../../../types/campus";
import {
  SSI_ANALYTICS_PERIODS,
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
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [campusId, setCampusId] = useState("");
  const [results, setResults] = useState<SsiCollegeResult[]>([]);
  const [loadingResults, setLoadingResults] = useState(false);
  const [period, setPeriod] = useState<SsiAnalyticsPeriod>("all");
  const [now] = useState(() => new Date());

  const scopedCampusIds =
    profile?.role === "admin" && profile.adminAccess?.scope === "campuses"
      ? profile.adminAccess.campusIds ?? []
      : null;

  useEffect(() => {
    listCampuses().then((c) => setCampuses(scopedCampusIds ? c.filter((campus) => scopedCampusIds.includes(campus.id)) : c));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!campusId) return;
    setLoadingResults(true);
    listSsiCollegeResultsForCampus(campusId)
      .then(setResults)
      .finally(() => setLoadingResults(false));
  }, [campusId]);

  const filteredResults = useMemo(() => filterSsiResultsByPeriod(results, period, now), [results, period, now]);
  const summary = useMemo(() => computeSsiAnalyticsSummary(filteredResults), [filteredResults]);

  return (
    <div className="ssi-results">
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

      {!campusId && <p>Select a campus to view SSI check-in analytics.</p>}

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
                  {ssiAnalyticsPeriodLabel(p, now)}
                </button>
              ))}
            </div>
          </div>

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

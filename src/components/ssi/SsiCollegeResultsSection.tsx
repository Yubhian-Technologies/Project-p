import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { SSI_SEVERITY_LABELS, type SsiSeverity } from "../../config/ssiForm";
import {
  listSsiCollegeResultsForCollege,
  listSsiCollegeResultsForCampus,
  setSsiResultActionTaken,
  type SsiCollegeResult,
} from "../../services/firebase/ssiCollegeResults";
import { exportSsiResultsCsv } from "../../utils/exportSsiResultsCsv";
import { toIsoDate } from "../../utils/dateFormat";
import { formatDateDMY, formatDateTimeDMY, formatWeekdayDateDMY } from "../../utils/formatDate";
import {
  SSI_ANALYTICS_PERIODS,
  ssiAnalyticsPeriodLabel,
  filterSsiResultsByPeriod,
  computeSsiAnalyticsSummary,
  type SsiAnalyticsPeriod,
} from "../../utils/ssiAnalytics";
import { Card } from "../common/Card";
import { Button } from "../common/Button";
import { Modal } from "../common/Modal";
import { Select } from "../common/Select";
import "./SsiCollegeResultsSection.css";

const SEVERITY_RANK: Record<SsiSeverity, number> = { severe: 0, medium: 1, normal: 2 };

export function SsiCollegeResultsSection() {
  const { profile } = useAuth();
  const [results, setResults] = useState<SsiCollegeResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<SsiCollegeResult | null>(null);
  const [dateFilter, setDateFilter] = useState("");
  const [period, setPeriod] = useState<SsiAnalyticsPeriod>("all");
  const [savingAction, setSavingAction] = useState(false);
  const [now] = useState(() => new Date());

  // A Head oversees every college in their campus (same as everywhere else in
  // this app), so they get the campus-wide query; a Counsellor only ever sees
  // their own single college's submissions.
  const isHead = profile?.role === "head";

  useEffect(() => {
    const scopeId = isHead ? profile?.campusId : profile?.collegeId;
    if (!scopeId) {
      setLoading(false);
      return;
    }
    const fetchResults = isHead ? listSsiCollegeResultsForCampus(scopeId) : listSsiCollegeResultsForCollege(scopeId);
    fetchResults
      .then((list) => {
        const sorted = [...list].sort((a, b) => {
          const rankDiff = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
          return rankDiff !== 0 ? rankDiff : b.submittedAt - a.submittedAt;
        });
        setResults(sorted);
      })
      .finally(() => setLoading(false));
  }, [isHead, profile?.campusId, profile?.collegeId]);

  // Period (Today/Week/Month/All) narrows the pool first; the specific-date
  // dropdown below then lets a Head/Counsellor jump to one exact day within
  // that pool instead of scrolling the whole severity-sorted list.
  const periodResults = useMemo(() => filterSsiResultsByPeriod(results, period, now), [results, period, now]);

  const availableDates = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of periodResults) {
      const key = toIsoDate(new Date(r.submittedAt));
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([key, count]) => ({ key, count }));
  }, [periodResults]);

  // A stale date pick from a previous (now-narrower) period shouldn't silently
  // keep filtering against a date outside the current pool.
  useEffect(() => {
    if (dateFilter && !availableDates.some((d) => d.key === dateFilter)) setDateFilter("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableDates]);

  const filteredResults = dateFilter
    ? periodResults.filter((r) => toIsoDate(new Date(r.submittedAt)) === dateFilter)
    : periodResults;

  const summary = useMemo(() => computeSsiAnalyticsSummary(filteredResults), [filteredResults]);

  async function handleToggleAction(result: SsiCollegeResult) {
    if (!profile?.email) return;
    const nextActionTaken = !result.actionTaken;
    setSavingAction(true);
    try {
      await setSsiResultActionTaken(result.id, nextActionTaken, profile.email);
      const patch = { actionTaken: nextActionTaken, actionTakenBy: profile.email, actionTakenAt: Date.now() };
      setResults((prev) => prev.map((r) => (r.id === result.id ? { ...r, ...patch } : r)));
      setDetail((prev) => (prev && prev.id === result.id ? { ...prev, ...patch } : prev));
    } finally {
      setSavingAction(false);
    }
  }

  if (loading) return null;

  if (isHead ? !profile?.campusId : !profile?.collegeId) {
    return (
      <Card className="ssi-results__empty-card">
        <p>Your account has no {isHead ? "campus" : "college"} assigned — contact an admin to set this up.</p>
      </Card>
    );
  }

  return (
    <div className="ssi-results">
      <Card className="ssi-results__header-card">
        <div className="ssi-results__header-row">
          <div>
            <p className="ssi-results__subtitle">
              Standalone SSI check-ins submitted by students at your {isHead ? "campus" : "college"}, sorted by
              severity.
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

        <div className="ssi-results__header-row">
          <div className="ssi-results__header-actions">
            <Select
              id="ssi-results-date-filter"
              value={dateFilter}
              onChange={setDateFilter}
              disabled={availableDates.length === 0}
            >
              <option value="">All dates</option>
              {availableDates.map((d) => {
                // Parsed as local y/m/d, not via `new Date(isoString)` — that
                // reads "YYYY-MM-DD" as UTC midnight, which can display as
                // the previous day in timezones behind UTC.
                const [y, m, day] = d.key.split("-").map(Number);
                const label = formatWeekdayDateDMY(new Date(y, m - 1, day).getTime());
                return (
                  <option key={d.key} value={d.key}>
                    {label} · {d.count}
                  </option>
                );
              })}
            </Select>
            <Button
              type="button"
              variant="outlined"
              disabled={filteredResults.length === 0}
              onClick={() => exportSsiResultsCsv(filteredResults, dateFilter ? `ssi-test-results-${dateFilter}.csv` : undefined)}
            >
              Export to CSV
            </Button>
          </div>
        </div>
      </Card>

      {filteredResults.length === 0 && (
        <Card className="ssi-results__empty-card">
          <p>
            {results.length === 0
              ? `No SSI check-ins have been submitted by students at your ${isHead ? "campus" : "college"} yet.`
              : "No check-ins were submitted on this date."}
          </p>
        </Card>
      )}

      <div className="ssi-results__list">
        {filteredResults.map((r) => (
          <Card
            key={r.id}
            className={`ssi-results__row ssi-results__row--${r.severity}`}
            onClick={() => setDetail(r)}
          >
            <div className="ssi-results__row-main">
              <span className="ssi-results__row-name">{r.displayName || r.userEmail}</span>
              <span className="ssi-results__row-meta">
                {r.level1.department || "—"} · {r.level1.year || "—"} · {formatDateDMY(r.submittedAt)}
              </span>
            </div>
            <div className="ssi-results__row-badges">
              <span className={`ssi-results__badge ssi-results__badge--${r.severity}`}>
                {SSI_SEVERITY_LABELS[r.severity]}
              </span>
              {r.severity !== "normal" && r.actionTaken && (
                <span className="ssi-results__action-badge">✓ Action taken</span>
              )}
            </div>
          </Card>
        ))}
      </div>

      {detail && (
        <Modal title={detail.displayName || detail.userEmail} onClose={() => setDetail(null)} className="ssi-results__detail-modal">
          <div className="ssi-results__row-badges">
            <span className={`ssi-results__badge ssi-results__badge--${detail.severity}`}>
              {SSI_SEVERITY_LABELS[detail.severity]}
            </span>
            {detail.severity !== "normal" && detail.actionTaken && (
              <span className="ssi-results__action-badge">✓ Action taken</span>
            )}
          </div>

          {detail.severity !== "normal" && (
            <div className="ssi-results__action-row">
              <Button type="button" variant="outlined" disabled={savingAction} onClick={() => handleToggleAction(detail)}>
                {savingAction
                  ? "Saving…"
                  : detail.actionTaken
                    ? "Mark as not actioned"
                    : "Mark action taken"}
              </Button>
              {detail.actionTaken && detail.actionTakenBy && (
                <span className="ssi-results__action-note">
                  by {detail.actionTakenBy}
                  {detail.actionTakenAt ? ` · ${formatDateTimeDMY(detail.actionTakenAt)}` : ""}
                </span>
              )}
            </div>
          )}

          <div className="ssi-results__score">
            <span className="ssi-results__score-val">
              {detail.likertScore}
              <small> / {detail.likertMax}</small>
            </span>
          </div>

          <div className="ssi-results__subscales">
            {[
              { key: "D", label: "Depression", value: detail.depressionScore },
              { key: "A", label: "Anxiety", value: detail.anxietyScore },
              { key: "S", label: "Stress", value: detail.stressScore },
            ].map((s) => (
              <div key={s.key} className="ssi-results__subscale">
                <span className="ssi-results__subscale-key">{s.key}</span>
                <span className="ssi-results__subscale-name">{s.label}</span>
                <span className="ssi-results__subscale-val">
                  {s.value}
                  <small> / 21</small>
                </span>
              </div>
            ))}
          </div>

          <div className="ssi-results__section">
            <h4 className="ssi-results__heading">About the student</h4>
            <dl className="ssi-results__dl">
              <dt>Email</dt>
              <dd>{detail.userEmail}</dd>
              <dt>Department</dt>
              <dd>{detail.level1.department || "—"}</dd>
              <dt>Year</dt>
              <dd>{detail.level1.year || "—"}</dd>
              <dt>Hostel / Day Scholar</dt>
              <dd>{detail.level1.hostelOrDayScholar || "—"}</dd>
              <dt>Age</dt>
              <dd>{detail.level1.age || "—"}</dd>
              <dt>WhatsApp</dt>
              <dd>{detail.whatsappNumber || "—"}</dd>
              <dt>Submitted</dt>
              <dd>{formatDateTimeDMY(detail.submittedAt)}</dd>
            </dl>
          </div>

          <div className="ssi-results__section">
            <h4 className="ssi-results__heading">Assessment answers</h4>
            {detail.likertAnswers.map((a, i) => (
              <div key={a.id} className="ssi-results__row-answer">
                <span className="ssi-results__q">
                  {i + 1}. {a.label}
                </span>
                <span className={`ssi-results__a${a.value !== undefined && (a.value ?? 0) >= 2 ? " ssi-results__a--high" : ""}`}>
                  {a.answer}
                </span>
              </div>
            ))}
          </div>

          <div className="ssi-results__section">
            <h4 className="ssi-results__heading">Important questions</h4>
            {detail.level3Answers.map((a, i) => (
              <div key={a.id} className="ssi-results__row-answer">
                <span className="ssi-results__q">
                  {i + 1}. {a.label}
                </span>
                <span
                  className={`ssi-results__a${
                    a.id === "l3_q1" && (a.answer === "Yes" || a.answer === "Maybe") ? " ssi-results__a--high" : ""
                  }`}
                >
                  {a.answer || "—"}
                </span>
              </div>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}

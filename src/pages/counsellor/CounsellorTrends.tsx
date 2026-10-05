import { useEffect, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { listBookingsForCounsellor } from "../../services/firebase/bookings";
import { listSsiCollegeResultsForCollege, type SsiCollegeResult } from "../../services/firebase/ssiCollegeResults";
import type { Booking } from "../../types/booking";
import {
  PERIOD_LABELS,
  computeHomeMetrics,
  type HomeMetrics,
  type HomePeriod,
} from "../head/headHomeMetrics";
import "../head/HeadCommandCentre.css";

const PERIODS: HomePeriod[] = ["week", "month", "semester", "year"];

function formatPct(value: number | null, suffix = "%"): string {
  return value === null ? "—" : `${value}${suffix}`;
}

function formatChange(value: number | null): { text: string; tone: "up" | "down" | "flat" | "none" } {
  if (value === null) return { text: "No prior data", tone: "none" };
  if (value === 0) return { text: "No change", tone: "flat" };
  return value > 0
    ? { text: `↑ ${value}% vs last month`, tone: "up" }
    : { text: `↓ ${Math.abs(value)}% vs last month`, tone: "down" };
}

/**
 * A counsellor already has the same write access as a Head to worksheets
 * and the events calendar — this gives them the same kind of trend/insight
 * cards the Head sees, just scoped to their own sessions and college rather
 * than the whole campus (which counsellors can't read under Firestore rules).
 */
export function CounsellorTrends() {
  const { currentUser, profile } = useAuth();
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [ssiResults, setSsiResults] = useState<SsiCollegeResult[]>([]);
  const [period, setPeriod] = useState<HomePeriod>("month");
  const [now] = useState(() => new Date());

  useEffect(() => {
    if (!currentUser) return;
    let active = true;
    Promise.all([
      listBookingsForCounsellor(currentUser.uid),
      profile?.collegeId ? listSsiCollegeResultsForCollege(profile.collegeId) : Promise.resolve([]),
    ]).then(([myBookings, ssi]) => {
      if (!active) return;
      setBookings(myBookings);
      setSsiResults(ssi);
    });
    return () => {
      active = false;
    };
  }, [currentUser, profile?.collegeId]);

  if (!currentUser || !profile || !bookings) return null;

  const m: HomeMetrics = computeHomeMetrics({
    bookings,
    counsellors: [profile],
    colleges: [],
    events: [],
    reports: [],
    transfers: [],
    ssiResults,
    period,
    now,
  });
  const studentsChange = formatChange(m.centre.studentsChangePct);
  const sessionsChange = formatChange(m.centre.sessionsChangePct);
  const maxMonth = Math.max(1, ...m.centre.sessionsByMonth.map((s) => s.count));

  return (
    <div className="hch">
      <section className="hch-section">
        <div className="hch-section__head">
          <h3 className="hch-section__title">My session trends</h3>
          <div className="hch-filters" role="group" aria-label="Period">
            {PERIODS.map((p) => (
              <button
                key={p}
                type="button"
                className={`hch-chip ${period === p ? "hch-chip--active" : ""}`}
                aria-pressed={period === p}
                onClick={() => setPeriod(p)}
              >
                {PERIOD_LABELS[p]}
              </button>
            ))}
          </div>
        </div>
        <div className="hch-kpis">
          <div className="hch-kpi">
            <p className="hch-kpi__label">Students Supported</p>
            <p className="hch-kpi__value">{m.kpis.students}</p>
            <p className="hch-kpi__note">Students you've seen this period</p>
          </div>
          <div className="hch-kpi">
            <p className="hch-kpi__label">Sessions</p>
            <p className="hch-kpi__value">{m.kpis.sessions}</p>
            <p className="hch-kpi__note">Sessions booked or completed</p>
          </div>
          <div className="hch-kpi">
            <p className="hch-kpi__label">Session Completion</p>
            <p className="hch-kpi__value">{formatPct(m.kpis.completionPct)}</p>
            <p className="hch-kpi__note">Completed vs scheduled sessions</p>
          </div>
        </div>
        <div className="hch-two-col">
          <div className="hch-panel">
            <p className="hch-label">Sessions — last 6 months</p>
            <div className="hch-bars" aria-label="Sessions per month">
              {m.centre.sessionsByMonth.map((s) => (
                <div key={s.label} className="hch-bar">
                  <span className="hch-bar__value">{s.count}</span>
                  <div className="hch-bar__track">
                    <div className="hch-bar__fill" style={{ height: `${Math.round((s.count / maxMonth) * 100)}%` }} />
                  </div>
                  <span className="hch-bar__label">{s.label}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="hch-panel">
            <p className="hch-label">My insights</p>
            <ul className="hch-insights">
              <li>
                <span>Students supported</span>
                <strong className={`hch-tone--${studentsChange.tone}`}>{studentsChange.text}</strong>
              </li>
              <li>
                <span>Sessions booked</span>
                <strong className={`hch-tone--${sessionsChange.tone}`}>{sessionsChange.text}</strong>
              </li>
              <li>
                <span>No-show rate</span>
                <strong>{formatPct(m.centre.noShowRatePct)}</strong>
              </li>
              <li>
                <span>Returning students</span>
                <strong>{formatPct(m.centre.returningStudentsPct)}</strong>
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section className="hch-section">
        <h3 className="hch-section__title">Student wellness trends</h3>
        <div className="hch-panel">
          <p className="hch-label">Wellness check-in insights ({m.severity.total} screened)</p>
          {m.severity.total === 0 ? (
            <p className="hch-muted">No wellness check-ins yet for your college.</p>
          ) : (
            <ul className="hch-severity">
              <li className="hch-severity__row">
                <span>Healthy</span>
                <span className="hch-severity__bar">
                  <span className="hch-severity__fill hch-severity__fill--ok" style={{ width: `${m.severity.healthy}%` }} />
                </span>
                <strong>{m.severity.healthy}%</strong>
              </li>
              <li className="hch-severity__row">
                <span>Mild concerns</span>
                <span className="hch-severity__bar">
                  <span className="hch-severity__fill hch-severity__fill--mild" style={{ width: `${m.severity.mild}%` }} />
                </span>
                <strong>{m.severity.mild}%</strong>
              </li>
              <li className="hch-severity__row">
                <span>Higher concern</span>
                <span className="hch-severity__bar">
                  <span className="hch-severity__fill hch-severity__fill--high" style={{ width: `${m.severity.higher}%` }} />
                </span>
                <strong>{m.severity.higher}%</strong>
              </li>
            </ul>
          )}
          <p className="hch-small hch-muted">Aggregated and de-identified, for your college only.</p>
        </div>
      </section>

      <section className="hch-section">
        <h3 className="hch-section__title">How are your students experiencing sessions?</h3>
        <div className="hch-panel">
          <p className="hch-rating">
            {m.feedback.averageRating !== null ? `★ ${m.feedback.averageRating} / 5` : "—"}
          </p>
          <p className="hch-small hch-muted">From {m.feedback.ratedCount} rated sessions</p>
        </div>
      </section>
    </div>
  );
}

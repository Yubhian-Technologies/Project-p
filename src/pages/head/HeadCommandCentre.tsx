import { useEffect, useState, useRef, useCallback, type ReactNode } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../../services/firebase/config";
import { useAuth } from "../../hooks/useAuth";
import { listBookableProfiles, listPendingTransferRequestsForCampus } from "../../services/firebase/bookings";
import { listColleges } from "../../services/firebase/colleges";
import { listEventsForCampus } from "../../services/firebase/events";
import { listCounsellorMonthlyReportsForCampus } from "../../services/firebase/counsellorMonthlyReports";
import { AttendanceCheckCard } from "../../components/attendance/AttendanceCheckCard";
import { TeamAttendanceTodayCard } from "./TeamAttendanceTodayCard";
import { listSsiCollegeResultsForCampus, type SsiCollegeResult } from "../../services/firebase/ssiCollegeResults";
import { getAllFeedback } from "../../services/firebase/feedback";
import { formatDateDMY } from "../../utils/formatDate";
import type { Booking } from "../../types/booking";
import type { UserProfile } from "../../types/user";
import {
  periodLabel,
  computeHomeMetrics,
  type HomeInput,
  type HomePeriod,
  type HomeMetrics,
} from "./headHomeMetrics";
import "./HeadCommandCentre.css";

type LoadedData = Omit<HomeInput, "period" | "now">;

const PERIODS: HomePeriod[] = ["week", "month"];

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

function Placeholder({ children }: { children: ReactNode }) {
  return <span className="hch-placeholder">{children}</span>;
}

interface HeadCommandCentreProps {
  onNavigate: (section: string) => void;
}

export function HeadCommandCentre({ onNavigate }: HeadCommandCentreProps) {
  const { profile } = useAuth();
  const campusId = profile?.campusId;
  const [data, setData] = useState<LoadedData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<HomePeriod>("month");
  const [now] = useState(() => new Date());

  const teamCarouselRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const updateScrollButtons = useCallback(() => {
    const el = teamCarouselRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 4);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 4);
  }, []);

  const scrollTeamCarousel = (dir: "left" | "right") => {
    const el = teamCarouselRef.current;
    if (!el) return;
    const scrollAmount = 300;
    el.scrollBy({ left: dir === "left" ? -scrollAmount : scrollAmount, behavior: "smooth" });
    setTimeout(updateScrollButtons, 350);
  };

  useEffect(() => {
    if (!campusId) return;
    let active = true;

    // Each read is individually labeled so a permission/other failure in
    // Promise.all tells us exactly which one broke, instead of one opaque
    // "something failed" error with no way to tell which query it was.
    function labeled<T>(label: string, p: Promise<T>): Promise<T> {
      return p.catch((err) => {
        const message = err instanceof Error ? err.message : String(err);
        throw new Error(`[${label}] ${message}`, { cause: err });
      });
    }

    async function load(id: string) {
      try {
        const [bookingSnap, allProfiles, colleges, events, reports, transfers, feedbackList] = await Promise.all([
          labeled("bookings", getDocs(query(collection(db, "bookings"), where("campusId", "==", id)))),
          labeled("bookableProfiles", listBookableProfiles()),
          labeled("colleges", listColleges(id)),
          labeled("events", listEventsForCampus(id)),
          labeled("counsellorMonthlyReports", listCounsellorMonthlyReportsForCampus(id)),
          labeled("pendingTransfers", listPendingTransferRequestsForCampus(id)),
          labeled("feedback", getAllFeedback(id)),
        ]);
        const ssiResults: SsiCollegeResult[] = await labeled("ssiResults", listSsiCollegeResultsForCampus(id));
        if (!active) return;
        const bookings = bookingSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Booking);
        const counsellors = allProfiles.filter((p: UserProfile) => p.campusId === id);
        setData({
          bookings,
          counsellors,
          colleges,
          events,
          reports,
          transfers,
          ssiResults,
          feedbackList,
        });
      } catch (err) {
        console.error("Failed to load head home:", err);
        if (active) {
          const detail = err instanceof Error ? err.message : "";
          setError(`Couldn't load the dashboard data. Please refresh.${detail ? ` (${detail})` : ""}`);
        }
      }
    }

    load(campusId);
    return () => {
      active = false;
    };
  }, [campusId]);

  useEffect(() => {
    updateScrollButtons();
    window.addEventListener("resize", updateScrollButtons);
    return () => window.removeEventListener("resize", updateScrollButtons);
  }, [updateScrollButtons, data]);

  if (!campusId) {
    return <p className="hch-muted">Your profile isn't linked to a campus yet.</p>;
  }
  if (error) return <p className="hch-error">{error}</p>;
  if (!data) return <p className="hch-muted">Loading dashboard…</p>;

  const m: HomeMetrics = computeHomeMetrics({ ...data, period, now });
  const studentsChange = formatChange(m.centre.studentsChangePct);
  const sessionsChange = formatChange(m.centre.sessionsChangePct);
  const maxMonth = Math.max(1, ...m.centre.sessionsByMonth.map((s) => s.count));
  const greetingName = profile?.displayName || profile?.email || "Head";

  return (
    <div className="hch">
      {/* 1. Welcome */}
      <section className="hch-hero">
        <div>
          <h2 className="hch-hero__title">Welcome, {greetingName}</h2>
          <p className="hch-hero__subtitle">Vishnu Wellness Centre — Head Dashboard</p>
          <p className="hch-hero__body">
            Monitor centre performance, counsellor workload, student wellness trends, and institutional engagement
            from one place.
          </p>
        </div>
        <button type="button" className="hch-btn hch-btn--primary" onClick={() => onNavigate("team-management")}>
          View Team &amp; Workload →
        </button>
      </section>

      <AttendanceCheckCard span={12} />

      {/* 2. KPIs */}
      <section className="hch-section">
        <div className="hch-section__head">
          <h3 className="hch-section__title">Key figures</h3>
          <div className="hch-filters" role="group" aria-label="Period">
            {PERIODS.map((p) => (
              <button
                key={p}
                type="button"
                className={`hch-chip ${period === p ? "hch-chip--active" : ""}`}
                aria-pressed={period === p}
                onClick={() => setPeriod(p)}
              >
                {periodLabel(p, now)}
              </button>
            ))}
          </div>
        </div>
        <p className="hch-muted hch-small">The period filter applies to the first four cards and Team Pulse below.</p>
        <div className="hch-kpis">
          <Kpi label="Students Supported" value={m.kpis.students} note="Students who accessed wellness services" />
          <Kpi label="Sessions" value={m.kpis.sessions} note="Counselling sessions booked or completed" />
          <Kpi label="Active Counsellors" value={m.kpis.activeCounsellors} note="Counsellors currently available" />
          <Kpi label="Pending Requests" value={m.kpis.pendingRequests} note="Sessions awaiting confirmation" />
          <Kpi label="Session Completion" value={formatPct(m.kpis.completionPct)} note="Completed vs scheduled sessions" />
          <Kpi label="Institutions Covered" value={m.kpis.institutionsCovered} note="Institutions actively using the centre" />
        </div>
      </section>

      {/* 3. Centre performance + insights */}
      <section className="hch-section">
        <h3 className="hch-section__title">Centre performance</h3>
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
            <p className="hch-label">Centre insights</p>
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
                <span>Average session completion</span>
                <strong>{formatPct(m.kpis.completionPct)}</strong>
              </li>
              <li>
                <span>Returning students</span>
                <strong>{formatPct(m.centre.returningStudentsPct)}</strong>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* 4. Team pulse */}
      <section className="hch-section">
        <div className="hch-section__head">
          <h3 className="hch-section__title">Team pulse</h3>
          <div className="hch-team-pulse-actions">
            {m.team.length > 1 && (
              <div className="hch-carousel-controls" role="group" aria-label="Team carousel navigation">
                <button
                  type="button"
                  className="hch-carousel-arrow"
                  onClick={() => scrollTeamCarousel("left")}
                  disabled={!canScrollLeft}
                  aria-label="Previous team member"
                >
                  <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
                </button>
                <button
                  type="button"
                  className="hch-carousel-arrow"
                  onClick={() => scrollTeamCarousel("right")}
                  disabled={!canScrollRight}
                  aria-label="Next team member"
                >
                  <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
                </button>
              </div>
            )}
            <button type="button" className="hch-btn hch-btn--ghost" onClick={() => onNavigate("team-management")}>
              View Full Team →
            </button>
          </div>
        </div>
        {m.team.length === 0 ? (
          <p className="hch-muted">No team members on this campus yet.</p>
        ) : (
          <div className="hch-team-carousel-viewport">
            <div
              ref={teamCarouselRef}
              className="hch-team hch-team--carousel"
              onScroll={updateScrollButtons}
            >
              {m.team.map((c) => (
                <article key={c.uid} className={`hch-counsellor ${c.role === "head" ? "hch-counsellor--head" : ""}`}>
                  <header>
                    <div className="hch-counsellor__header-row">
                      <p className="hch-counsellor__name">{c.name}</p>
                      {c.role === "head" && (
                        <span className="hch-role-badge hch-role-badge--head">Head</span>
                      )}
                    </div>
                    <p className="hch-muted hch-small">{c.collegeName}</p>
                  </header>
                  <dl className="hch-counsellor__stats">
                    <div>
                      <dt title={`Accepted, scheduled, or completed bookings for ${periodLabel(period, now)}`}>
                        Sessions ({periodLabel(period, now)})
                      </dt>
                      <dd>{c.total}</dd>
                    </div>
                    <div>
                      <dt>Completed</dt>
                      <dd>{c.completed}</dd>
                    </div>
                    <div>
                      <dt>Upcoming</dt>
                      <dd>{c.upcoming}</dd>
                    </div>
                    <div>
                      <dt>Pending</dt>
                      <dd>{c.pending}</dd>
                    </div>
                    <div>
                      <dt>Missed</dt>
                      <dd>{c.missed}</dd>
                    </div>
                    <div>
                      <dt>Crisis SOS</dt>
                      <dd>{c.crisisSos}</dd>
                    </div>
                  </dl>
                  <span className={`hch-workload hch-workload--${c.workload.toLowerCase()}`}>
                    Workload: {c.workload}
                  </span>
                </article>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* 5. Wellness trends + screening */}
      <section className="hch-section">
        <div className="hch-section__head">
          <h3 className="hch-section__title">Student wellness trends</h3>
          <button type="button" className="hch-btn hch-btn--ghost" onClick={() => onNavigate("ssi-results")}>
            View Screening Analytics →
          </button>
        </div>
        <div className="hch-two-col">
          <div className="hch-panel">
            <p className="hch-label">Wellness check-in insights ({m.severity.total} screened)</p>
            {m.severity.total === 0 ? (
              <p className="hch-muted">No wellness check-ins yet.</p>
            ) : (
              <ul className="hch-severity">
                <SeverityRow label="Healthy" value={m.severity.healthy} tone="ok" />
                <SeverityRow label="Mild concerns" value={m.severity.mild} tone="mild" />
                <SeverityRow label="Higher concern" value={m.severity.higher} tone="high" />
              </ul>
            )}
            <p className="hch-small hch-muted">
              Aggregated and de-identified. Results are governed by the screening tool, consent and referral
              procedures.
            </p>
          </div>
          <div className="hch-panel">
            <p className="hch-label">What are students coming in with? ({m.concernCategoriesTotal} tagged)</p>
            {m.concernCategories.length === 0 ? (
              <p className="hch-muted">
                <Placeholder>Not tracked yet</Placeholder> No one has selected a concern category at booking time
                yet — it's an optional field, so this fills in as students start using it.
              </p>
            ) : (
              <ul className="hch-severity">
                {m.concernCategories.map((row) => (
                  <li key={row.category} className="hch-severity__row">
                    <span>{row.label}</span>
                    <span className="hch-severity__bar">
                      <span className="hch-severity__fill hch-severity__fill--ok" style={{ width: `${row.pct}%` }} />
                    </span>
                    <strong>{row.pct}%</strong>
                  </li>
                ))}
              </ul>
            )}
            <p className="hch-small hch-muted">
              Optional, student-chosen at booking time. Aggregated and de-identified.
            </p>
          </div>
        </div>
      </section>

      {/* 6. Institutions */}
      <section className="hch-section">
        <h3 className="hch-section__title">Wellness across institutions</h3>
        {m.institutions.length === 0 ? (
          <p className="hch-muted">No institutions set up yet.</p>
        ) : (
          <div className="hch-table-wrap">
            <table className="hch-table">
              <thead>
                <tr>
                  <th>Institution</th>
                  <th>Students supported</th>
                  <th>Sessions</th>
                  <th>Utilisation</th>
                </tr>
              </thead>
              <tbody>
                {m.institutions.map((row) => (
                  <tr key={row.id}>
                    <td>{row.name}</td>
                    <td>{row.students}</td>
                    <td>{row.sessions}</td>
                    <td>
                      <span className={`hch-util hch-util--${row.utilisation === "—" ? "none" : row.utilisation.toLowerCase()}`}>
                        {row.utilisation}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="hch-small hch-muted">Institution is taken from the counsellor who handled the session.</p>
      </section>

      {/* 7. Today + action required */}
      <section className="hch-section">
        <div className="hch-two-col">
          <div className="hch-panel">
            <div className="hch-section__head">
              <p className="hch-label">Today&apos;s schedule — {m.today.total} appointments</p>
              <button type="button" className="hch-btn hch-btn--ghost" onClick={() => onNavigate("requests")}>
                View Appointment Calendar →
              </button>
            </div>
            <ul className="hch-status-list">
              <li><span className="hch-dot hch-dot--done" />Completed — {m.today.completed}</li>
              <li><span className="hch-dot hch-dot--upcoming" />Upcoming — {m.today.upcoming}</li>
              <li><span className="hch-dot hch-dot--pending" />Pending — {m.today.pending}</li>
              <li><span className="hch-dot hch-dot--cancelled" />Cancelled — {m.today.cancelled}</li>
              <li><span className="hch-dot hch-dot--noshow" />No-show — {m.today.noShow}</li>
            </ul>
          </div>
          <div className="hch-panel">
            <p className="hch-label">Action required</p>
            <ul className="hch-actions">
              <li>
                <button type="button" onClick={() => onNavigate("requests")}>
                  {m.actions.pendingRequests} appointment requests awaiting confirmation
                </button>
              </li>
              <li>
                <button type="button" onClick={() => onNavigate("requests")}>
                  {m.actions.followUpsAwaiting} follow-ups awaiting booking
                </button>
              </li>
              <li>
                <button type="button" onClick={() => onNavigate("team-management")}>
                  {m.actions.highWorkloadCounsellors} counsellors have high workload
                </button>
              </li>
              <li>
                <button type="button" onClick={() => onNavigate("counsellor-monthly-reports")}>
                  Monthly reports missing from {m.actions.reportsMissingThisMonth} counsellors
                </button>
              </li>
              <li>
                <button type="button" onClick={() => onNavigate("transfer-requests")}>
                  {m.actions.pendingTransfers} transfer requests pending
                </button>
              </li>
              {m.actions.risingInstitution && (
                <li>
                  <span>
                    {m.actions.risingInstitution.name} has increased student requests by{" "}
                    {m.actions.risingInstitution.changePct}%
                  </span>
                </li>
              )}
            </ul>
          </div>
        </div>
      </section>

      <TeamAttendanceTodayCard onViewAll={() => onNavigate("team-management")} />

      {/* 8. Programs */}
      <section className="hch-section">
        <div className="hch-section__head">
          <h3 className="hch-section__title">Programs &amp; outreach</h3>
          <button type="button" className="hch-btn hch-btn--ghost" onClick={() => onNavigate("events")}>
            Manage Wellness Programs →
          </button>
        </div>
        {m.programs.length === 0 ? (
          <p className="hch-muted">No upcoming programs scheduled.</p>
        ) : (
          <ul className="hch-programs">
            {m.programs.map((p) => (
              <li key={`${p.title}-${p.eventDate}`}>
                <p className="hch-program__title">{p.title}</p>
                <p className="hch-small hch-muted">
                  {formatDateDMY(p.eventDate)}
                  {" · "}
                  {p.collegeName}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 9. Counsellor reports */}
      <section className="hch-section">
        <div className="hch-section__head">
          <h3 className="hch-section__title">Counsellor reports</h3>
          <div className="hch-inline">
            <button type="button" className="hch-btn hch-btn--ghost" onClick={() => onNavigate("counsellor-monthly-reports")}>
              View Reports
            </button>
          </div>
        </div>
        {m.reports.length === 0 ? (
          <p className="hch-muted">No counsellors on this campus yet.</p>
        ) : (
          <ul className="hch-reports">
            {m.reports.map((r) => (
              <li key={r.uid}>
                <span>{r.name}</span>
                <span className={r.submitted ? "hch-tone--up" : "hch-tone--mild"}>
                  {r.submitted ? "✓ Submitted" : "Pending"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 10. Student feedback */}
      <section className="hch-section">
        <h3 className="hch-section__title">How are students experiencing the centre?</h3>
        <div className="hch-two-col">
          <div className="hch-panel">
            <p className="hch-rating">
              <StarIcon /> {m.feedback.averageRating !== null ? `${m.feedback.averageRating} / 5` : "—"}
            </p>
            <p className="hch-small hch-muted">Overall experience from {m.feedback.ratedCount} rated sessions</p>
          </div>
          <div className="hch-panel">
            <ul className="hch-insights">
              <li>
                <span>Felt heard</span>
                {m.feedback.feltHeardPct !== null ? <strong>{m.feedback.feltHeardPct}%</strong> : <Placeholder>Not enough data yet</Placeholder>}
              </li>
              <li>
                <span>Felt comfortable</span>
                {m.feedback.feltComfortablePct !== null ? (
                  <strong>{m.feedback.feltComfortablePct}%</strong>
                ) : (
                  <Placeholder>Not enough data yet</Placeholder>
                )}
              </li>
              <li>
                <span>Would recommend counselling</span>
                {m.feedback.wouldRecommendPct !== null ? (
                  <strong>{m.feedback.wouldRecommendPct}%</strong>
                ) : (
                  <Placeholder>Not enough data yet</Placeholder>
                )}
              </li>
            </ul>
          </div>
        </div>
      </section>

    </div>
  );
}

function Kpi({ label, value, note }: { label: string; value: number | string; note: string }) {
  return (
    <div className="hch-kpi">
      <p className="hch-kpi__label">{label}</p>
      <p className="hch-kpi__value">{value}</p>
      <p className="hch-kpi__note">{note}</p>
    </div>
  );
}

function SeverityRow({ label, value, tone }: { label: string; value: number; tone: "ok" | "mild" | "high" }) {
  return (
    <li className="hch-severity__row">
      <span>{label}</span>
      <span className="hch-severity__bar">
        <span className={`hch-severity__fill hch-severity__fill--${tone}`} style={{ width: `${value}%` }} />
      </span>
      <strong>{value}%</strong>
    </li>
  );
}

function StarIcon() {
  return (
    <svg className="hch-star" viewBox="0 0 24 24" aria-hidden="true">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill="#F59E0B" stroke="#B45309" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

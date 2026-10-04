import { useEffect, useState, type ReactNode } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../../services/firebase/config";
import { useAuth } from "../../hooks/useAuth";
import { listBookableProfiles, listPendingTransferRequestsForCampus } from "../../services/firebase/bookings";
import { listColleges } from "../../services/firebase/colleges";
import { listEventsForCampus } from "../../services/firebase/events";
import { listCounsellorMonthlyReportsForCampus } from "../../services/firebase/counsellorMonthlyReports";
import { AttendanceCheckCard } from "../../components/attendance/AttendanceCheckCard";
import { listSsiCollegeResultsForCollege, type SsiCollegeResult } from "../../services/firebase/ssiCollegeResults";
import type { Booking } from "../../types/booking";
import type { UserProfile } from "../../types/user";
import {
  PERIOD_LABELS,
  computeHomeMetrics,
  type HomeInput,
  type HomePeriod,
  type HomeMetrics,
} from "./headHomeMetrics";
import "./HeadCommandCentre.css";

type LoadedData = Omit<HomeInput, "period" | "now">;

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

  useEffect(() => {
    if (!campusId) return;
    let active = true;

    async function load(id: string) {
      try {
        const [bookingSnap, allProfiles, colleges, events, reports, transfers] = await Promise.all([
          getDocs(query(collection(db, "bookings"), where("campusId", "==", id))),
          listBookableProfiles(),
          listColleges(id),
          listEventsForCampus(id),
          listCounsellorMonthlyReportsForCampus(id),
          listPendingTransferRequestsForCampus(id),
        ]);
        const ssiGroups = await Promise.all(colleges.map((c) => listSsiCollegeResultsForCollege(c.id)));
        if (!active) return;
        const bookings = bookingSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Booking);
        const counsellors = allProfiles.filter((p: UserProfile) => p.campusId === id);
        const ssiResults: SsiCollegeResult[] = ssiGroups.flat();
        setData({
          bookings,
          counsellors,
          colleges,
          events,
          reports,
          transfers,
          ssiResults,
        });
      } catch (err) {
        console.error("Failed to load head home:", err);
        if (active) setError("Couldn't load the dashboard data. Please refresh.");
      }
    }

    load(campusId);
    return () => {
      active = false;
    };
  }, [campusId]);

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
                {PERIOD_LABELS[p]}
              </button>
            ))}
          </div>
        </div>
        <p className="hch-muted hch-small">The period filter applies to the first four cards.</p>
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
          <button type="button" className="hch-btn hch-btn--ghost" onClick={() => onNavigate("team-management")}>
            View Full Team →
          </button>
        </div>
        {m.team.length === 0 ? (
          <p className="hch-muted">No counsellors on this campus yet.</p>
        ) : (
          <div className="hch-team">
            {m.team.map((c) => (
              <article key={c.uid} className="hch-counsellor">
                <header>
                  <p className="hch-counsellor__name">{c.name}</p>
                  <p className="hch-muted hch-small">{c.collegeName}</p>
                </header>
                <dl className="hch-counsellor__stats">
                  <div>
                    <dt>Sessions</dt>
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
                </dl>
                <span className={`hch-workload hch-workload--${c.workload.toLowerCase()}`}>
                  Workload: {c.workload}
                </span>
              </article>
            ))}
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
            <p className="hch-label">What are students coming in with?</p>
            <p className="hch-muted">
              <Placeholder>Not tracked yet</Placeholder> Concern categories (anxiety, academic stress, relationships,
              sleep, self-esteem) need a categorisation field on bookings before they can be shown.
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
                  {new Date(p.eventDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
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
            <button type="button" className="hch-btn hch-btn--ghost" disabled title="Coming soon">
              Download Monthly Summary
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
                <Placeholder>Not collected yet</Placeholder>
              </li>
              <li>
                <span>Felt comfortable</span>
                <Placeholder>Not collected yet</Placeholder>
              </li>
              <li>
                <span>Would recommend counselling</span>
                <Placeholder>Not collected yet</Placeholder>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* 11. Quick actions */}
      <section className="hch-section">
        <h3 className="hch-section__title">Quick actions</h3>
        <div className="hch-quick">
          <QuickButton icon="add" label="Add Counsellor" onClick={() => onNavigate("team-management")} />
          <QuickButton icon="calendar" label="View Calendar" onClick={() => onNavigate("requests")} />
          <QuickButton icon="chart" label="View Analytics" onClick={() => onNavigate("ssi-results")} />
          <QuickButton icon="clipboard" label="Review Reports" onClick={() => onNavigate("counsellor-monthly-reports")} />
          <QuickButton icon="building" label="Consolidated Reports" onClick={() => onNavigate("monthly-reports")} />
          <QuickButton icon="target" label="Create Wellness Program" onClick={() => onNavigate("events")} />
          <QuickButton icon="megaphone" label="Team Chat" onClick={() => onNavigate("team-chat")} />
          <QuickButton icon="folder" label="Team Workload" onClick={() => onNavigate("team-workload")} />
          <QuickButton icon="download" label="Export Report" disabled />
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

const ICON_PATHS: Record<string, ReactNode> = {
  add: <><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></>,
  calendar: <><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></>,
  chart: <><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></>,
  clipboard: <><rect x="8" y="2" width="8" height="4" rx="1" /><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /></>,
  building: <><rect x="4" y="2" width="16" height="20" rx="2" /><line x1="9" y1="6" x2="9" y2="6" /><line x1="15" y1="6" x2="15" y2="6" /><line x1="9" y1="10" x2="9" y2="10" /><line x1="15" y1="10" x2="15" y2="10" /><line x1="10" y1="22" x2="10" y2="18" /><line x1="14" y1="22" x2="14" y2="18" /></>,
  target: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></>,
  megaphone: <><path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1z" /><path d="M16 8a5 5 0 0 1 0 8" /></>,
  folder: <><path d="M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></>,
  download: <><path d="M12 3v12" /><polyline points="7 10 12 15 17 10" /><path d="M4 17v3h16v-3" /></>,
};

function QuickIcon({ name }: { name: string }) {
  return (
    <svg className="hch-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICON_PATHS[name]}
    </svg>
  );
}

function QuickButton({ icon, label, onClick, disabled }: { icon: string; label: string; onClick?: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} title={disabled ? "Coming soon" : undefined}>
      <QuickIcon name={icon} />
      <span>{label}</span>
    </button>
  );
}

function StarIcon() {
  return (
    <svg className="hch-star" viewBox="0 0 24 24" aria-hidden="true">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill="#F59E0B" stroke="#B45309" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

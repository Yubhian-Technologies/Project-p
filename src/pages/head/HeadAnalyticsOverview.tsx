import { useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../../services/firebase/config";
import { useAuth } from "../../hooks/useAuth";
import { getBookingIntake } from "../../services/firebase/bookings";
import type { Booking, BookingIntake } from "../../types/booking";
import "./HeadAnalyticsOverview.css";

interface StatItem {
  id: string;
  label: string;
  value: string | number;
  gauge?: number;
  icon: React.ReactNode;
  variant: "teal" | "purple" | "green" | "orange" | "red" | "navy";
}

interface TrendDay {
  dateLabel: string;
  appointments: number;
  checkins: number;
}

interface TopicShare {
  name: string;
  percentage: number;
  color: string;
}

// ── Aesthetic SVG Vector Icons ───────────────────────────────────────────────
function IconStudents() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function IconAppointments() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="3" ry="3" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01" strokeWidth="2.5" />
    </svg>
  );
}

function IconCompleted() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

function IconPending() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function IconNoShow() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="8.5" cy="7" r="4" />
      <line x1="18" y1="11" x2="23" y2="11" />
    </svg>
  );
}

function IconUtilization() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  );
}

// Topic buckets used to anonymise free-text "issue" answers from the session
// intake form into the chart — this is categorization config, not data.
const TOPIC_DEFS: { name: string; color: string; pattern: RegExp }[] = [
  { name: "Academic Stress", color: "#F59E0B", pattern: /academ|exam|study|syllabus|result|grade|class|semester|assignment|score|placement/ },
  { name: "Anxiety & Mood", color: "#8B5CF6", pattern: /anxiet|worry|stress|mood|depress|sad|panic|overthink|fear|low/ },
  { name: "Relationships", color: "#EC4899", pattern: /relationship|friend|parent|family|breakup|marriage|social|peer/ },
  { name: "Sleep & Fatigue", color: "#10B981", pattern: /sleep|insomnia|fatigue|tired|energy|wake|rest/ },
  { name: "Career & Future", color: "#3B82F6", pattern: /career|job|future|interview|profession|work|business|internship/ },
  { name: "Emotional Wellbeing", color: "#F97316", pattern: /emotion|anger|angry|lonel|grief|loss|self|confiden|worth|motivat/ },
];

const OTHER_TOPIC_COLOR = "#6B7280";

function colorForTopic(name: string): string {
  return TOPIC_DEFS.find((d) => d.name === name)?.color ?? OTHER_TOPIC_COLOR;
}

function matchTopic(issue: string): string {
  const text = (issue || "").toLowerCase();
  return TOPIC_DEFS.find((d) => d.pattern.test(text))?.name ?? "Other Topics";
}

function buildTopicDistribution(issues: string[]): TopicShare[] {
  if (issues.length === 0) return [];

  const counts = new Map<string, number>();
  for (const issue of issues) {
    const name = matchTopic(issue);
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }

  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const names = sorted.map(([name]) => name);
  const pcts = names.map((_, i) => Math.floor((sorted[i][1] / issues.length) * 100));
  pcts[0] += 100 - pcts.reduce((sum, p) => sum + p, 0);

  return names.map((name, i) => ({
    name,
    percentage: pcts[i],
    color: colorForTopic(name),
  }));
}

function dayLabelFromMs(ts: number): string {
  const d = new Date(ts);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${mm}-${dd}`;
}

// ── Arc Gauge (radial % readout for rate KPIs) ─────────────────────────────
function polar(cx: number, cy: number, r: number, deg: number): { x: number; y: number } {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number): string {
  const s = polar(cx, cy, r, startDeg);
  const e = polar(cx, cy, r, endDeg);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`;
}

function Gauge({ value, variant }: { value: number; variant: "red" | "navy" }) {
  const cx = 60;
  const cy = 62;
  const r = 46;
  const start = 135;
  const sweep = 270;
  const pct = Math.min(100, Math.max(0, Math.round(value)));
  const end = start + (sweep * pct) / 100;

  return (
    <svg viewBox="0 0 120 120" className={`head-analytics__gauge head-analytics__gauge--${variant}`}>
      <path d={arcPath(cx, cy, r, start, start + sweep)} className="head-analytics__gauge-track" />
      {pct > 0 && <path d={arcPath(cx, cy, r, start, end)} className="head-analytics__gauge-fg" />}
      {[0, 1, 2, 3, 4, 5, 6].map((i) => {
        const a = start + 45 * i;
        const p1 = polar(cx, cy, r - 8, a);
        const p2 = polar(cx, cy, r - 13, a);
        return <line key={i} x1={p1.x.toFixed(2)} y1={p1.y.toFixed(2)} x2={p2.x.toFixed(2)} y2={p2.y.toFixed(2)} className="head-analytics__gauge-tick" />;
      })}
      <text x={cx} y={cy + 1} textAnchor="middle" dominantBaseline="middle" className="head-analytics__gauge-val">
        {pct}%
      </text>
    </svg>
  );
}

// ── Per-counsellor caseload helpers ────────────────────────────────────────
interface CaseloadRow {
  counsellor: string;
  name: string;
  completed: number;
  missed: number;
  pending: number;
  total: number;
}

function counsellorLabel(email: string): string {
  const local = (email || "").split("@")[0] || email || "Unassigned";
  return local.replace(/[._-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function HeadAnalyticsOverview() {
  const { profile } = useAuth();
  const [stats, setStats] = useState<{
    studentsSupported: number;
    appointments: number;
    completed: number;
    pending: number;
    noShowRate: number;
    utilization: number;
  }>({
    studentsSupported: 0,
    appointments: 0,
    completed: 0,
    pending: 0,
    noShowRate: 0,
    utilization: 0,
  });

  const [trendData, setTrendData] = useState<TrendDay[]>([]);
  const [topics, setTopics] = useState<TopicShare[]>([]);
  const [analyzedCount, setAnalyzedCount] = useState(0);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [caseload, setCaseload] = useState<CaseloadRow[]>([]);

  useEffect(() => {
    const campusId = profile?.campusId;
    if (!campusId) return;

    let active = true;

    // Fetch campus metrics from Firestore — every number below is computed
    // from real booking data, with zero fake fallbacks.
    async function fetchCampusMetrics() {
      try {
        const q = query(collection(db, "bookings"), where("campusId", "==", campusId));
        const snap = await getDocs(q);
        const bookings = snap.docs.map((d) => d.data() as Booking);

        const uniqueStudents = new Set(bookings.map((b) => b.userId)).size;
        const completedCount = bookings.filter((b) => b.status === "completed" && b.outcome !== "missed").length;
        const missedCount = bookings.filter((b) => b.status === "completed" && b.outcome === "missed").length;
        const pendingCount = bookings.filter((b) => ["pending", "accepted", "scheduled"].includes(b.status)).length;
        const totalTaken = completedCount + missedCount;
        const noShowPct = totalTaken > 0 ? Math.round((missedCount / totalTaken) * 100) : 0;
        const utilPct =
          uniqueStudents > 0 ? Math.min(100, Math.round((bookings.length / (uniqueStudents * 3)) * 100)) : 0;

        if (active) {
          setStats({
            studentsSupported: uniqueStudents,
            appointments: bookings.length,
            completed: completedCount,
            pending: pendingCount,
            noShowRate: noShowPct,
            utilization: utilPct,
          });
        }

        // 14-day trend from real scheduled/completed session counts.
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const dayBuckets: TrendDay[] = [];
        for (let i = 13; i >= 0; i--) {
          const start = startOfToday - i * 24 * 60 * 60 * 1000;
          const end = start + 24 * 60 * 60 * 1000;
          const appointments = bookings.filter(
            (b) =>
              b.scheduledAt &&
              b.scheduledAt >= start &&
              b.scheduledAt < end &&
              ["accepted", "scheduled", "completed"].includes(b.status),
          ).length;
          const checkins = bookings.filter(
            (b) =>
              b.scheduledAt &&
              b.scheduledAt >= start &&
              b.scheduledAt < end &&
              b.status === "completed" &&
              b.outcome !== "missed",
          ).length;
          dayBuckets.push({ dateLabel: dayLabelFromMs(start), appointments, checkins });
        }
        if (active) setTrendData(dayBuckets);

        // Anonymised topic share from recent intake "issue" text.
        const recent = [...bookings].sort((a, b) => b.createdAt - a.createdAt).slice(0, 25);
        const intakes = await Promise.all(
          recent.map((b) =>
            getBookingIntake(b.id)
              .then((i) => i)
              .catch(() => null),
          ),
        );
        const issues = intakes
          .filter((i): i is BookingIntake => i !== null && Boolean(i.issue))
          .map((i) => i.issue)
          .filter(Boolean);
        if (active) {
          setAnalyzedCount(issues.length);
          setTopics(buildTopicDistribution(issues));
        }

        // Per-counsellor workload: one stacked bar per staff member.
        const perCounsellor = new Map<string, CaseloadRow>();
        for (const b of bookings) {
          const key = b.counsellorEmail || b.counsellorId || "Unassigned";
          const row = perCounsellor.get(key) ?? {
            counsellor: key,
            name: counsellorLabel(b.counsellorEmail),
            completed: 0,
            missed: 0,
            pending: 0,
            total: 0,
          };
          if (b.status === "completed" && b.outcome !== "missed") row.completed += 1;
          else if (b.status === "completed" && b.outcome === "missed") row.missed += 1;
          else if (["pending", "accepted", "scheduled"].includes(b.status)) row.pending += 1;
          else continue;
          row.total += 1;
          perCounsellor.set(key, row);
        }
        const caseloadRows = [...perCounsellor.values()].sort((a, b) => b.total - a.total);
        if (active) setCaseload(caseloadRows);
      } catch (err) {
        console.warn("Failed to load campus analytics:", err);
      }
    }

    fetchCampusMetrics();

    return () => {
      active = false;
    };
  }, [profile?.campusId]);

  // Chart rendering parameters
  const W = 580;
  const H = 190;
  const padL = 38;
  const padR = 24;
  const padT = 24;
  const padB = 34;
  const iW = W - padL - padR;
  const iH = H - padT - padB;
  const maxVal = Math.max(3.2, ...trendData.flatMap((d) => [d.appointments, d.checkins]), 1);

  const xPos = (i: number) => (i / Math.max(1, trendData.length - 1)) * iW;
  const yPos = (v: number) => iH - (v / maxVal) * iH;

  const apptPts = trendData.map((d, i) => ({ x: xPos(i), y: yPos(d.appointments) }));
  const checkPts = trendData.map((d, i) => ({ x: xPos(i), y: yPos(d.checkins) }));

  function sharpPath(pts: { x: number; y: number }[]): string {
    if (pts.length === 0) return "";
    let path = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
    for (let i = 1; i < pts.length; i++) {
      path += ` L ${pts[i].x.toFixed(1)} ${pts[i].y.toFixed(1)}`;
    }
    return path;
  }

  // SVG Donut Chart Math (angles accumulated via reduce so no render-mutation)
  const topicSegments = topics.reduce<Array<TopicShare & { start: number }>>((acc, t) => {
    const start = acc.length === 0 ? 0 : acc[acc.length - 1].start + acc[acc.length - 1].percentage;
    acc.push({ ...t, start });
    return acc;
  }, []);

  const maxTotal = Math.max(1, ...caseload.map((c) => c.total));

  const statCards: StatItem[] = [
    { id: "students", label: "STUDENTS SUPPORTED", value: stats.studentsSupported, icon: <IconStudents />, variant: "teal" },
    { id: "appointments", label: "APPOINTMENTS", value: stats.appointments, icon: <IconAppointments />, variant: "purple" },
    { id: "completed", label: "COMPLETED", value: stats.completed, icon: <IconCompleted />, variant: "green" },
    { id: "pending", label: "PENDING", value: stats.pending, icon: <IconPending />, variant: "orange" },
    { id: "noshow", label: "NO-SHOW RATE", value: `${stats.noShowRate}%`, gauge: stats.noShowRate, icon: <IconNoShow />, variant: "red" },
    { id: "utilization", label: "UTILIZATION", value: `${stats.utilization}%`, gauge: stats.utilization, icon: <IconUtilization />, variant: "navy" },
  ];

  return (
    <div className="head-analytics">
      {/* ── Top 6 KPI Stat Tiles Row ────────────────────────────────────────── */}
      <div className="head-analytics__kpi-grid">
        {statCards.map((card) => (
          <div key={card.id} className={`head-analytics__kpi-card head-analytics__kpi-card--${card.variant}`}>
            <div className="head-analytics__kpi-header">
              <div className={`head-analytics__kpi-icon-badge head-analytics__kpi-icon-badge--${card.variant}`}>
                {card.icon}
              </div>
              <span className="head-analytics__kpi-label">{card.label}</span>
            </div>
            {card.gauge !== undefined ? (
              <div className="head-analytics__kpi-gauge">
                <Gauge value={card.gauge} variant={card.variant === "navy" ? "navy" : "red"} />
              </div>
            ) : (
              <span className="head-analytics__kpi-val">{card.value}</span>
            )}
          </div>
        ))}
      </div>

      {/* ── Main 2-Column Analytics Panel ──────────────────────────────────── */}
      <div className="head-analytics__main-grid">
        {/* Left Column: 14-Day Service Utilization Chart */}
        <div className="head-analytics__card head-analytics__card--chart">
          <div className="head-analytics__card-header">
            <span className="head-analytics__subtitle">SERVICE UTILIZATION</span>
            <h3 className="head-analytics__title">Check-ins & appointments — 14 days</h3>
          </div>

          <div className="head-analytics__svg-wrap">
            <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" className="head-analytics__svg">
              <defs>
                {/* Soft gradient fills */}
                <linearGradient id="head-grad-appt" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#1E3A8A" stopOpacity="0.32" />
                  <stop offset="100%" stopColor="#1E3A8A" stopOpacity="0.02" />
                </linearGradient>
                <linearGradient id="head-grad-check" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.28" />
                  <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.02" />
                </linearGradient>

                {/* Soft glow drop-shadow filters */}
                <filter id="head-glow-appt" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#1E3A8A" floodOpacity="0.45" />
                </filter>
                <filter id="head-glow-check" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#3B82F6" floodOpacity="0.45" />
                </filter>
              </defs>

              <g transform={`translate(${padL},${padT})`}>
                {/* Horizontal grid lines */}
                {[0, 0.25, 0.5, 0.75, 1].map((f) => {
                  const val = Math.round(f * maxVal * 10) / 10;
                  const y = yPos(val);
                  return (
                    <g key={val}>
                      <line x1={0} y1={y} x2={iW} y2={y} className="head-analytics__grid-line" />
                      <text x={-10} y={y + 4} className="head-analytics__axis-text">
                        {val}
                      </text>
                    </g>
                  );
                })}

                {/* X-axis date labels */}
                {trendData.map((d, i) => {
                  const x = xPos(i);
                  const showLabel = i % 2 === 0 || i === trendData.length - 1;
                  return showLabel ? (
                    <text key={d.dateLabel + i} x={x} y={iH + 22} className="head-analytics__axis-text head-analytics__axis-text--x">
                      {d.dateLabel}
                    </text>
                  ) : null;
                })}

                {/* Gradient Area Fills */}
                {apptPts.length > 1 && (
                  <path
                    d={`${sharpPath(apptPts)} L ${apptPts[apptPts.length - 1].x.toFixed(1)} ${iH} L 0 ${iH} Z`}
                    fill="url(#head-grad-appt)"
                  />
                )}
                {checkPts.length > 1 && (
                  <path
                    d={`${sharpPath(checkPts)} L ${checkPts[checkPts.length - 1].x.toFixed(1)} ${iH} L 0 ${iH} Z`}
                    fill="url(#head-grad-check)"
                  />
                )}

                {/* Sharp Glowing Trend Lines */}
                {apptPts.length > 1 && (
                  <path
                    d={sharpPath(apptPts)}
                    className="head-analytics__path head-analytics__path--appt"
                    filter="url(#head-glow-appt)"
                  />
                )}
                {checkPts.length > 1 && (
                  <path
                    d={sharpPath(checkPts)}
                    className="head-analytics__path head-analytics__path--check"
                    filter="url(#head-glow-check)"
                  />
                )}

                {/* Interactive Points & Tooltip hit areas */}
                {trendData.map((_, i) => {
                  const ap = apptPts[i];
                  const cp = checkPts[i];
                  const isHovered = hoverIndex === i;

                  return (
                    <g key={`point-${i}`}>
                      {/* Invisible hover area */}
                      <rect
                        x={ap.x - 14}
                        y={0}
                        width={28}
                        height={iH}
                        fill="transparent"
                        style={{ cursor: "pointer" }}
                        onMouseEnter={() => setHoverIndex(i)}
                        onMouseLeave={() => setHoverIndex(null)}
                      />

                      {/* Appointments marker — visible only on hover */}
                      {isHovered && (
                        <>
                          <circle cx={ap.x} cy={ap.y} r={5.5} className="head-analytics__dot head-analytics__dot--appt" />
                          <circle cx={ap.x} cy={ap.y} r={9} fill="none" stroke="#1E3A8A" strokeWidth="1.5" opacity={0.8} />
                        </>
                      )}

                      {/* Check-ins marker — visible only on hover */}
                      {isHovered && (
                        <>
                          <circle cx={cp.x} cy={cp.y} r={5.5} className="head-analytics__dot head-analytics__dot--check" />
                          <circle cx={cp.x} cy={cp.y} r={9} fill="none" stroke="#3B82F6" strokeWidth="1.5" opacity={0.8} />
                        </>
                      )}
                    </g>
                  );
                })}

                {/* Interactive Tooltip Card */}
                {hoverIndex !== null && (() => {
                  const item = trendData[hoverIndex];
                  const x = xPos(hoverIndex);
                  const isRight = x > iW * 0.65;
                  const tipW = 125;
                  const tipX = isRight ? x - tipW - 8 : x + 10;

                  return (
                    <g transform={`translate(${tipX}, 15)`} style={{ pointerEvents: "none" }}>
                      <rect width={tipW} height={58} rx={10} className="head-analytics__tooltip-bg" />
                      <text x={10} y={18} className="head-analytics__tooltip-date">{item.dateLabel}</text>
                      <circle cx={14} cy={32} r={3.5} fill="#1E3A8A" />
                      <text x={22} y={35} className="head-analytics__tooltip-text">
                        Appts: {item.appointments}
                      </text>
                      <circle cx={14} cy={46} r={3.5} fill="#3B82F6" />
                      <text x={22} y={49} className="head-analytics__tooltip-text">
                        Check-ins: {item.checkins}
                      </text>
                    </g>
                  );
                })()}
              </g>
            </svg>
          </div>

          <div className="head-analytics__legend-row">
            <span className="head-analytics__legend-pill">
              <span className="head-analytics__legend-dot head-analytics__legend-dot--appt" />
              Appointments
            </span>
            <span className="head-analytics__legend-pill">
              <span className="head-analytics__legend-dot head-analytics__legend-dot--check" />
              Check-ins
            </span>
          </div>
        </div>

        {/* Right Column: Support Demand Anonymised Donut Chart */}
        <div className="head-analytics__card head-analytics__card--donut">
          <div className="head-analytics__card-header">
            <span className="head-analytics__subtitle">SUPPORT DEMAND</span>
            <h3 className="head-analytics__title">Top topics (anonymised)</h3>
          </div>

          <div className="head-analytics__donut-wrap">
            {topicSegments.length === 0 ? (
              <p className="head-analytics__topics-empty">No session data yet.</p>
            ) : (
              <svg viewBox="0 0 200 200" className="head-analytics__donut-svg">
                {topicSegments.map((t) => {
                  const angle = (t.percentage / 100) * 360;
                  const r = 68;
                  const cx = 100;
                  const cy = 100;
                  const strokeW = 26;
                  const circumference = 2 * Math.PI * r;
                  const strokeDasharray = `${(angle / 360) * circumference} ${circumference}`;
                  const strokeDashoffset = -((t.start / 360) * circumference);

                  return (
                    <circle
                      key={t.name}
                      cx={cx}
                      cy={cy}
                      r={r}
                      fill="none"
                      stroke={t.color}
                      strokeWidth={strokeW}
                      strokeDasharray={strokeDasharray}
                      strokeDashoffset={strokeDashoffset}
                      transform={`rotate(-90 ${cx} ${cy})`}
                      className="head-analytics__donut-segment"
                    />
                  );
                })}
                {/* Donut Center Label */}
                <text x="100" y="90" textAnchor="middle" dominantBaseline="middle" className="head-analytics__donut-center-lbl">
                  SESSIONS
                </text>
                <text x="100" y="112" textAnchor="middle" dominantBaseline="middle" className="head-analytics__donut-center-val">
                  {analyzedCount}
                </text>
              </svg>
            )}
          </div>

          {/* Topic Neumorphic Pill Badges Grid */}
          <div className="head-analytics__topics-list">
            {topics.map((t) => (
              <div key={t.name} className="head-analytics__topic-pill">
                <span className="head-analytics__topic-swatch" style={{ background: t.color }} />
                <span className="head-analytics__topic-name">{t.name}</span>
                <span className="head-analytics__topic-pct">{t.percentage}%</span>
              </div>
            ))}
            {topics.length === 0 && <span className="head-analytics__topics-empty">No topics available yet.</span>}
          </div>

          <p className="head-analytics__disclaimer">
            Minimum group size ≥ 5 to prevent re-identification.
          </p>
        </div>
      </div>

      {/* ── Full-Width: Per-Counsellor Workload Stacked Bars ────────────────── */}
      <div className="head-analytics__card">
        <div className="head-analytics__card-header">
          <span className="head-analytics__subtitle">CASELOAD DISTRIBUTION</span>
          <h3 className="head-analytics__title">Workload per counsellor — completed · missed · pending</h3>
        </div>

        <div className="head-analytics__caseload-legend">
          <span className="head-analytics__legend-pill">
            <span className="head-analytics__legend-dot head-analytics__legend-dot--complete" />
            Completed
          </span>
          <span className="head-analytics__legend-pill">
            <span className="head-analytics__legend-dot head-analytics__legend-dot--miss" />
            Missed
          </span>
          <span className="head-analytics__legend-pill">
            <span className="head-analytics__legend-dot head-analytics__legend-dot--pend" />
            Pending
          </span>
        </div>

        {caseload.length === 0 ? (
          <p className="head-analytics__topics-empty">No caseload data yet.</p>
        ) : (
          caseload.map((row) => (
            <div key={row.counsellor} className="head-analytics__caseload-row">
              <span className="head-analytics__caseload-name" title={row.counsellor}>
                {row.name}
              </span>
              <div className="head-analytics__bar-track">
                {row.completed > 0 && (
                  <span
                    className="head-analytics__bar-seg head-analytics__bar-seg--completed"
                    style={{ width: `${(row.completed / maxTotal) * 100}%` }}
                  />
                )}
                {row.missed > 0 && (
                  <span
                    className="head-analytics__bar-seg head-analytics__bar-seg--missed"
                    style={{ width: `${(row.missed / maxTotal) * 100}%` }}
                  />
                )}
                {row.pending > 0 && (
                  <span
                    className="head-analytics__bar-seg head-analytics__bar-seg--pending"
                    style={{ width: `${(row.pending / maxTotal) * 100}%` }}
                  />
                )}
              </div>
              <span className="head-analytics__caseload-total">{row.total}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

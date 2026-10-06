import { useEffect, useState } from "react";
import { listBookingsForCounsellor } from "../../../services/firebase/bookings";
import { listFeedbackForCounsellor } from "../../../services/firebase/feedback";
import type { UserProfile } from "../../../types/user";
import "./AnalyticsSection.css";

// ── Chart constants ──────────────────────────────────────────────────────────
const CW = 540;           // SVG total width
const CH = 220;           // SVG total height
const PAD = { t: 25, r: 44, b: 36, l: 44 };
const IW = CW - PAD.l - PAD.r;  // inner width
const IH = CH - PAD.t - PAD.b;  // inner height

interface MonthPoint {
  label: string;
  completed: number;
  missed: number;
  avgRating: number | null;  // null = no data that month
}

interface Totals {
  sessions: number;
  missed: number;
  avgRating: number;
  ratingCount: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function getLastSixMonths() {
  const now = new Date();
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    return { year: d.getFullYear(), month: d.getMonth(), label: d.toLocaleString("default", { month: "short" }) };
  });
}

/** Smooth cubic-bezier SVG path through an array of {x,y} points */
function smoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return "";
  if (pts.length === 1) return `M${pts[0].x},${pts[0].y}`;
  let d = `M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i - 1];
    const c = pts[i];
    const cpx = (p.x + c.x) / 2;
    d += ` C${cpx.toFixed(1)},${p.y.toFixed(1)} ${cpx.toFixed(1)},${c.y.toFixed(1)} ${c.x.toFixed(1)},${c.y.toFixed(1)}`;
  }
  return d;
}

// ── Component ────────────────────────────────────────────────────────────────
interface StaffAnalyticsInlineProps {
  staff: UserProfile;
}

export function StaffAnalyticsInline({ staff }: StaffAnalyticsInlineProps) {
  const [monthData, setMonthData] = useState<MonthPoint[]>([]);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [loading, setLoading] = useState(true);
  const [tooltip, setTooltip] = useState<{ idx: number } | null>(null);
  const uid = `chart-${staff.uid.slice(0, 8)}`;

  useEffect(() => {
    setLoading(true);
    Promise.all([listBookingsForCounsellor(staff.uid), listFeedbackForCounsellor(staff.uid)]).then(
      ([bookings, feedback]) => {
        const months = getLastSixMonths();

        const points: MonthPoint[] = months.map(({ year, month, label }) => {
          const inMonth = bookings.filter((b) => {
            const d = new Date(b.createdAt);
            return d.getFullYear() === year && d.getMonth() === month;
          });
          const completed = inMonth.filter((b) => b.status === "completed" && b.outcome !== "missed").length;
          const missed = inMonth.filter((b) => b.status === "completed" && b.outcome === "missed").length;
          const rated = feedback.filter((f) => {
            const d = new Date(f.submittedAt);
            return d.getFullYear() === year && d.getMonth() === month;
          });
          const avgRating = rated.length > 0 ? rated.reduce((s, f) => s + f.rating, 0) / rated.length : null;
          return { label, completed, missed, avgRating };
        });

        // Overall totals (all time)
        const allTaken = bookings.filter((b) => ["accepted", "scheduled", "completed"].includes(b.status));
        const allMissed = bookings.filter((b) => b.status === "completed" && b.outcome === "missed").length;
        const avgRating = feedback.length > 0 ? feedback.reduce((s, f) => s + f.rating, 0) / feedback.length : 0;

        setMonthData(points);
        setTotals({ sessions: allTaken.length, missed: allMissed, avgRating, ratingCount: feedback.length });
        setLoading(false);
      },
    );
  }, [staff.uid]);

  if (loading) return <p className="analytics-inline__loading">Loading analytics…</p>;
  if (!totals) return null;

  // ── Chart math ─────────────────────────────────────────────────────────────
  const maxSessions = Math.max(...monthData.map((p) => p.completed + p.missed), 1);
  const xPos = (i: number) => monthData.length <= 1 ? IW / 2 : (i / (monthData.length - 1)) * IW;
  const ySession = (v: number) => IH - (v / maxSessions) * IH;
  const yRating  = (v: number) => IH - (v / 5) * IH;

  const completedPts = monthData.map((p, i) => ({ x: xPos(i), y: ySession(p.completed) }));
  // If missed count is 0, offset by 1px so it doesn't overlap identically on the baseline
  const missedPts    = monthData.map((p, i) => ({ x: xPos(i), y: ySession(p.missed) }));
  const ratingPts    = monthData
    .map((p, i) => p.avgRating !== null ? { x: xPos(i), y: yRating(p.avgRating) } : null)
    .filter(Boolean) as { x: number; y: number }[];

  const gridFracs = [0, 0.25, 0.5, 0.75, 1];

  const tip = tooltip !== null ? monthData[tooltip.idx] : null;

  return (
    <div className="analytics-inline">
      {/* ── Summary stat tiles (Vishnu Wellness Design) ────────────────────── */}
      <div className="analytics-inline__stats-grid">
        <div className="analytics-stat-card analytics-stat-card--sessions">
          <div className="analytics-stat-card__icon-wrap">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          </div>
          <div className="analytics-stat-card__data">
            <span className="analytics-stat-card__value">{totals.sessions}</span>
            <span className="analytics-stat-card__label">Total Sessions</span>
          </div>
        </div>

        <div className="analytics-stat-card analytics-stat-card--red">
          <div className="analytics-stat-card__icon-wrap">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          </div>
          <div className="analytics-stat-card__data">
            <span className="analytics-stat-card__value">{totals.missed}</span>
            <span className="analytics-stat-card__label">Missed</span>
          </div>
        </div>

        <div className="analytics-stat-card analytics-stat-card--amber">
          <div className="analytics-stat-card__icon-wrap">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          </div>
          <div className="analytics-stat-card__data">
            <div className="analytics-stat-card__rating-row">
              <span className="analytics-stat-card__value">
                {totals.ratingCount > 0 ? `${totals.avgRating.toFixed(1)} / 5` : "—"}
              </span>
            </div>
            <span className="analytics-stat-card__label">Avg Rating</span>
          </div>
        </div>
      </div>

      {/* ── Line chart ─────────────────────────────────────────────────────── */}
      <div className="analytics-chart" onClick={(e) => e.stopPropagation()}>
        {/* Legend */}
        <div className="analytics-chart__legend">
          <div className="analytics-chart__legend-item">
            <span className="analytics-chart__legend-dot analytics-chart__legend-dot--teal" />
            <span className="analytics-chart__legend-text">Completed</span>
          </div>
          <div className="analytics-chart__legend-item">
            <span className="analytics-chart__legend-dot analytics-chart__legend-dot--red" />
            <span className="analytics-chart__legend-text">Missed</span>
          </div>
          <div className="analytics-chart__legend-item">
            <span className="analytics-chart__legend-dot analytics-chart__legend-dot--amber" />
            <span className="analytics-chart__legend-text">Avg Rating (0–5)</span>
          </div>
        </div>

        <svg
          className="analytics-chart__svg"
          viewBox={`0 0 ${CW} ${CH}`}
          preserveAspectRatio="xMidYMid meet"
          aria-label={`Analytics chart for ${staff.displayName || staff.email}`}
        >
          <defs>
            {/* Teal gradient fill under completed line */}
            <linearGradient id={`${uid}-grad-c`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0D9488" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#0D9488" stopOpacity="0.01" />
            </linearGradient>
            {/* Drop shadow for tooltip */}
            <filter id={`${uid}-shadow`} x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="8" stdDeviation="10" floodColor="#0F172A" floodOpacity="0.16" />
            </filter>
          </defs>

          <g transform={`translate(${PAD.l},${PAD.t})`}>
            {/* Grid lines + axis labels */}
            {gridFracs.map((frac, i) => {
              const gy = IH * (1 - frac);
              return (
                <g key={i}>
                  <line
                    x1={0} y1={gy} x2={IW} y2={gy}
                    className="analytics-chart__grid"
                  />
                  {/* Left axis — session count */}
                  <text x={-10} y={gy + 4} className="analytics-chart__axis analytics-chart__axis--l">
                    {Math.round(maxSessions * frac)}
                  </text>
                  {/* Right axis — rating */}
                  <text x={IW + 10} y={gy + 4} className="analytics-chart__axis analytics-chart__axis--r">
                    {(5 * frac).toFixed(1)}
                  </text>
                </g>
              );
            })}

            {/* X axis month labels */}
            {monthData.map((p, i) => (
              <text key={i} x={xPos(i)} y={IH + 20} className="analytics-chart__axis analytics-chart__axis--x">
                {p.label}
              </text>
            ))}

            {/* Vertical hover line indicator (solid subtle guide) */}
            {tooltip !== null && (
              <line
                x1={completedPts[tooltip.idx].x}
                y1={0}
                x2={completedPts[tooltip.idx].x}
                y2={IH}
                stroke="#E2E8F0"
                strokeWidth={1.5}
              />
            )}

            {/* Area fill under completed line */}
            {completedPts.length > 1 && (
              <path
                d={
                  smoothPath(completedPts) +
                  ` L${completedPts[completedPts.length - 1].x.toFixed(1)},${IH} L0,${IH} Z`
                }
                fill={`url(#${uid}-grad-c)`}
              />
            )}

            {/* Completed sessions line (teal) */}
            {completedPts.length > 1 && (
              <path d={smoothPath(completedPts)} className="analytics-chart__line analytics-chart__line--teal" />
            )}

            {/* Missed sessions line (rose/red) */}
            {missedPts.length > 1 && monthData.some((p) => p.missed > 0) && (
              <path d={smoothPath(missedPts)} className="analytics-chart__line analytics-chart__line--red" />
            )}

            {/* Avg rating line (amber) */}
            {ratingPts.length > 1 && (
              <path d={smoothPath(ratingPts)} className="analytics-chart__line analytics-chart__line--amber" />
            )}

            {/* Missed dots */}
            {missedPts.map((pt, i) => (
              monthData[i].missed > 0 ? (
                <circle key={i} cx={pt.x} cy={pt.y} r={3.5}
                  className="analytics-chart__dot analytics-chart__dot--red"
                />
              ) : null
            ))}

            {/* Rating dots */}
            {ratingPts.map((pt, i) => (
              <circle key={i} cx={pt.x} cy={pt.y} r={3.5}
                className="analytics-chart__dot analytics-chart__dot--amber"
              />
            ))}

            {/* Completed dots + hover target */}
            {completedPts.map((pt, i) => (
              <g key={i}>
                {/* Invisible large hit area */}
                <rect
                  x={pt.x - 22} y={0} width={44} height={IH}
                  fill="transparent"
                  style={{ cursor: "pointer" }}
                  onMouseEnter={() => setTooltip({ idx: i })}
                  onMouseLeave={() => setTooltip(null)}
                />
                <circle
                  cx={pt.x} cy={pt.y} r={tooltip?.idx === i ? 6.5 : 4}
                  className="analytics-chart__dot analytics-chart__dot--teal"
                />
              </g>
            ))}

            {/* Tooltip Popup — Sleek Luxury Dark Floating Card */}
            {tooltip !== null && tip !== null && (() => {
              const tx = completedPts[tooltip.idx].x;
              const flipLeft = tx > IW * 0.55;
              const ttW = 154;
              const ttH = 92;
              const ttX0 = flipLeft ? tx - ttW - 14 : tx + 14;
              const ttX = Math.max(0, Math.min(ttX0, IW - ttW));
              const ttY = Math.max(0, Math.min(completedPts[tooltip.idx].y - 48, IH - ttH));

              return (
                <g transform={`translate(${ttX.toFixed(1)},${ttY.toFixed(1)})`} style={{ pointerEvents: "none" }}>
                  {/* Tooltip Card Background */}
                  <rect
                    x={0} y={0} width={ttW} height={ttH}
                    rx={12} ry={12}
                    className="analytics-chart__tooltip-bg"
                    filter={`url(#${uid}-shadow)`}
                  />

                  {/* Month Heading */}
                  <text x={16} y={22} className="analytics-chart__tooltip-month">
                    {tip.label}
                  </text>

                  {/* Completed Row */}
                  <circle cx={20} cy={38} r={4.5} fill="#0D9488" />
                  <text x={32} y={42} className="analytics-chart__tooltip-row">
                    <tspan fontWeight="700">{tip.completed}</tspan> completed
                  </text>

                  {/* Missed Row */}
                  <circle cx={20} cy={58} r={4.5} fill="#F43F5E" />
                  <text x={32} y={62} className="analytics-chart__tooltip-row">
                    <tspan fontWeight="700">{tip.missed}</tspan> missed
                  </text>

                  {/* Rating Row */}
                  <circle cx={20} cy={77} r={4.5} fill="#F59E0B" />
                  <text x={32} y={81} className="analytics-chart__tooltip-row">
                    {tip.avgRating !== null ? `${tip.avgRating.toFixed(1)}/5 rating` : "No rating"}
                  </text>
                </g>
              );
            })()}
          </g>
        </svg>
      </div>
    </div>
  );
}

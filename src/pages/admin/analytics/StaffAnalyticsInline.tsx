import { useEffect, useState } from "react";
import { listBookingsForCounsellor } from "../../../services/firebase/bookings";
import type { UserProfile } from "../../../types/user";
import { StarRating } from "../../../components/common/StarRating";
import "./AnalyticsSection.css";

// ── Chart constants ──────────────────────────────────────────────────────────
const CW = 520;           // SVG total width
const CH = 200;           // SVG total height
const PAD = { t: 20, r: 58, b: 44, l: 44 };
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
    listBookingsForCounsellor(staff.uid).then((bookings) => {
      const months = getLastSixMonths();

      const points: MonthPoint[] = months.map(({ year, month, label }) => {
        const inMonth = bookings.filter((b) => {
          const d = new Date(b.createdAt);
          return d.getFullYear() === year && d.getMonth() === month;
        });
        const completed = inMonth.filter((b) => b.status === "completed" && b.outcome !== "missed").length;
        const missed = inMonth.filter((b) => b.status === "completed" && b.outcome === "missed").length;
        const rated = inMonth.filter((b) => b.status === "completed" && b.outcome !== "missed" && b.userRatingOfCounsellor !== undefined);
        const avgRating =
          rated.length > 0
            ? rated.reduce((s, b) => s + (b.userRatingOfCounsellor ?? 0), 0) / rated.length
            : null;
        return { label, completed, missed, avgRating };
      });

      // Overall totals (all time)
      const allTaken = bookings.filter((b) => ["accepted", "scheduled", "completed"].includes(b.status));
      const allMissed = bookings.filter((b) => b.status === "completed" && b.outcome === "missed").length;
      const allRated = bookings.filter((b) => b.status === "completed" && b.outcome !== "missed" && b.userRatingOfCounsellor !== undefined);
      const avgRating =
        allRated.length > 0
          ? allRated.reduce((s, b) => s + (b.userRatingOfCounsellor ?? 0), 0) / allRated.length
          : 0;

      setMonthData(points);
      setTotals({ sessions: allTaken.length, missed: allMissed, avgRating, ratingCount: allRated.length });
      setLoading(false);
    });
  }, [staff.uid]);

  if (loading) return <p className="analytics-inline__loading">Loading analytics…</p>;
  if (!totals) return null;

  // ── Chart math ─────────────────────────────────────────────────────────────
  const maxSessions = Math.max(...monthData.map((p) => p.completed + p.missed), 1);
  const xPos = (i: number) => monthData.length <= 1 ? IW / 2 : (i / (monthData.length - 1)) * IW;
  const ySession = (v: number) => IH - (v / maxSessions) * IH;
  const yRating  = (v: number) => IH - (v / 5) * IH;

  const completedPts = monthData.map((p, i) => ({ x: xPos(i), y: ySession(p.completed) }));
  const missedPts    = monthData.map((p, i) => ({ x: xPos(i), y: ySession(p.missed) }));
  const ratingPts    = monthData
    .map((p, i) => p.avgRating !== null ? { x: xPos(i), y: yRating(p.avgRating) } : null)
    .filter(Boolean) as { x: number; y: number }[];

  const gridFracs = [0, 0.25, 0.5, 0.75, 1];

  const tip = tooltip !== null ? monthData[tooltip.idx] : null;

  return (
    <div className="analytics-inline">
      {/* ── Summary stat tiles ─────────────────────────────────────────────── */}
      <div className="analytics-inline__stats-row">
        <div className="analytics-inline__stat">
          <span className="analytics-inline__stat-value">{totals.sessions}</span>
          <span className="analytics-inline__stat-label">Sessions</span>
        </div>
        <div className="analytics-inline__stat">
          <span className="analytics-inline__stat-value analytics-inline__stat-value--red">{totals.missed}</span>
          <span className="analytics-inline__stat-label">Missed</span>
        </div>
        <div className="analytics-inline__stat">
          {totals.ratingCount > 0 ? (
            <StarRating value={totals.avgRating} size="large" />
          ) : (
            <span className="analytics-inline__stat-value">—</span>
          )}
          <span className="analytics-inline__stat-label">Avg Rating</span>
        </div>
      </div>

      {/* ── Line chart ─────────────────────────────────────────────────────── */}
      <div className="analytics-chart" onClick={(e) => e.stopPropagation()}>
        {/* Legend */}
        <div className="analytics-chart__legend">
          <span className="analytics-chart__legend-dot analytics-chart__legend-dot--blue" />
          <span className="analytics-chart__legend-text">Completed</span>
          <span className="analytics-chart__legend-dot analytics-chart__legend-dot--red" />
          <span className="analytics-chart__legend-text">Missed</span>
          <span className="analytics-chart__legend-dot analytics-chart__legend-dot--amber" />
          <span className="analytics-chart__legend-text">Avg Rating (0–5)</span>
        </div>

        <svg
          className="analytics-chart__svg"
          viewBox={`0 0 ${CW} ${CH}`}
          preserveAspectRatio="xMidYMid meet"
          aria-label={`Analytics chart for ${staff.displayName || staff.email}`}
        >
          <defs>
            {/* Blue gradient fill under completed line */}
            <linearGradient id={`${uid}-grad-c`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2563EB" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#2563EB" stopOpacity="0" />
            </linearGradient>
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
                  <text x={-8} y={gy + 4} className="analytics-chart__axis analytics-chart__axis--l">
                    {Math.round(maxSessions * frac)}
                  </text>
                  {/* Right axis — rating */}
                  <text x={IW + 8} y={gy + 4} className="analytics-chart__axis analytics-chart__axis--r">
                    {(5 * frac).toFixed(1)}
                  </text>
                </g>
              );
            })}

            {/* X axis month labels */}
            {monthData.map((p, i) => (
              <text key={i} x={xPos(i)} y={IH + 18} className="analytics-chart__axis analytics-chart__axis--x">
                {p.label}
              </text>
            ))}

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

            {/* Completed sessions line (blue) */}
            {completedPts.length > 1 && (
              <path d={smoothPath(completedPts)} className="analytics-chart__line analytics-chart__line--blue" />
            )}

            {/* Missed sessions line (red) */}
            {missedPts.length > 1 && (
              <path d={smoothPath(missedPts)} className="analytics-chart__line analytics-chart__line--red" />
            )}

            {/* Avg rating line (amber) */}
            {ratingPts.length > 1 && (
              <path d={smoothPath(ratingPts)} className="analytics-chart__line analytics-chart__line--amber" />
            )}

            {/* Completed dots + hover target */}
            {completedPts.map((pt, i) => (
              <g key={i}>
                {/* Invisible large hit area */}
                <rect
                  x={pt.x - 16} y={0} width={32} height={IH}
                  fill="transparent"
                  style={{ cursor: "pointer" }}
                  onMouseEnter={() => setTooltip({ idx: i })}
                  onMouseLeave={() => setTooltip(null)}
                />
                <circle
                  cx={pt.x} cy={pt.y} r={tooltip?.idx === i ? 6 : 4}
                  className="analytics-chart__dot analytics-chart__dot--blue"
                />
              </g>
            ))}

            {/* Missed dots */}
            {missedPts.map((pt, i) => (
              <circle key={i} cx={pt.x} cy={pt.y} r={3}
                className="analytics-chart__dot analytics-chart__dot--red"
              />
            ))}

            {/* Rating dots */}
            {ratingPts.map((pt, i) => (
              <circle key={i} cx={pt.x} cy={pt.y} r={3}
                className="analytics-chart__dot analytics-chart__dot--amber"
              />
            ))}

            {/* Tooltip */}
            {tooltip !== null && tip !== null && (() => {
              const tx = completedPts[tooltip.idx].x;
              // Flip tooltip to the left when near the right edge
              const flipLeft = tx > IW * 0.65;
              const ttW = 138;
              const ttX = flipLeft ? tx - ttW - 10 : tx + 12;
              const ttY = Math.min(completedPts[tooltip.idx].y - 10, IH - 78);
              return (
                <g transform={`translate(${ttX},${ttY})`} style={{ pointerEvents: "none" }}>
                  <rect rx={10} ry={10} width={ttW} height={74}
                    className="analytics-chart__tooltip-bg"
                  />
                  <text x={12} y={20} className="analytics-chart__tooltip-month">{tip.label}</text>
                  <circle cx={12} cy={36} r={4} className="analytics-chart__dot analytics-chart__dot--blue" />
                  <text x={22} y={40} className="analytics-chart__tooltip-row">
                    {tip.completed} completed
                  </text>
                  <circle cx={12} cy={52} r={4} className="analytics-chart__dot analytics-chart__dot--red" />
                  <text x={22} y={56} className="analytics-chart__tooltip-row">
                    {tip.missed} missed
                  </text>
                  <circle cx={12} cy={68} r={4} className="analytics-chart__dot analytics-chart__dot--amber" />
                  <text x={22} y={72} className="analytics-chart__tooltip-row">
                    {tip.avgRating !== null ? `⭐ ${tip.avgRating.toFixed(1)}` : "No rating"}
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

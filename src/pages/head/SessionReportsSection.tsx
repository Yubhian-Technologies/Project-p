import { useEffect, useState, useMemo, useCallback } from "react";
import { listBookingsForCounsellor } from "../../services/firebase/bookings";
import { listAttendance } from "../../services/firebase/attendance";
import { listBookableProfiles } from "../../services/firebase/bookings";
import { listColleges } from "../../services/firebase/colleges";
import { useAuth } from "../../hooks/useAuth";
import type { UserProfile } from "../../types/user";
import { Button } from "../../components/common/Button";
import { Select } from "../../components/common/Select";
import { ROLE_LABELS } from "../../config/roles";
import "./SessionReportsSection.css";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function istDateKey(ms: number): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date(ms));
  const p = (t: string) => parts.find(x => x.type === t)?.value ?? "";
  return `${p("year")}-${p("month")}-${p("day")}`;
}

interface WeekData {
  sessions: number;
  leaveDays: number;
  weekdaysInWeek: number;
}

interface PersonReport {
  profile: UserProfile;
  weeks: WeekData[];
  monthTotal: number;
}

function getWeekOfMonth(dateKey: string): number {
  const [, , day] = dateKey.split("-").map(Number);
  if (day <= 7) return 0;
  if (day <= 14) return 1;
  if (day <= 21) return 2;
  if (day <= 28) return 3;
  return 4;
}

function getWeekday(dateKey: string): number {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

function isWeekday(day: number): boolean {
  return day >= 1 && day <= 5;
}

function getWeekDateRange(weekIdx: number, year: number, month: number): { start: number; end: number } {
  const starts = [1, 8, 15, 22, 29];
  const start = starts[weekIdx];
  const end = weekIdx === 4 ? new Date(Date.UTC(year, month, 0)).getUTCDate() : start + 6;
  return { start, end };
}

export function SessionReportsSection() {
  const { profile: headProfile } = useAuth();
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [collegeMap, setCollegeMap] = useState<Map<string, string>>(new Map());
  const [selectedMonth, setSelectedMonth] = useState("");
  const [reports, setReports] = useState<PersonReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    // listBookableProfiles() returns staff platform-wide — attendance reads
    // are campus-scoped by Firestore rules, so pulling in another campus's
    // counsellor/head here would make the whole report fail to load with a
    // permission error instead of just skipping that one person.
    if (!headProfile?.campusId) return;
    listBookableProfiles().then(list => {
      setProfiles(list.filter(p =>
        (p.role === "counsellor" || p.role === "head") && p.campusId === headProfile.campusId
      ));
    });
    listColleges(headProfile.campusId).then(list => {
      setCollegeMap(new Map(list.map(c => [c.id, c.name])));
    });
  }, [headProfile?.campusId]);

  const availableMonths = useMemo(() => {
    const months: string[] = [];
    const now = new Date();
    const startYear = 2026;
    const startMonth = 7; // August (0-indexed)
    const endYear = now.getFullYear();
    const endMonth = now.getMonth();

    for (let y = startYear; y <= endYear; y++) {
      const startM = y === startYear ? startMonth : 0;
      const endM = y === endYear ? endMonth : 11;
      for (let m = startM; m <= endM; m++) {
        months.push(`${y}-${String(m + 1).padStart(2, "0")}`);
      }
    }
    return months.reverse(); // newest first
  }, []);

  const loadReport = useCallback(async (month: string) => {
    if (!month) return;
    setLoading(true);
    setError("");

    try {
      const [yearStr, monthStr] = month.split("-");
      const year = Number(yearStr);
      const monthIdx = Number(monthStr) - 1;

      const personReports: PersonReport[] = await Promise.all(
        profiles.map(async (profile) => {
          const bookings = await listBookingsForCounsellor(profile.uid);
          const attendance = await listAttendance(profile.uid, profile.campusId ?? "");

          const attendanceMap = new Map(attendance.map(a => [a.date, a]));

          const weeks: WeekData[] = Array.from({ length: 5 }, () => ({
            sessions: 0, leaveDays: 0, weekdaysInWeek: 0,
          }));

          const monthStart = new Date(Date.UTC(year, monthIdx, 1));
          const monthEnd = new Date(Date.UTC(year, monthIdx + 1, 0));
          const monthStartKey = istDateKey(monthStart.getTime());
          const monthEndKey = istDateKey(monthEnd.getTime());

          const profileCreatedKey = profile.createdAt ? istDateKey(profile.createdAt) : null;

          bookings.forEach(b => {
            if (b.status !== "completed" || b.outcome === "missed") return;
            const bKey = istDateKey(b.createdAt);
            if (bKey < monthStartKey || bKey > monthEndKey) return;
            if (profileCreatedKey && bKey < profileCreatedKey) return;
            const week = getWeekOfMonth(bKey);
            weeks[week].sessions += 1;
          });

          attendanceMap.forEach((rec, dateKey) => {
            if (dateKey < monthStartKey || dateKey > monthEndKey) return;
            if (profileCreatedKey && dateKey < profileCreatedKey) return;
            const wd = getWeekday(dateKey);
            if (!isWeekday(wd)) return;
            const week = getWeekOfMonth(dateKey);
            weeks[week].weekdaysInWeek += 1;

            const wasOnLeave = profile.available === false ||
              (profile.available === true && (!rec.checkInAt || rec.checkInAt === 0));
            if (wasOnLeave) weeks[week].leaveDays += 1;
          });

          for (let w = 0; w < 5; w++) {
            const { start, end } = getWeekDateRange(w, year, monthIdx);
            let weekdays = 0;
            for (let d = start; d <= end; d++) {
              const key = `${year}-${String(monthIdx + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
              if (isWeekday(getWeekday(key))) weekdays++;
            }
            weeks[w].weekdaysInWeek = weekdays;
          }

          const monthTotal = weeks.reduce((sum, w) => sum + w.sessions, 0);
          return { profile, weeks, monthTotal };
        })
      );

      setReports(personReports);
    } catch (err) {
      console.error("Report load failed:", err);
      setError("Failed to load report. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [profiles]);

  function handleMonthChange(month: string) {
    setSelectedMonth(month);
    setReports([]);
    if (month) loadReport(month);
  }


  function formatCell(report: PersonReport, weekIdx: number): string {
    const w = report.weeks[weekIdx];
    if (w.leaveDays >= w.weekdaysInWeek && w.weekdaysInWeek > 0) return "Long leave";
    if (w.sessions === 0 && w.leaveDays === 0) return "0";
    if (w.leaveDays > 0) return `${w.sessions} + ${w.leaveDays} leave`;
    return String(w.sessions);
  }

  function renderCellContent(report: PersonReport, weekIdx: number) {
    const w = report.weeks[weekIdx];
    if (w.leaveDays >= w.weekdaysInWeek && w.weekdaysInWeek > 0) {
      return <span className="session-cell-pill session-cell-pill--leave">Long leave</span>;
    }
    if (w.sessions === 0 && w.leaveDays === 0) {
      return <span className="session-cell-zero">0</span>;
    }
    if (w.leaveDays > 0) {
      return (
        <div className="session-cell-composite">
          <span className="session-cell-num session-cell-num--active">{w.sessions}</span>
          <span className="session-cell-pill session-cell-pill--leave">+{w.leaveDays} leave</span>
        </div>
      );
    }
    return (
      <span className="session-cell-num session-cell-num--active">
        {w.sessions}
      </span>
    );
  }

  function weekTotal(weekIdx: number): number {
    return reports.reduce((sum, r) => sum + r.weeks[weekIdx].sessions, 0);
  }

  function grandTotal(): number {
    return reports.reduce((sum, r) => sum + r.monthTotal, 0);
  }

  const [yearStr, monthStr] = (selectedMonth || "").split("-");
  const reportYear = Number(yearStr) || 2026;
  const reportMonthIdx = (Number(monthStr) || 8) - 1;

  function downloadCSV() {
    if (!selectedMonth || reports.length === 0) return;

    const monthName = MONTHS[reportMonthIdx];

    const headers = ["Week", ...reports.map(r => `${r.profile.displayName || r.profile.email} (${r.profile.collegeId ? collegeMap.get(r.profile.collegeId) || "College" : "N/A"})`), "Total"];
    const rows = [
      ["Week 1", ...reports.map(r => formatCell(r, 0)), String(weekTotal(0))],
      ["Week 2", ...reports.map(r => formatCell(r, 1)), String(weekTotal(1))],
      ["Week 3", ...reports.map(r => formatCell(r, 2)), String(weekTotal(2))],
      ["Week 4", ...reports.map(r => formatCell(r, 3)), String(weekTotal(3))],
      ["Week 5", ...reports.map(r => formatCell(r, 4)), String(weekTotal(4))],
      ["Monthly Total", ...reports.map(r => String(r.monthTotal)), String(grandTotal())],
    ];

    const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `session-report-${monthName}-${reportYear}.csv`;
    link.click();
  }

  return (
    <div className="session-reports">
      {/* ── Worksheet Filters Bar ─────────────────────────────── */}
      <div className="session-reports__filters">
        <div className="session-reports__filter-field">
          <label htmlFor="report-month">Select Month</label>
          <Select id="report-month" value={selectedMonth} onChange={handleMonthChange}>
            <option value="" disabled>Select a month…</option>
            {availableMonths.map((m) => {
              const [y, mo] = m.split("-");
              return <option key={m} value={m}>{MONTHS[Number(mo) - 1]} {y}</option>;
            })}
          </Select>
        </div>

        {selectedMonth && (
          <Button
            type="button"
            variant="outlined"
            className="session-reports__btn-export"
            onClick={downloadCSV}
            disabled={loading || reports.length === 0}
          >
            Download CSV
          </Button>
        )}
      </div>

      {!selectedMonth && (
        <p className="session-reports__intro">
          Select a month above to view and analyze campus session activity.
        </p>
      )}

      {error && <p className="session-reports__error">{error}</p>}
      {loading && <p className="session-reports__loading">Loading campus session report…</p>}

      {!loading && !error && selectedMonth && reports.length > 0 && (
        <>
          {/* ── KPI Summary Cards ─────────────── */}
          <div className="session-reports__kpi-grid">
            <div className="session-kpi-card">
              <span className="session-kpi-card__label">Total Campus Sessions</span>
              <span className="session-kpi-card__value">{grandTotal()}</span>
            </div>

            <div className="session-kpi-card">
              <span className="session-kpi-card__label">Active Staff</span>
              <span className="session-kpi-card__value">{reports.length}</span>
            </div>

            <div className="session-kpi-card">
              <span className="session-kpi-card__label">Avg / Staff</span>
              <span className="session-kpi-card__value">
                {reports.length > 0 ? (grandTotal() / reports.length).toFixed(1) : "0"}
              </span>
            </div>
          </div>

          {/* ── Excel-style Worksheet Table ─────────────── */}
          <div className="session-reports__table-wrap">
            <table className="session-reports__table">
              <thead>
                <tr>
                  <th colSpan={reports.length + 2} className="session-reports__title-bar">
                    Campus Session Report — {MONTHS[reportMonthIdx]} {reportYear}
                  </th>
                </tr>
                <tr>
                  <th className="session-reports__th--timeline">Timeline (Weekly)</th>
                  {reports.map((r) => {
                    const collegeName = r.profile.collegeId ? collegeMap.get(r.profile.collegeId) : null;
                    const staffName = r.profile.displayName || r.profile.email;
                    return (
                      <th key={r.profile.uid} className="session-reports__th--staff">
                        <div className="session-staff-header">
                          <span className="session-staff-name">{staffName}</span>
                          {collegeName && <span className="session-staff-sub">{collegeName}</span>}
                          <span className="session-staff-role">{ROLE_LABELS[r.profile.role]}</span>
                        </div>
                      </th>
                    );
                  })}
                  <th className="session-reports__th--total">Weekly Total</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 5 }).map((_, w) => {
                  const { start, end } = getWeekDateRange(w, reportYear, reportMonthIdx);
                  const mName = MONTHS[reportMonthIdx];
                  return (
                    <tr key={w}>
                      <td className="session-timeline-cell">
                        <span className="session-week-title">Week {w + 1}</span>
                        <span className="session-week-sub">({mName} {start}–{end})</span>
                      </td>
                      {reports.map((r) => (
                        <td key={r.profile.uid} className="session-data-cell">
                          {renderCellContent(r, w)}
                        </td>
                      ))}
                      <td className="session-week-total-cell">
                        {weekTotal(w)}
                      </td>
                    </tr>
                  );
                })}

                {/* Monthly Total Summary Row */}
                <tr className="session-total-row">
                  <td className="session-timeline-cell">
                    <strong>Monthly Total</strong>
                  </td>
                  {reports.map((r) => (
                    <td key={r.profile.uid} className="session-data-cell">
                      <strong>{r.monthTotal}</strong>
                    </td>
                  ))}
                  <td className="session-grand-total-cell">
                    <strong>{grandTotal()}</strong>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
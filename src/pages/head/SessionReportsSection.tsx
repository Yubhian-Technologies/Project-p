import { useEffect, useState, useMemo } from "react";
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
    listBookableProfiles().then(list => {
      setProfiles(list.filter(p =>
        (p.role === "counsellor" || p.role === "head") && !!p.campusId
      ));
    });
    if (headProfile?.campusId) {
      listColleges(headProfile.campusId).then(list => {
        setCollegeMap(new Map(list.map(c => [c.id, c.name])));
      });
    }
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

  async function loadReport() {
    if (!selectedMonth) return;
    setLoading(true);
    setError("");

    try {
      const [yearStr, monthStr] = selectedMonth.split("-");
      const year = Number(yearStr);
      const month = Number(monthStr) - 1;

      const personReports: PersonReport[] = await Promise.all(
        profiles.map(async (profile) => {
          const bookings = await listBookingsForCounsellor(profile.uid);
          const attendance = await listAttendance(profile.uid, profile.campusId ?? "");

          const attendanceMap = new Map(attendance.map(a => [a.date, a]));

          const weeks: WeekData[] = Array.from({ length: 5 }, () => ({
            sessions: 0, leaveDays: 0, weekdaysInWeek: 0,
          }));

          const monthStart = new Date(Date.UTC(year, month, 1));
          const monthEnd = new Date(Date.UTC(year, month + 1, 0));
          const monthStartKey = istDateKey(monthStart.getTime());
          const monthEndKey = istDateKey(monthEnd.getTime());

          // Profile creation date - ignore any data before login was created
          const profileCreatedKey = profile.createdAt ? istDateKey(profile.createdAt) : null;

          bookings.forEach(b => {
            if (b.status !== "completed" || b.outcome === "missed") return;
            const bKey = istDateKey(b.createdAt);
            if (bKey < monthStartKey || bKey > monthEndKey) return;
            if (profileCreatedKey && bKey < profileCreatedKey) return; // before login creation
            const week = getWeekOfMonth(bKey);
            weeks[week].sessions += 1;
          });

          attendanceMap.forEach((rec, dateKey) => {
            if (dateKey < monthStartKey || dateKey > monthEndKey) return;
            if (profileCreatedKey && dateKey < profileCreatedKey) return; // before login creation
            const wd = getWeekday(dateKey);
            if (!isWeekday(wd)) return;
            const week = getWeekOfMonth(dateKey);
            weeks[week].weekdaysInWeek += 1;

            const wasOnLeave = profile.available === false ||
              (profile.available === true && (!rec.checkInAt || rec.checkInAt === 0));
            if (wasOnLeave) weeks[week].leaveDays += 1;
          });

          for (let w = 0; w < 5; w++) {
            const { start, end } = getWeekDateRange(w, year, month);
            let weekdays = 0;
            for (let d = start; d <= end; d++) {
              const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
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
  }

  function handleMonthChange(month: string) {
    setSelectedMonth(month);
    setReports([]);
  }

  useEffect(() => {
    if (selectedMonth) loadReport();
  }, [selectedMonth]);

  function formatCell(report: PersonReport, weekIdx: number): string {
    const w = report.weeks[weekIdx];
    if (w.leaveDays >= w.weekdaysInWeek && w.weekdaysInWeek > 0) return "Long leave";
    if (w.sessions === 0 && w.leaveDays === 0) return "0";
    if (w.leaveDays > 0) return `${w.sessions} + ${w.leaveDays} leave`;
    return String(w.sessions);
  }

  function weekTotal(weekIdx: number): number {
    return reports.reduce((sum, r) => sum + r.weeks[weekIdx].sessions, 0);
  }

  function grandTotal(): number {
    return reports.reduce((sum, r) => sum + r.monthTotal, 0);
  }

  function downloadCSV() {
    if (!selectedMonth || reports.length === 0) return;

    const [yearStr, monthStr] = selectedMonth.split("-");
    const monthName = MONTHS[Number(monthStr) - 1];

    const headers = ["Week", ...reports.map(r => `${r.profile.displayName || r.profile.email} (${r.profile.collegeId ? "College" : "N/A"})`), "Total"];
    const rows = [
      ["Week 1", ...reports.map(r => formatCell(r, 0)), String(weekTotal(0))],
      ["Week 2", ...reports.map(r => formatCell(r, 1)), String(weekTotal(1))],
      ["Week 3", ...reports.map(r => formatCell(r, 2)), String(weekTotal(2))],
      ["Week 4", ...reports.map(r => formatCell(r, 3)), String(weekTotal(3))],
      ["Week 5", ...reports.map(r => formatCell(r, 4)), String(weekTotal(4))],
      ["Month Total", ...reports.map(r => String(r.monthTotal)), String(grandTotal())],
    ];

    const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `session-report-${monthName}-${yearStr}.csv`;
    link.click();
  }

  if (!selectedMonth) {
    return (
      <div className="session-reports">
        <div className="session-reports__header">
          <label className="session-reports__month-label" htmlFor="report-month">Select Month</label>
          <Select id="report-month" value={selectedMonth} onChange={handleMonthChange}>
            <option value="" disabled>Select a month…</option>
            {availableMonths.map(m => {
              const [y, mo] = m.split("-");
              return <option key={m} value={m}>{MONTHS[Number(mo) - 1]} {y}</option>;
            })}
          </Select>
        </div>
        <p className="session-reports__hint">Select a month to generate the session report for your campus.</p>
      </div>
    );
  }

  return (
    <div className="session-reports">
      <div className="session-reports__header">
        <div>
          <label className="session-reports__month-label" htmlFor="report-month">Month</label>
          <Select id="report-month" value={selectedMonth} onChange={handleMonthChange}>
            <option value="" disabled>Select a month…</option>
            {availableMonths.map(m => {
              const [y, mo] = m.split("-");
              return <option key={m} value={m}>{MONTHS[Number(mo) - 1]} {y}</option>;
            })}
          </Select>
        </div>
        <Button type="button" variant="outlined" onClick={downloadCSV} disabled={loading}>
          Download CSV
        </Button>
      </div>

      {error && <p className="session-reports__error">{error}</p>}
      {loading && <p className="session-reports__loading">Loading report…</p>}

      {!loading && !error && (
        <div className="session-reports__table-wrap">
          <table className="session-reports__table">
            <thead>
              <tr>
                <th className="session-reports__th--sticky">Week</th>
                {reports.map((r) => {
                  const collegeName = r.profile.collegeId ? collegeMap.get(r.profile.collegeId) : null;
                  return (
                    <th key={r.profile.uid} className="session-reports__th">
                      <span className="session-reports__name">{r.profile.displayName || r.profile.email}</span>
                      <span className="session-reports__college">{collegeName ? `(${collegeName})` : ""}</span>
                      <span className="session-reports__role">{ROLE_LABELS[r.profile.role]}</span>
                    </th>
                  );
                })}
                <th className="session-reports__th--total">Total</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 5 }).map((_, w) => (
                <tr key={w} className={w === 4 ? "session-reports__month-total" : ""}>
                  <td className="session-reports__week-label">
                    {w === 4 ? "Month Total" : `Week ${w + 1}`}
                  </td>
{reports.map((r) => (
                    <td key={r.profile.uid} className="session-reports__cell">
                      {formatCell(r, w)}
                    </td>
                  ))}
                  <td className="session-reports__total-cell">
                    {weekTotal(w)}
                  </td>
                </tr>
              ))}
              <tr className="session-reports__grand-total">
                <td className="session-reports__grand-label">Grand Total</td>
                {reports.map((r) => (
                  <td key={r.profile.uid} className="session-reports__grand-cell">{r.monthTotal}</td>
                ))}
                <td className="session-reports__grand-total-cell">{grandTotal()}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
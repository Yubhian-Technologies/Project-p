import { useEffect, useState } from "react";
import {
  listMonthlyReports,
  type MonthlyReport,
} from "../../services/firebase/monthlyReports";
import { listCampuses } from "../../services/firebase/campuses";
import type { Campus } from "../../types/campus";
import { Button } from "../../components/common/Button";
import {
  TrendingUpIcon,
  RefreshIcon,
  FolderOpenIcon,
  BuildingIcon,
  CheckCircleIcon,
  AlertCircleIcon,
  FileTextIcon,
  MapPinIcon,
  CalendarIcon,
} from "../../components/common/icons";
import "./AdminHomeActivityOverview.css";

interface AdminHomeActivityOverviewProps {
  onSelectSection: (sectionId: string) => void;
}

export function AdminHomeActivityOverview({ onSelectSection }: AdminHomeActivityOverviewProps) {
  const [monthlyReports, setMonthlyReports] = useState<MonthlyReport[]>([]);
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadData() {
    setLoading(true);
    try {
      const [reports, campusList] = await Promise.all([listMonthlyReports(), listCampuses()]);
      setMonthlyReports(reports);
      setCampuses(campusList);
    } catch (err) {
      console.error("Failed to load admin home activity", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const periodLabel = now.toLocaleString("en-IN", { month: "long", year: "numeric" });

  const reportsThisMonth = monthlyReports.filter(
    (r) => r.month === currentMonth && r.year === currentYear,
  );

  const submittedCampusIds = new Set(
    reportsThisMonth.map((r) => r.campusId).filter((id): id is string => Boolean(id)),
  );
  const submittedCount = campuses.filter((c) => submittedCampusIds.has(c.id)).length;
  const pendingCount = campuses.length - submittedCount;
  const totalReports = monthlyReports.length;
  const collegesCovered = new Set(monthlyReports.map((r) => r.collegeId).filter(Boolean)).size;

  const campusRows = campuses
    .map((campus) => {
      const campusReports = monthlyReports.filter((r) => r.campusId === campus.id);
      const lastUpload = campusReports.reduce((max, r) => {
        const t = new Date(r.uploadedAt).getTime();
        return Number.isNaN(t) ? max : Math.max(max, t);
      }, 0);
      return {
        campus,
        reportCount: campusReports.length,
        submitted: submittedCampusIds.has(campus.id),
        lastUpload,
      };
    })
    .sort(
      (a, b) =>
        Number(b.submitted) - Number(a.submitted) ||
        b.reportCount - a.reportCount ||
        a.campus.name.localeCompare(b.campus.name),
    );

  const kpis = [
    { label: "Total Campuses", value: campuses.length, icon: BuildingIcon, color: "#2563EB", bg: "#DBEAFE" },
    { label: `Submitted (${periodLabel})`, value: submittedCount, icon: CheckCircleIcon, color: "#15803D", bg: "#DCFCE7" },
    { label: "Campuses Pending", value: pendingCount, icon: AlertCircleIcon, color: "#D97706", bg: "#FFFBEB" },
    { label: "Total Reports Uploaded", value: totalReports, icon: FileTextIcon, color: "#0D9488", bg: "#CCFBF1" },
    { label: "Colleges Covered", value: collegesCovered, icon: MapPinIcon, color: "#5A61C0", bg: "#EDE9FE" },
    { label: `Reports This Period`, value: reportsThisMonth.length, icon: CalendarIcon, color: "#1E3A8A", bg: "#E0E7FF" },
  ];

  return (
    <div className="aha-overview">
      {/* ── Header Bar ────────────────────────────────────────── */}
      <div className="aha-header">
        <div>
          <h3 className="aha-header__title">
            <TrendingUpIcon />
            <span>System Activity & Submission Analysis</span>
          </h3>
          <p className="aha-header__sub">
            Campus-wise monthly report submission analysis across the platform.
          </p>
        </div>
        <Button type="button" variant="outlined" onClick={loadData}>
          <RefreshIcon /> Refresh Activity
        </Button>
      </div>

      {/* ── Main Bento Grid ───────────────────────────────────── */}
      <div className="aha-grid">
        <div className="aha-card aha-card--main">
          <div className="aha-card__header">
            <div className="aha-card__title-wrap">
              <span className="aha-card__icon"><FolderOpenIcon /></span>
              <div>
                <h4 className="aha-card__title">Head Monthly Reports Submitted</h4>
                <span className="aha-card__subtitle">
                  Which campuses shared their reports for {periodLabel} — and which haven't yet.
                </span>
              </div>
            </div>
            <span className="aha-badge aha-badge--blue">
              {loading ? "…" : `${submittedCount} / ${campuses.length} Campuses Submitted`}
            </span>
          </div>

          {loading ? (
            <p className="aha-loading">Loading campus submission analysis…</p>
          ) : (
            <>
              {/* ── KPI Row ─────────────────────────────────────── */}
              <div className="aha-kpis">
                {kpis.map((kpi) => (
                  <div key={kpi.label} className="aha-kpi">
                    <span className="aha-kpi__icon" style={{ background: kpi.bg, color: kpi.color }}>
                      <kpi.icon />
                    </span>
                    <div>
                      <strong className="aha-kpi__value">{kpi.value}</strong>
                      <span className="aha-kpi__label">{kpi.label}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* ── Per-Campus Breakdown ───────────────────────── */}
              {campuses.length === 0 ? (
                <div className="aha-empty">
                  <p>No campuses defined yet.</p>
                </div>
              ) : monthlyReports.length === 0 ? (
                <div className="aha-empty">
                  <p>No monthly reports uploaded by department heads yet.</p>
                </div>
              ) : (
                <div className="aha-table-wrap">
                  <table className="aha-table">
                    <thead>
                      <tr>
                        <th>Campus</th>
                        <th>Status ({periodLabel})</th>
                        <th>Reports Uploaded</th>
                        <th>Last Upload</th>
                      </tr>
                    </thead>
                    <tbody>
                      {campusRows.map(({ campus, reportCount, submitted, lastUpload }) => (
                        <tr key={campus.id}>
                          <td className="aha-table__campus">
                            <BuildingIcon />
                            {campus.name}
                          </td>
                          <td>
                            <span className={`aha-table__tag aha-table__tag--${submitted ? "submitted" : "pending"}`}>
                              {submitted ? "✓ Submitted" : "Pending"}
                            </span>
                          </td>
                          <td>{reportCount}</td>
                          <td>
                            {lastUpload > 0
                              ? new Date(lastUpload).toLocaleDateString("en-IN")
                              : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          <div className="aha-card__footer">
            <button
              type="button"
              className="aha-link-btn"
              onClick={() => onSelectSection("monthly-reports")}
            >
              Open Monthly Reports Section →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
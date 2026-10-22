import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { listCampuses } from "../../services/firebase/campuses";
import { listAllBookingsForStats } from "../../services/firebase/bookings";
import { listEventsForCampus } from "../../services/firebase/events";
import { listSsiCollegeResultsForCampus, type SsiCollegeResult } from "../../services/firebase/ssiCollegeResults";
import { subscribeToAdminSeriousCases } from "../../services/firebase/seriousCases";
import { listCampusLogins } from "../../services/firebase/firestore";
import { listWorksheetAcademicYears, listWorksheets } from "../../services/firebase/worksheets";
import { listMonthlyReports, type MonthlyReport } from "../../services/firebase/monthlyReports";
import type { Campus } from "../../types/campus";
import type { Booking } from "../../types/booking";
import type { EventProgram } from "../../types/event";
import type { SeriousCase } from "../../types/seriousCase";
import type { UserProfile } from "../../types/user";
import type { Worksheet } from "../../types/worksheet";
import { formatDateDMY, formatDateTimeDMY } from "../../utils/formatDate";
import { Button } from "../../components/common/Button";
import { Modal } from "../../components/common/Modal";
import { Select } from "../../components/common/Select";
import {
  TrendingUpIcon,
  RefreshIcon,
  FolderOpenIcon,
  BuildingIcon,
  CheckCircleIcon,
  AlertCircleIcon,
  FileTextIcon,
  CalendarIcon,
  UsersIcon,
  AlertTriangleIcon,
  ClipboardListIcon,
} from "../../components/common/icons";
import "./ManagementHomeOverview.css";

interface ManagementHomeOverviewProps {
  onSelectSection: (sectionId: string) => void;
}

interface CampusStats {
  campus: Campus;
  totalBookings: number;
  completedSessions: number;
  groupSessionsCount: number;
  eventsCount: number;
  ssiTotal: number;
  ssiSevere: number;
  ssiModerate: number;
  ssiNormal: number;
  counsellorsCount: number;
  worksheetsCount: number;
  criticalCasesCount: number;
  criticalSosCount: number;
  criticalSevereCount: number;
  criticalResolvedCount: number;
  criticalPendingCount: number;
  reportSubmittedThisMonth: boolean;
  reportsUploadedCount: number;
  lastReportUpload: number;
}

export function ManagementHomeOverview({ onSelectSection }: ManagementHomeOverviewProps) {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<"month" | "all">("month");
  const [selectedCampusId, setSelectedCampusId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [campusStats, setCampusStats] = useState<CampusStats[]>([]);
  const [seriousCases, setSeriousCases] = useState<SeriousCase[]>([]);
  const [monthlyReports, setMonthlyReports] = useState<MonthlyReport[]>([]);
  const [allEvents, setAllEvents] = useState<{ event: EventProgram; campusName: string }[]>([]);

  // Modals for drill down
  const [activeModal, setActiveModal] = useState<
    "group-sessions" | "critical-cases" | "counsellors" | "events" | "ssi" | null
  >(null);

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const periodLabel = now.toLocaleString("en-IN", { month: "long", year: "numeric" });

  const scopedCampusIds =
    profile?.role === "admin" && profile.adminAccess?.scope === "campuses"
      ? (profile.adminAccess.campusIds ?? [])
      : null;

  async function loadAllData() {
    setLoading(true);
    try {
      const [rawCampuses, reports] = await Promise.all([
        listCampuses(),
        listMonthlyReports(),
      ]);

      const activeCampuses = scopedCampusIds
        ? rawCampuses.filter((c) => scopedCampusIds.includes(c.id))
        : rawCampuses;
      setCampuses(activeCampuses);
      setMonthlyReports(reports);

      const eventsAccumulator: { event: EventProgram; campusName: string }[] = [];

      const statsPromises = activeCampuses.map(async (campus) => {
        try {
          const [
            campusBookings,
            campusEvents,
            campusSsi,
            campusLogins,
            worksheetYears,
          ] = await Promise.all([
            listAllBookingsForStats(campus.id).catch(() => [] as Booking[]),
            listEventsForCampus(campus.id).catch(() => [] as EventProgram[]),
            listSsiCollegeResultsForCampus(campus.id).catch(() => [] as SsiCollegeResult[]),
            listCampusLogins(campus.id).catch(() => [] as UserProfile[]),
            listWorksheetAcademicYears(campus.id).catch(() => []),
          ]);

          campusEvents.forEach((ev) => eventsAccumulator.push({ event: ev, campusName: campus.name }));
          const counsellors = campusLogins.filter((l) => l.role === "counsellor");

          // Worksheets count
          let totalWs = 0;
          if (worksheetYears.length > 0) {
            const currentYearWs = await Promise.all(
              worksheetYears.map((y) => listWorksheets(campus.id, y.id).catch(() => [] as Worksheet[])),
            );
            totalWs = currentYearWs.flat().length;
          }

          // Filter by period if month is selected
          const filteredBookings = period === "month"
            ? campusBookings.filter((b) => {
                const timestamp = b.createdAt || b.scheduledAt;
                if (timestamp === undefined) return false;
                const d = new Date(timestamp);
                return d.getMonth() + 1 === currentMonth && d.getFullYear() === currentYear;
              })
            : campusBookings;

          const completedSessions = filteredBookings.filter(
            (b) => b.status === "completed" && b.outcome !== "missed",
          ).length;

          const groupSessions = campusEvents.filter((e) => {
            if (e.category !== "group-session") return false;
            if (period === "month") {
              const d = new Date(e.eventDate);
              return d.getMonth() + 1 === currentMonth && d.getFullYear() === currentYear;
            }
            return true;
          });

          const programsEvents = campusEvents.filter((e) => {
            if (e.category === "group-session") return false;
            if (period === "month") {
              const d = new Date(e.eventDate);
              return d.getMonth() + 1 === currentMonth && d.getFullYear() === currentYear;
            }
            return true;
          });

          const filteredSsi = period === "month"
            ? campusSsi.filter((s) => {
                const d = new Date(s.submittedAt);
                return d.getMonth() + 1 === currentMonth && d.getFullYear() === currentYear;
              })
            : campusSsi;

          const ssiSevere = filteredSsi.filter((s) => s.severity === "severe").length;
          const ssiModerate = filteredSsi.filter((s) => s.severity === "medium").length;
          const ssiNormal = filteredSsi.filter((s) => s.severity === "normal").length;

          // Reports info
          const campusReportsThisMonth = reports.filter((r) => {
            if (r.campusId !== campus.id) return false;
            const d = new Date(r.uploadedAt);
            return d.getMonth() + 1 === currentMonth && d.getFullYear() === currentYear;
          });

          const lastUpload = reports
            .filter((r) => r.campusId === campus.id)
            .reduce((max, r) => {
              const t = new Date(r.uploadedAt).getTime();
              return Number.isNaN(t) ? max : Math.max(max, t);
            }, 0);

          return {
            campus,
            totalBookings: filteredBookings.length,
            completedSessions,
            groupSessionsCount: groupSessions.length,
            eventsCount: programsEvents.length,
            ssiTotal: filteredSsi.length,
            ssiSevere,
            ssiModerate,
            ssiNormal,
            counsellorsCount: counsellors.length,
            worksheetsCount: totalWs,
            criticalCasesCount: 0, // calculated from subscription below
            criticalSosCount: 0,
            criticalSevereCount: 0,
            criticalResolvedCount: 0,
            criticalPendingCount: 0,
            reportSubmittedThisMonth: campusReportsThisMonth.length > 0,
            reportsUploadedCount: campusReportsThisMonth.length,
            lastReportUpload: lastUpload,
          };
        } catch (err) {
          console.error(`Failed to load stats for campus ${campus.name}`, err);
          return {
            campus,
            totalBookings: 0,
            completedSessions: 0,
            groupSessionsCount: 0,
            eventsCount: 0,
            ssiTotal: 0,
            ssiSevere: 0,
            ssiModerate: 0,
            ssiNormal: 0,
            counsellorsCount: 0,
            worksheetsCount: 0,
            criticalCasesCount: 0,
            criticalSosCount: 0,
            criticalSevereCount: 0,
            criticalResolvedCount: 0,
            criticalPendingCount: 0,
            reportSubmittedThisMonth: false,
            reportsUploadedCount: 0,
            lastReportUpload: 0,
          };
        }
      });

      const resolvedStats = await Promise.all(statsPromises);
      setCampusStats(resolvedStats);
      setAllEvents(eventsAccumulator);
    } catch (err) {
      console.error("ManagementHomeOverview: Failed to load data", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAllData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  // Subscribe to all platform serious cases
  useEffect(() => {
    if (!profile) return;
    const unsub = subscribeToAdminSeriousCases(profile, (cases) => {
      setSeriousCases(cases);
    });
    return unsub;
  }, [profile]);

  // Merge serious cases counts into campusStats
  const enrichedCampusStats = useMemo(() => {
    return campusStats.map((st) => {
      const forCampus = seriousCases.filter((c) => c.campusId === st.campus.id);
      const sos = forCampus.filter((c) => c.isEmergency).length;
      const severe = forCampus.filter((c) => !c.isEmergency).length;
      const resolved = forCampus.filter((c) => c.status === "resolved").length;
      const pending = forCampus.filter((c) => c.status === "open").length;

      return {
        ...st,
        criticalCasesCount: forCampus.length,
        criticalSosCount: sos,
        criticalSevereCount: severe,
        criticalResolvedCount: resolved,
        criticalPendingCount: pending,
      };
    });
  }, [campusStats, seriousCases]);

  const selectedCampus = campuses.find((c) => c.id === selectedCampusId);

  // Active campus stats (either single campus or all)
  const activeCampusStats = useMemo(() => {
    if (!selectedCampusId) return enrichedCampusStats;
    return enrichedCampusStats.filter((st) => st.campus.id === selectedCampusId);
  }, [enrichedCampusStats, selectedCampusId]);

  // Aggregated totals based on selected campus (or all)
  const totalSessions = activeCampusStats.reduce((sum, s) => sum + s.completedSessions, 0);
  const totalBookings = activeCampusStats.reduce((sum, s) => sum + s.totalBookings, 0);
  const totalGroupSessions = activeCampusStats.reduce((sum, s) => sum + s.groupSessionsCount, 0);
  const totalProgramsEvents = activeCampusStats.reduce((sum, s) => sum + s.eventsCount, 0);
  const totalSsiCheckins = activeCampusStats.reduce((sum, s) => sum + s.ssiTotal, 0);
  const totalSsiSevere = activeCampusStats.reduce((sum, s) => sum + s.ssiSevere, 0);
  const totalSsiModerate = activeCampusStats.reduce((sum, s) => sum + s.ssiModerate, 0);
  const totalCounsellors = activeCampusStats.reduce((sum, s) => sum + s.counsellorsCount, 0);
  const totalWorksheets = activeCampusStats.reduce((sum, s) => sum + s.worksheetsCount, 0);

  // Critical cases platform/campus metrics
  const filteredSeriousCases = useMemo(() => {
    if (!selectedCampusId) return seriousCases;
    return seriousCases.filter((c) => c.campusId === selectedCampusId);
  }, [seriousCases, selectedCampusId]);

  const totalCriticalCases = filteredSeriousCases.length;
  const totalCriticalResolved = filteredSeriousCases.filter((c) => c.status === "resolved").length;
  const totalCriticalPending = filteredSeriousCases.filter((c) => c.status === "open").length;

  // Monthly Reports platform/campus metrics
  const filteredMonthlyReports = useMemo(() => {
    if (!selectedCampusId) return monthlyReports;
    return monthlyReports.filter((r) => r.campusId === selectedCampusId);
  }, [monthlyReports, selectedCampusId]);

  const reportsThisMonth = filteredMonthlyReports.filter((r) => {
    const d = new Date(r.uploadedAt);
    return d.getMonth() + 1 === currentMonth && d.getFullYear() === currentYear;
  });

  const targetCampuses = selectedCampusId
    ? campuses.filter((c) => c.id === selectedCampusId)
    : campuses;

  const submittedCampusIds = new Set(reportsThisMonth.map((r) => r.campusId).filter(Boolean));
  const campusesSubmittedCount = targetCampuses.filter((c) => submittedCampusIds.has(c.id)).length;
  const campusesPendingReports = targetCampuses.length - campusesSubmittedCount;

  // Filtered events: only events and programs card shows campus-specific data
  const filteredAllEvents = useMemo(() => {
    if (!selectedCampusId) return allEvents;
    return allEvents.filter((ev) => ev.event.campusId === selectedCampusId);
  }, [allEvents, selectedCampusId]);

  const displayedGroupSessions = useMemo(() => {
    const list = selectedCampusId ? filteredAllEvents : allEvents;
    return list.filter((e) => e.event.category === "group-session");
  }, [selectedCampusId, filteredAllEvents, allEvents]);

  // Platform-wide metrics for remaining normal wide-campuses view sections
  const platformSosCases = seriousCases.filter((c) => c.isEmergency).length;
  const platformSevereCases = seriousCases.filter((c) => !c.isEmergency).length;
  const platformCriticalResolved = seriousCases.filter((c) => c.status === "resolved").length;
  const platformCriticalPending = seriousCases.filter((c) => c.status === "open").length;

  const platformReportsThisMonth = monthlyReports.filter((r) => {
    const d = new Date(r.uploadedAt);
    return d.getMonth() + 1 === currentMonth && d.getFullYear() === currentYear;
  });
  const platformSubmittedCampusIds = new Set(platformReportsThisMonth.map((r) => r.campusId).filter(Boolean));
  const platformCampusesSubmittedCount = campuses.filter((c) => platformSubmittedCampusIds.has(c.id)).length;
  const platformCampusesPendingReports = campuses.length - platformCampusesSubmittedCount;

  const platformSsiNormal = enrichedCampusStats.reduce((sum, s) => sum + s.ssiNormal, 0);
  const platformSsiModerate = enrichedCampusStats.reduce((sum, s) => sum + s.ssiModerate, 0);
  const platformSsiSevere = enrichedCampusStats.reduce((sum, s) => sum + s.ssiSevere, 0);
  const platformSsiTotal = enrichedCampusStats.reduce((sum, s) => sum + s.ssiTotal, 0);

  // Campus Comparative Table: always wide multi-campus view across all campuses
  const displayedCampuses = useMemo(() => {
    if (!searchQuery.trim()) return enrichedCampusStats;
    return enrichedCampusStats.filter((st) =>
      st.campus.name.toLowerCase().includes(searchQuery.toLowerCase()),
    );
  }, [enrichedCampusStats, searchQuery]);

  return (
    <div className="mho-container">
      {/* ── Top Executive Welcome & Action Header ───────────────── */}
      <div className="mho-header">
        <div className="mho-header__intro">
          <div className="mho-header__badge-wrap">
            <span className="mho-badge mho-badge--executive">Management Executive</span>
            {selectedCampus ? (
              <span className="mho-badge mho-badge--selected-campus">
                <BuildingIcon /> Campus: {selectedCampus.name}
              </span>
            ) : (
              <span className="mho-badge mho-badge--campuses">
                {campuses.length} Campuses Monitored
              </span>
            )}
          </div>
          <h2 className="mho-header__title">Executive Institutional Dashboard</h2>
          <p className="mho-header__subtitle">
            {selectedCampus
              ? `Operational metrics, counselling workload, critical cases, and program analytics specifically for ${selectedCampus.name}.`
              : "Consolidated mental health performance, critical case resolution, counselling workload, and program analytics across all campuses."}
          </p>
        </div>

        <div className="mho-header__actions">
          <div className="mho-actions-top">
            <div className="mho-period-toggle">
              <button
                type="button"
                className={`mho-period-btn ${period === "month" ? "active" : ""}`}
                onClick={() => setPeriod("month")}
              >
                This Month ({periodLabel})
              </button>
              <button
                type="button"
                className={`mho-period-btn ${period === "all" ? "active" : ""}`}
                onClick={() => setPeriod("all")}
              >
                All Time
              </button>
            </div>

            <Button type="button" variant="outlined" onClick={loadAllData}>
              <RefreshIcon /> Refresh Overview
            </Button>
          </div>

          <div className="mho-campus-selector-row">
            <label htmlFor="mho-campus-select" className="mho-campus-selector-label">
              <BuildingIcon /> Campus:
            </label>
            <div className="mho-campus-select-wrap">
              <Select
                id="mho-campus-select"
                value={selectedCampusId}
                onChange={setSelectedCampusId}
              >
                <option value="">All Campuses</option>
                {campuses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>
            {selectedCampusId && (
              <button
                type="button"
                className="mho-reset-campus-btn"
                onClick={() => setSelectedCampusId("")}
                title="Reset to All Campuses"
              >
                ✕ Show All
              </button>
            )}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="mho-loading-card">
          <span className="mho-spinner" />
          <p>Compiling cross-campus metrics & operational indicators…</p>
        </div>
      ) : (
        <>
          {/* ── Executive 8-Pillar Bento Grid ────────────────────── */}
          <div className="mho-kpi-grid">
            {/* 1. Individual Sessions */}
            <div
              className="mho-kpi-card mho-kpi-card--blue"
              onClick={() => onSelectSection("analytics")}
              role="button"
              tabIndex={0}
            >
              <div className="mho-kpi-card__top">
                <span className="mho-kpi-card__icon"><ClipboardListIcon /></span>
                <span className="mho-kpi-card__pill">Counselling</span>
              </div>
              <strong className="mho-kpi-card__val">{totalSessions}</strong>
              <div className="mho-kpi-card__label">Total Sessions Completed</div>
              <div className="mho-kpi-card__meta">
                <span>{totalBookings} Total Bookings</span>
                <span>{selectedCampus ? `for ${selectedCampus.name}` : `across ${campuses.length} campuses`}</span>
              </div>
            </div>

            {/* 2. Group Sessions */}
            <div
              className="mho-kpi-card mho-kpi-card--purple"
              onClick={() => setActiveModal("group-sessions")}
              role="button"
              tabIndex={0}
            >
              <div className="mho-kpi-card__top">
                <span className="mho-kpi-card__icon"><UsersIcon /></span>
                <span className="mho-kpi-card__pill">Group Work</span>
              </div>
              <strong className="mho-kpi-card__val">{totalGroupSessions}</strong>
              <div className="mho-kpi-card__label">Group Sessions Conducted</div>
              <div className="mho-kpi-card__meta">
                <span>{selectedCampus ? `at ${selectedCampus.name}` : "Student interactive sessions"}</span>
                <span className="mho-kpi-card__action">View List →</span>
              </div>
            </div>

            {/* 3. Critical Cases (Severe & SOS) */}
            <div
              className={`mho-kpi-card ${totalCriticalPending > 0 ? "mho-kpi-card--danger" : "mho-kpi-card--warning"}`}
              onClick={() => onSelectSection("serious-cases")}
              role="button"
              tabIndex={0}
            >
              <div className="mho-kpi-card__top">
                <span className="mho-kpi-card__icon"><AlertTriangleIcon /></span>
                <span className="mho-kpi-card__pill mho-kpi-card__pill--urgent">Critical Cases</span>
              </div>
              <strong className="mho-kpi-card__val">{totalCriticalCases}</strong>
              <div className="mho-kpi-card__label">Severe & SOS Cases</div>
              <div className="mho-kpi-card__meta">
                <span className="mho-highlight--green">{totalCriticalResolved} Action Taken</span>
                <span className={totalCriticalPending > 0 ? "mho-highlight--red" : ""}>
                  {totalCriticalPending} Pending
                </span>
              </div>
            </div>

            {/* 4. Events & Programs */}
            <div
              className="mho-kpi-card mho-kpi-card--emerald"
              onClick={() => onSelectSection("events")}
              role="button"
              tabIndex={0}
            >
              <div className="mho-kpi-card__top">
                <span className="mho-kpi-card__icon"><CalendarIcon /></span>
                <span className="mho-kpi-card__pill">Campus Life</span>
              </div>
              <strong className="mho-kpi-card__val">{totalProgramsEvents}</strong>
              <div className="mho-kpi-card__label">Events & Programs</div>
              <div className="mho-kpi-card__meta">
                <span>{selectedCampus ? `at ${selectedCampus.name}` : "Workshops & campaigns"}</span>
                <span className="mho-kpi-card__action">Open Calendar →</span>
              </div>
            </div>

            {/* 5. SSI Analytics */}
            <div
              className="mho-kpi-card mho-kpi-card--teal"
              onClick={() => onSelectSection("ssi-analytics")}
              role="button"
              tabIndex={0}
            >
              <div className="mho-kpi-card__top">
                <span className="mho-kpi-card__icon"><TrendingUpIcon /></span>
                <span className="mho-kpi-card__pill">Stress Index</span>
              </div>
              <strong className="mho-kpi-card__val">{totalSsiCheckins}</strong>
              <div className="mho-kpi-card__label">SSI Check-ins Recorded</div>
              <div className="mho-kpi-card__meta">
                <span className="mho-highlight--amber">{totalSsiSevere} Severe</span>
                <span>{totalSsiModerate} Moderate</span>
              </div>
            </div>

            {/* 6. Counsellors Performance */}
            <div
              className="mho-kpi-card mho-kpi-card--indigo"
              onClick={() => onSelectSection("analytics")}
              role="button"
              tabIndex={0}
            >
              <div className="mho-kpi-card__top">
                <span className="mho-kpi-card__icon"><UsersIcon /></span>
                <span className="mho-kpi-card__pill">Staff Roster</span>
              </div>
              <strong className="mho-kpi-card__val">{totalCounsellors}</strong>
              <div className="mho-kpi-card__label">Active Counsellors</div>
              <div className="mho-kpi-card__meta">
                <span>{selectedCampus ? `deployed at ${selectedCampus.name}` : "Deployed across campuses"}</span>
                <span className="mho-kpi-card__action">Analytics →</span>
              </div>
            </div>

            {/* 7. Worksheets */}
            <div
              className="mho-kpi-card mho-kpi-card--cyan"
              onClick={() => onSelectSection("counsellor-worksheet")}
              role="button"
              tabIndex={0}
            >
              <div className="mho-kpi-card__top">
                <span className="mho-kpi-card__icon"><FileTextIcon /></span>
                <span className="mho-kpi-card__pill">Planning</span>
              </div>
              <strong className="mho-kpi-card__val">{totalWorksheets}</strong>
              <div className="mho-kpi-card__label">Worksheets Maintained</div>
              <div className="mho-kpi-card__meta">
                <span>{selectedCampus ? `for ${selectedCampus.name}` : "Monthly plans & topics"}</span>
                <span className="mho-kpi-card__action">Open Section →</span>
              </div>
            </div>

            {/* 8. Consolidated Reports */}
            <div
              className="mho-kpi-card mho-kpi-card--amber"
              onClick={() => onSelectSection("monthly-reports")}
              role="button"
              tabIndex={0}
            >
              <div className="mho-kpi-card__top">
                <span className="mho-kpi-card__icon"><FolderOpenIcon /></span>
                <span className="mho-kpi-card__pill">Monthly Reports</span>
              </div>
              <strong className="mho-kpi-card__val">
                {selectedCampus
                  ? activeCampusStats[0]?.reportSubmittedThisMonth
                    ? "1 / 1"
                    : "0 / 1"
                  : `${campusesSubmittedCount} / ${campuses.length}`}
              </strong>
              <div className="mho-kpi-card__label">
                {selectedCampus ? "Report Submitted" : "Campuses Submitted"}
              </div>
              <div className="mho-kpi-card__meta">
                <span className={campusesPendingReports > 0 ? "mho-highlight--amber" : "mho-highlight--green"}>
                  {selectedCampus
                    ? activeCampusStats[0]?.reportSubmittedThisMonth
                      ? `✓ Submitted (${periodLabel})`
                      : `Pending (${periodLabel})`
                    : `${campusesPendingReports} Pending (${periodLabel})`}
                </span>
              </div>
            </div>
          </div>

          {/* ── Critical Cases Watchlist Section (Severe & SOS) ──── */}
          <div className="mho-section-card mho-section-card--critical">
            <div className="mho-section-card__header">
              <div className="mho-section-card__title-wrap">
                <span className="mho-icon-box mho-icon-box--red"><AlertTriangleIcon /></span>
                <div>
                  <h3 className="mho-section-card__title">Critical Student Cases Watchlist</h3>
                  <p className="mho-section-card__sub">
                    Severe flagged counselling cases and Crisis SOS emergencies requiring management escalation monitoring and action follow-up.
                  </p>
                </div>
              </div>
              <div className="mho-badges-row">
                <span className="mho-chip mho-chip--sos">
                  {platformSosCases} Crisis SOS
                </span>
                <span className="mho-chip mho-chip--severe">
                  {platformSevereCases} Severe Sessions
                </span>
                <span className="mho-chip mho-chip--success">
                  {platformCriticalResolved} Action Recorded
                </span>
                {platformCriticalPending > 0 && (
                  <span className="mho-chip mho-chip--danger">
                    {platformCriticalPending} Action Pending
                  </span>
                )}
              </div>
            </div>

            {seriousCases.length === 0 ? (
              <div className="mho-empty-state">
                <CheckCircleIcon />
                <p>No critical cases recorded platform-wide. All campuses are operating smoothly.</p>
              </div>
            ) : (
              <div className="mho-critical-list">
                {seriousCases.slice(0, 5).map((sc) => {
                  const campusName =
                    campuses.find((c) => c.id === sc.campusId)?.name || "Campus";
                  const isResolved = sc.status === "resolved";

                  return (
                    <div
                      key={sc.id}
                      className={`mho-critical-item ${isResolved ? "resolved" : "pending"}`}
                    >
                      <div className="mho-critical-item__left">
                        <span
                          className={`mho-critical-tag ${
                            sc.isEmergency ? "mho-critical-tag--sos" : "mho-critical-tag--severe"
                          }`}
                        >
                          {sc.isEmergency ? "Crisis SOS" : "Severe Flagged"}
                        </span>
                        <div>
                          <h4 className="mho-critical-item__title">
                            {campusName} • Student ID: {sc.studentId || sc.studentEmail || "Confidential"}
                          </h4>
                          <p className="mho-critical-item__note">{sc.note || "No notes entered"}</p>
                          <div className="mho-critical-item__meta">
                            <span>Reported on {formatDateTimeDMY(sc.createdAt)}</span>
                            <span>• Filed by {sc.originRole} ({sc.authorEmail})</span>
                            {sc.escalationCount > 0 && (
                              <span className="mho-escalation-alert">
                                Escalated {sc.escalationCount} time(s)
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="mho-critical-item__right">
                        {isResolved ? (
                          <div className="mho-status-box mho-status-box--resolved">
                            <span className="mho-status-pill mho-status-pill--resolved">✓ Action Taken</span>
                            {sc.actionTaken && (
                              <p className="mho-action-taken-text">
                                "{sc.actionTaken.text}" — {sc.actionTaken.byEmail}
                              </p>
                            )}
                          </div>
                        ) : (
                          <div className="mho-status-box mho-status-box--pending">
                            <span className="mho-status-pill mho-status-pill--pending">⏳ Pending Action</span>
                            <Button
                              type="button"
                              variant="outlined"
                              onClick={() => onSelectSection("serious-cases")}
                            >
                              Resolve in Section →
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {seriousCases.length > 5 && (
                  <div className="mho-view-all-row">
                    <button
                      type="button"
                      className="mho-link-btn"
                      onClick={() => onSelectSection("serious-cases")}
                    >
                      View All {seriousCases.length} Critical Cases in Serious Cases Section →
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Per-Campus Comparative Intelligence Matrix ───────── */}
          <div className="mho-section-card">
            <div className="mho-section-card__header">
              <div className="mho-section-card__title-wrap">
                <span className="mho-icon-box mho-icon-box--blue"><BuildingIcon /></span>
                <div>
                  <h3 className="mho-section-card__title">Campus Comparative Performance Matrix</h3>
                  <p className="mho-section-card__sub">
                    Direct comparison of counselling sessions, student groups, critical alarms, and report compliance.
                  </p>
                </div>
              </div>

              <div className="mho-search-box">
                <input
                  type="text"
                  placeholder="Filter by campus name…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="mho-search-input"
                />
              </div>
            </div>

            <div className="mho-table-responsive">
              <table className="mho-table">
                <thead>
                  <tr>
                    <th>Campus</th>
                    <th>Sessions Held</th>
                    <th>Group Sessions</th>
                    <th>Critical Alarms</th>
                    <th>SSI Check-ins</th>
                    <th>Counsellors</th>
                    <th>Worksheets</th>
                    <th>Monthly Report</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedCampuses.map((st) => (
                    <tr key={st.campus.id}>
                      <td>
                        <strong className="mho-campus-name">
                          <BuildingIcon /> {st.campus.name}
                        </strong>
                      </td>
                      <td>
                        <span className="mho-metric-num">{st.completedSessions}</span>
                        <span className="mho-metric-sub">/ {st.totalBookings} booked</span>
                      </td>
                      <td>
                        <span className="mho-metric-badge mho-metric-badge--purple">
                          {st.groupSessionsCount} group
                        </span>
                      </td>
                      <td>
                        {st.criticalCasesCount === 0 ? (
                          <span className="mho-metric-pill mho-metric-pill--none">0 Cases</span>
                        ) : (
                          <span
                            className={`mho-metric-pill ${
                              st.criticalPendingCount > 0 ? "mho-metric-pill--alert" : "mho-metric-pill--good"
                            }`}
                          >
                            {st.criticalCasesCount} ({st.criticalPendingCount} pending)
                          </span>
                        )}
                      </td>
                      <td>
                        <div className="mho-ssi-cell">
                          <span className="mho-metric-num">{st.ssiTotal}</span>
                          {st.ssiSevere > 0 && (
                            <span className="mho-severe-tag">{st.ssiSevere} severe</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <span className="mho-counsellor-badge">
                          <UsersIcon /> {st.counsellorsCount}
                        </span>
                      </td>
                      <td>
                        <span className="mho-metric-num">{st.worksheetsCount}</span>
                      </td>
                      <td>
                        <span
                          className={`mho-report-tag ${
                            st.reportSubmittedThisMonth ? "mho-report-tag--done" : "mho-report-tag--pending"
                          }`}
                        >
                          {st.reportSubmittedThisMonth ? "✓ Submitted" : "Pending"}
                        </span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="mho-action-link"
                          onClick={() => onSelectSection("analytics")}
                        >
                          Inspect →
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Two-Column Operational Deep Dives ────────────────── */}
          <div className="mho-two-col">
            {/* Column 1: Events & Programs Across Campuses */}
            <div className="mho-section-card">
              <div className="mho-section-card__header">
                <div className="mho-section-card__title-wrap">
                  <span className="mho-icon-box mho-icon-box--green"><CalendarIcon /></span>
                  <div>
                    <h3 className="mho-section-card__title">
                      Events & Programs {selectedCampus ? `(${selectedCampus.name})` : ""}
                    </h3>
                    <p className="mho-section-card__sub">
                      {selectedCampus
                        ? `Workshops, awareness drives, and student engagements registered for ${selectedCampus.name}.`
                        : "Recent and scheduled workshops, awareness drives, and group engagements across all campuses."}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  className="mho-header-btn"
                  onClick={() => onSelectSection("events")}
                >
                  Events Calendar →
                </button>
              </div>

              {filteredAllEvents.length === 0 ? (
                <div className="mho-empty-state">
                  <p>
                    {selectedCampus
                      ? `No events or programs registered for ${selectedCampus.name}.`
                      : "No events or programs registered across campuses."}
                  </p>
                </div>
              ) : (
                <div className="mho-mini-list">
                  {filteredAllEvents.slice(0, 5).map(({ event, campusName }) => (
                    <div key={event.id} className="mho-event-card">
                      <div className="mho-event-card__date">
                        <CalendarIcon />
                        <span>{formatDateDMY(event.eventDate)}</span>
                      </div>
                      <div className="mho-event-card__details">
                        <div className="mho-event-card__top">
                          <strong className="mho-event-card__title">{event.title}</strong>
                          <span
                            className={`mho-event-type-badge ${
                              event.category === "group-session" ? "group" : "program"
                            }`}
                          >
                            {event.category === "group-session" ? "Group Session" : "Awareness / Workshop"}
                          </span>
                        </div>
                        <p className="mho-event-card__desc">
                          {event.description || "No description provided."}
                        </p>
                        <div className="mho-event-card__campus">
                          <BuildingIcon /> {campusName}
                          {event.attendeeCount ? ` • ${event.attendeeCount} Attendees` : ""}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Column 2: SSI Mental Health & Stress Analytics */}
            <div className="mho-section-card">
              <div className="mho-section-card__header">
                <div className="mho-section-card__title-wrap">
                  <span className="mho-icon-box mho-icon-box--teal"><TrendingUpIcon /></span>
                  <div>
                    <h3 className="mho-section-card__title">Student Stress Index (SSI) Overview</h3>
                    <p className="mho-section-card__sub">
                      Campus mental health screening distribution and follow-up tracking.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  className="mho-header-btn"
                  onClick={() => onSelectSection("ssi-analytics")}
                >
                  Full SSI Analytics →
                </button>
              </div>

              <div className="mho-ssi-distribution">
                <div className="mho-ssi-dist-card mho-ssi-dist-card--normal">
                  <span className="mho-ssi-dist-card__val">{platformSsiNormal}</span>
                  <span className="mho-ssi-dist-card__label">Normal</span>
                </div>
                <div className="mho-ssi-dist-card mho-ssi-dist-card--moderate">
                  <span className="mho-ssi-dist-card__val">{platformSsiModerate}</span>
                  <span className="mho-ssi-dist-card__label">Moderate</span>
                </div>
                <div className="mho-ssi-dist-card mho-ssi-dist-card--severe">
                  <span className="mho-ssi-dist-card__val">{platformSsiSevere}</span>
                  <span className="mho-ssi-dist-card__label">Severe Attention</span>
                </div>
              </div>

              <div className="mho-ssi-breakdown">
                <h4 className="mho-subheading">Campus-wise SSI Check-ins</h4>
                <div className="mho-ssi-progress-list">
                  {enrichedCampusStats.map((st) => (
                    <div key={st.campus.id} className="mho-ssi-progress-item">
                      <div className="mho-ssi-progress-header">
                        <span>{st.campus.name}</span>
                        <strong>{st.ssiTotal} Check-ins ({st.ssiSevere} severe)</strong>
                      </div>
                      <div className="mho-progress-bar">
                        <div
                          className="mho-progress-bar__fill"
                          style={{
                            width: platformSsiTotal > 0 ? `${(st.ssiTotal / platformSsiTotal) * 100}%` : "0%",
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ── Consolidated Reports Submission Status (User Screenshot Section) ──── */}
          <div className="mho-section-card">
            <div className="mho-section-card__header">
              <div className="mho-section-card__title-wrap">
                <span className="mho-icon-box mho-icon-box--amber"><FolderOpenIcon /></span>
                <div>
                  <h3 className="mho-section-card__title">Consolidated Reports Submitted</h3>
                  <p className="mho-section-card__sub">
                    Which campuses shared their reports for {periodLabel} — and which haven't yet.
                  </p>
                </div>
              </div>
              <span className="mho-badge mho-badge--blue">
                {platformCampusesSubmittedCount} / {campuses.length} Campuses Submitted
              </span>
            </div>

            <div className="mho-reports-kpis">
              <div className="mho-reports-kpi">
                <span className="mho-reports-kpi__icon" style={{ background: "#DBEAFE", color: "#2563EB" }}>
                  <BuildingIcon />
                </span>
                <div>
                  <strong className="mho-reports-kpi__val">{campuses.length}</strong>
                  <span className="mho-reports-kpi__lbl">Total Campuses</span>
                </div>
              </div>
              <div className="mho-reports-kpi">
                <span className="mho-reports-kpi__icon" style={{ background: "#DCFCE7", color: "#15803D" }}>
                  <CheckCircleIcon />
                </span>
                <div>
                  <strong className="mho-reports-kpi__val">{platformCampusesSubmittedCount}</strong>
                  <span className="mho-reports-kpi__lbl">Submitted ({periodLabel})</span>
                </div>
              </div>
              <div className="mho-reports-kpi">
                <span className="mho-reports-kpi__icon" style={{ background: "#FFFBEB", color: "#D97706" }}>
                  <AlertCircleIcon />
                </span>
                <div>
                  <strong className="mho-reports-kpi__val">{platformCampusesPendingReports}</strong>
                  <span className="mho-reports-kpi__lbl">Campuses Pending</span>
                </div>
              </div>
              <div className="mho-reports-kpi">
                <span className="mho-reports-kpi__icon" style={{ background: "#CCFBF1", color: "#0D9488" }}>
                  <FileTextIcon />
                </span>
                <div>
                  <strong className="mho-reports-kpi__val">{monthlyReports.length}</strong>
                  <span className="mho-reports-kpi__lbl">Total Reports Uploaded</span>
                </div>
              </div>
              <div className="mho-reports-kpi">
                <span className="mho-reports-kpi__icon" style={{ background: "#E0E7FF", color: "#1E3A8A" }}>
                  <CalendarIcon />
                </span>
                <div>
                  <strong className="mho-reports-kpi__val">{platformReportsThisMonth.length}</strong>
                  <span className="mho-reports-kpi__lbl">Reports This Period</span>
                </div>
              </div>
            </div>

            <div className="mho-table-responsive">
              <table className="mho-table">
                <thead>
                  <tr>
                    <th>Campus</th>
                    <th>Status ({periodLabel})</th>
                    <th>Reports Uploaded ({periodLabel})</th>
                    <th>Last Upload</th>
                  </tr>
                </thead>
                <tbody>
                  {enrichedCampusStats.map((st) => (
                    <tr key={st.campus.id}>
                      <td>
                        <strong className="mho-campus-name">
                          <BuildingIcon /> {st.campus.name}
                        </strong>
                      </td>
                      <td>
                        <span
                          className={`mho-report-tag ${
                            st.reportSubmittedThisMonth ? "mho-report-tag--done" : "mho-report-tag--pending"
                          }`}
                        >
                          {st.reportSubmittedThisMonth ? "✓ Submitted" : "Pending"}
                        </span>
                      </td>
                      <td>{st.reportsUploadedCount}</td>
                      <td>
                        {st.lastReportUpload > 0 ? formatDateDMY(st.lastReportUpload) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mho-section-card__footer">
              <button
                type="button"
                className="mho-link-btn"
                onClick={() => onSelectSection("monthly-reports")}
              >
                Open Consolidated Reports Section →
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Group Sessions Detail Modal ──────────────────────────── */}
      {activeModal === "group-sessions" && (
        <Modal
          title={
            selectedCampus
              ? `Group Sessions — ${selectedCampus.name}`
              : "Group Sessions Overview Across Campuses"
          }
          onClose={() => setActiveModal(null)}
        >
          <div className="mho-modal-content">
            <p className="mho-modal-desc">
              {selectedCampus
                ? `Student group counselling sessions, interactive workshops, and group therapy cohorts conducted at ${selectedCampus.name}.`
                : "All student group counselling sessions, interactive workshops, and group therapy cohorts conducted by counsellors across campuses."}
            </p>
            {displayedGroupSessions.length === 0 ? (
              <p className="mho-empty-note">
                {selectedCampus
                  ? `No group sessions recorded yet for ${selectedCampus.name}.`
                  : "No group sessions recorded yet across campuses."}
              </p>
            ) : (
              <div className="mho-modal-list">
                {displayedGroupSessions.map(({ event, campusName }) => (
                  <div key={event.id} className="mho-modal-item">
                    <div className="mho-modal-item__header">
                      <strong>{event.title}</strong>
                      <span className="mho-campus-pill">{campusName}</span>
                    </div>
                    <p className="mho-modal-item__sub">{event.description || "No topic details provided"}</p>
                    <div className="mho-modal-item__meta">
                      <span>Date: {formatDateDMY(event.eventDate)}</span>
                      {event.attendeeCount ? <span>Attendees: {event.attendeeCount}</span> : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="mho-modal-actions">
              <Button type="button" onClick={() => onSelectSection("events")}>
                Go to Events & Programs →
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

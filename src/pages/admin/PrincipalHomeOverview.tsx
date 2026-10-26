import { useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../../services/firebase/config";
import { useAuth } from "../../hooks/useAuth";
import { useAcademicYear } from "../../hooks/useAcademicYear";
import { listEventsForCollege } from "../../services/firebase/events";
import { listSsiCollegeResultsForCollege } from "../../services/firebase/ssiCollegeResults";
import { subscribeToAdminSeriousCases } from "../../services/firebase/seriousCases";
import { listAllBookingsForStats } from "../../services/firebase/bookings";
import { listMonthlyStaffReportsForRecipient } from "../../services/firebase/counsellorMonthlyReports";
import { listAttendanceForCampusOnDate, istDateKey, formatIstTime } from "../../services/firebase/attendance";
import { periodLabel, periodChipLabel, periodStart, type HomePeriod } from "../head/headHomeMetrics";
import type { EventProgram } from "../../types/event";
import type { SsiCollegeResult } from "../../services/firebase/ssiCollegeResults";
import type { SeriousCase } from "../../types/seriousCase";
import type { Booking, ConcernCategory } from "../../types/booking";
import { CONCERN_CATEGORY_LABELS } from "../../types/booking";
import type { MonthlyStaffReport } from "../../services/firebase/counsellorMonthlyReports";
import type { AttendanceRecord } from "../../types/attendance";
import {
  CalendarIcon,
  TrendingUpIcon,
  AlertTriangleIcon,
  FileTextIcon,
  UsersIcon,
  ClockIcon,
  ClipboardListIcon,
} from "../../components/common/icons";
import { Modal } from "../../components/common/Modal";
import { formatDateTimeDMY } from "../../utils/formatDate";
import "./PrincipalHomeOverview.css";

interface PrincipalHomeOverviewProps {
  onSelectSection: (sectionId: string) => void;
}

const PERIODS: HomePeriod[] = ["week", "month", "year"];
const DAY_MS = 24 * 60 * 60 * 1000;
function isHeldSession(b: Booking): boolean {
  return b.status === "completed" && b.outcome !== "missed";
}

function bookingTime(b: Booking): number {
  return b.scheduledAt ?? b.createdAt;
}

/** Each read is individually labeled so a permission/other failure in
    Promise.all tells us exactly which query broke, instead of one opaque
    "something failed" error — same pattern as HeadCommandCentre's load(). */
function labeled<T>(label: string, p: Promise<T>): Promise<T> {
  return p.catch((err) => {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`[${label}] ${message}`, { cause: err });
  });
}

interface LoadedData {
  events: EventProgram[];
  ssiResults: SsiCollegeResult[];
  staffUids: string[];
  staffNames: Map<string, string>;
  counsellorCount: number;
  collegeBookings: Booking[];
  monthlyReports: MonthlyStaffReport[];
  attendanceToday: AttendanceRecord[];
}

/** The Home overview for a college-restricted Principal/Vice-Principal —
    big, always-visible KPI tiles (matching the Head Command Centre's own
    visual scale) about their own college's counsellor(s)/head specifically:
    granted sections (Analytics, SSI Analytics, Serious Cases, Events,
    Counsellor Worksheet) plus sessions held, group sessions run, monthly
    report submissions, and today's check-in/out — each a shortcut into
    more detail, instead of the campus-wide Consolidated Reports widget
    other admins get (irrelevant to a single-college role). A This Week /
    This Month toggle (same as the Head dashboard) scopes the activity
    tiles and the student-concerns panel. */
export function PrincipalHomeOverview({ onSelectSection }: PrincipalHomeOverviewProps) {
  const { profile } = useAuth();
  const { includes: inAcademicYear, includesMonth, yearForCampus, selectedLabel } = useAcademicYear();
  const [data, setData] = useState<LoadedData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<HomePeriod>("month");
  const [now] = useState(() => new Date());
  const [seriousCases, setSeriousCases] = useState<SeriousCase[]>([]);

  const [showSessions, setShowSessions] = useState(false);
  const [showGroupSessions, setShowGroupSessions] = useState(false);
  const [showAttendance, setShowAttendance] = useState(false);

  const collegeIds =
    profile?.adminAccess?.collegeIds?.length
      ? profile.adminAccess.collegeIds
      : profile?.collegeId
        ? [profile.collegeId]
        : [];
  // A college-restricted Admin (Principal/VP/Administration) is scoped to
  // their assigned campus and college(s). Firestore can only validate list
  // queries against the Admin branch of the events/ssi_college_results read
  // rules when the query itself filters on campusId too.
  const campusIds =
    profile?.adminAccess?.campusIds?.length
      ? profile.adminAccess.campusIds
      : profile?.campusId
        ? [profile.campusId]
        : [];
  const campusId = campusIds[0];
  const reportScopes = campusIds.flatMap((assignedCampusId) =>
    collegeIds.map((assignedCollegeId) => ({ campusId: assignedCampusId, collegeId: assignedCollegeId })),
  );
  const grantedSections = profile?.adminAccess?.sections;
  const isCollegeReviewer =
    profile?.role === "admin" &&
    profile.adminAccess?.scope === "campuses" &&
    (profile.adminAccess.designation === "principal" ||
      profile.adminAccess.designation === "vice-principal") &&
    collegeIds.length > 0;
  const seesSeriousCases =
    isCollegeReviewer ||
    profile?.adminAccess?.designation === "administration" ||
    !grantedSections ||
    grantedSections.includes("serious-cases");
  const sees = (id: string) => !grantedSections || grantedSections.includes(id as (typeof grantedSections)[number]);

  useEffect(() => {
    if (!profile || collegeIds.length === 0) return;
    const profileUid = profile.uid;
    let active = true;
    setError(null);

    async function load() {
      try {
        const [eventLists, ssiLists, counsellorSnaps, headSnap, reportLists] = await Promise.all([
          labeled("events", Promise.all(collegeIds.map((id) => listEventsForCollege(id, campusId)))),
          labeled("ssiResults", Promise.all(collegeIds.map((id) => listSsiCollegeResultsForCollege(id, campusId)))),
          labeled(
            "counsellors",
            Promise.all(
              collegeIds.map((id) =>
                getDocs(query(collection(db, "users"), where("role", "==", "counsellor"), where("collegeId", "==", id))),
              ),
            ),
          ),
          labeled(
            "head",
            campusId
              ? getDocs(query(collection(db, "users"), where("role", "==", "head"), where("campusId", "==", campusId)))
              : Promise.resolve(null),
          ),
          labeled(
            "monthlyReports",
            profileUid ? listMonthlyStaffReportsForRecipient(profileUid, reportScopes) : Promise.resolve([]),
          ),
        ]);

        const counsellorDocs = counsellorSnaps.flatMap((s) => s.docs);
        const headDocs = headSnap?.docs ?? [];
        const allStaffDocs = [...counsellorDocs, ...headDocs];
        const staffUids = allStaffDocs.map((d) => d.id);
        const staffNames = new Map(
          allStaffDocs.map((d) => [d.id, (d.data().displayName as string) || (d.data().email as string)]),
        );

        const todayKey = istDateKey(Date.now());
        const [allCampusBookings, attendance] = await Promise.all([
          labeled(
            "bookings",
            campusId ? listAllBookingsForStats(campusId, staffUids, false) : Promise.resolve([]),
          ),
          labeled("attendance", campusId ? listAttendanceForCampusOnDate(campusId, todayKey) : Promise.resolve([])),
        ]);

        if (!active) return;
        setData({
          events: eventLists.flat(),
          ssiResults: ssiLists.flat(),
          staffUids,
          staffNames,
          counsellorCount: counsellorDocs.length,
          collegeBookings: allCampusBookings.filter((b) => staffUids.includes(b.counsellorId)),
          monthlyReports: reportLists.flat(),
          attendanceToday: attendance.filter((r) => staffUids.includes(r.uid)),
        });
      } catch (err) {
        console.error("Failed to load Principal home overview", err);
        if (active) {
          const detail = err instanceof Error ? err.message : "";
          setError(`Couldn't load some of your college's data.${detail ? ` (${detail})` : ""}`);
        }
      }
    }

    load();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.uid]);

  useEffect(() => {
    if (!profile || !seesSeriousCases) {
      setSeriousCases([]);
      return;
    }
    return subscribeToAdminSeriousCases(profile, setSeriousCases);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.uid, seesSeriousCases]);

  if (!collegeIds.length) return null;

  const selectedAcademicYear = yearForCampus(campusId);
  const nowMs = now.getTime();
  const periodNow = selectedAcademicYear && (nowMs < selectedAcademicYear.startDate || nowMs > selectedAcademicYear.endDate)
    ? new Date(selectedAcademicYear.endDate)
    : now;
  const periodStartMs = period === "year" && selectedAcademicYear
    ? selectedAcademicYear.startDate
    : periodStart(period, periodNow);
  const loading = !data;

  const events = (data?.events ?? []).filter((event) =>
    inAcademicYear(event.eventDate, campusId, event.collegeId),
  );
  const ssiResults = (data?.ssiResults ?? []).filter((result) =>
    inAcademicYear(result.submittedAt, campusId, result.collegeId),
  );
  const staffUids = data?.staffUids ?? [];
  const staffNames = data?.staffNames ?? new Map<string, string>();
  const collegeBookings = (data?.collegeBookings ?? []).filter((booking) =>
    inAcademicYear(bookingTime(booking), campusId, booking.collegeId),
  );
  const monthlyReports = (data?.monthlyReports ?? []).filter((report) =>
    includesMonth(report.year, report.month, report.campusId ?? campusId, report.collegeId),
  );
  const attendanceToday = data?.attendanceToday ?? [];
  const counsellorCount = data?.counsellorCount ?? 0;

  const upcomingEvents = events
    .filter((e) => e.eventDate >= nowMs && e.eventDate <= nowMs + 30 * DAY_MS)
    .sort((a, b) => a.eventDate - b.eventDate);
  const pendingSevereSsi = ssiResults.filter((r) => r.severity === "severe" && !r.actionTaken).length;
  const openCases = seriousCases.filter((item) =>
    item.status === "open" && inAcademicYear(item.createdAt, item.campusId, item.collegeId ?? undefined),
  ).length;

  // ── Sessions held by this college's own counsellor(s)/head, this period ─
  const periodBookings = collegeBookings.filter((b) => bookingTime(b) >= periodStartMs && bookingTime(b) <= periodNow.getTime());
  const heldSessions = periodBookings.filter(isHeldSession);
  const sessionsByStaff = staffUids
    .map((uid) => ({ uid, name: staffNames.get(uid) ?? uid, count: heldSessions.filter((b) => b.counsellorId === uid).length }))
    .filter((row) => row.count > 0)
    .sort((a, b) => b.count - a.count);

  // ── Group sessions (Events & Programs, category "group-session") run by
  //    this college's own staff, this period ─────────────────────────────
  const groupSessionEvents = events
    .filter((e) => e.category === "group-session" && e.organizerIds.some((id) => staffUids.includes(id)) && e.eventDate >= periodStartMs)
    .sort((a, b) => b.eventDate - a.eventDate);

  // ── What students are coming in with (student-chosen at booking time),
  //    scoped to bookings handled by this college's own staff, this period ─
  const concernCounts = new Map<ConcernCategory, number>();
  let concernTagged = 0;
  for (const b of periodBookings) {
    if (!b.concernCategories?.length) continue;
    concernTagged += 1;
    for (const c of b.concernCategories) concernCounts.set(c, (concernCounts.get(c) ?? 0) + 1);
  }
  const concernRows = (Object.keys(CONCERN_CATEGORY_LABELS) as ConcernCategory[])
    .map((category) => {
      const count = concernCounts.get(category) ?? 0;
      return { category, label: CONCERN_CATEGORY_LABELS[category], count, pct: concernTagged > 0 ? Math.round((count / concernTagged) * 100) : 0 };
    })
    .filter((row) => row.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // ── Monthly reports this calendar month (fixed — not period-scoped) ────
  const reportsThisMonth = monthlyReports.filter((r) =>
    r.month === periodNow.getMonth() + 1 && r.year === periodNow.getFullYear(),
  );
  const pendingReports = reportsThisMonth.filter((r) => r.status === "pending").length;

  // ── Today's check-in/check-out (fixed — not period-scoped) ─────────────
  const attendanceByUid = new Map(attendanceToday.map((r) => [r.uid, r]));
  const checkedInCount = staffUids.filter((uid) => attendanceByUid.get(uid)?.checkInAt).length;

  const designation = profile?.adminAccess?.designation;
  const fallbackGreeting =
    designation === "administration"
      ? "Administrator"
      : designation === "vice-principal"
        ? "Vice-Principal"
        : designation === "management"
          ? "Management"
          : "Principal";
  const greetingName = profile?.displayName || profile?.email || fallbackGreeting;

  interface KpiTile {
    id: string;
    icon: typeof CalendarIcon;
    label: string;
    value: string;
    note: string;
    urgent?: boolean;
    onClick: () => void;
  }

  const tiles: KpiTile[] = [];
  if (sees("analytics")) {
    tiles.push({
      id: "analytics",
      icon: TrendingUpIcon,
      label: "Analytics",
      value: loading ? "…" : String(counsellorCount),
      note: "counsellors at your college",
      onClick: () => onSelectSection("analytics"),
    });
  }
  if (sees("ssi-analytics")) {
    tiles.push({
      id: "ssi-analytics",
      icon: AlertTriangleIcon,
      label: "SSI Analytics",
      value: loading ? "…" : String(pendingSevereSsi),
      note: pendingSevereSsi === 0 ? "all severe addressed" : "severe awaiting action",
      urgent: pendingSevereSsi > 0,
      onClick: () => onSelectSection("ssi-analytics"),
    });
  }
  if (seesSeriousCases) {
    tiles.push({
      id: "serious-cases",
      icon: AlertTriangleIcon,
      label: "Serious Cases",
      value: loading ? "…" : String(openCases),
      note: "awaiting your action",
      urgent: openCases > 0,
      onClick: () => onSelectSection("serious-cases"),
    });
  }
  if (sees("events")) {
    tiles.push({
      id: "events",
      icon: CalendarIcon,
      label: "Events & Programs",
      value: loading ? "…" : String(upcomingEvents.length),
      note: "programs going on (next 30 days)",
      onClick: () => onSelectSection("events"),
    });
  }
  tiles.push({
    id: "sessions-held",
    icon: UsersIcon,
    label: "Sessions Held",
    value: loading ? "…" : String(heldSessions.length),
    note: `by your college counsellor/head — ${periodChipLabel(period).toLowerCase()}`,
    onClick: () => setShowSessions(true),
  });
  tiles.push({
    id: "group-sessions",
    icon: CalendarIcon,
    label: "Group Sessions",
    value: loading ? "…" : String(groupSessionEvents.length),
    note: `run by your college counsellor/head — ${periodChipLabel(period).toLowerCase()}`,
    onClick: () => setShowGroupSessions(true),
  });
  tiles.push({
    id: "monthly-reports",
    icon: FileTextIcon,
    label: "Monthly Reports",
    value: loading ? "…" : String(reportsThisMonth.length),
    note: loading ? "this month" : `${pendingReports} awaiting verification`,
    urgent: pendingReports > 0,
    onClick: () => onSelectSection("staff-monthly-reports"),
  });
  tiles.push({
    id: "attendance",
    icon: ClockIcon,
    label: "Checked In Today",
    value: loading ? "…" : `${checkedInCount}/${staffUids.length}`,
    note: "your college counsellor/head",
    onClick: () => setShowAttendance(true),
  });
  if (sees("counsellor-worksheet")) {
    tiles.push({
      id: "counsellor-worksheet",
      icon: ClipboardListIcon,
      label: "Counsellor Worksheet",
      value: "→",
      note: "view monthly worksheets",
      onClick: () => onSelectSection("counsellor-worksheet"),
    });
  }

  return (
    <div className="pha-overview">
      <section className="pha-hero">
        <div>
          <h2 className="pha-hero__title">Welcome, {greetingName}</h2>
          <p className="pha-hero__subtitle">Your College at a Glance — Vishnu Wellness Centre</p>
          <p className="pha-hero__body">
            Counsellor/head activity, student wellness signals, and case follow-up for your own college, in one
            place. Tap any tile for more detail.
          </p>
        </div>
      </section>

      {error && <p className="pha-error">{error}</p>}

      <section className="pha-section">
        <div className="pha-section__head">
          <h3 className="pha-section__title">Activity</h3>
          <div className="pha-filters" role="group" aria-label="Period">
            {PERIODS.map((p) => (
              <button
                key={p}
                type="button"
                className={`pha-chip ${period === p ? "pha-chip--active" : ""}`}
                aria-pressed={period === p}
                onClick={() => setPeriod(p)}
              >
                {periodChipLabel(p)}
              </button>
            ))}
          </div>
        </div>
        <p className="pha-muted">
          Sessions Held, Group Sessions, and Student Concerns below are for <strong>{period === "year" ? selectedLabel : periodLabel(period, periodNow)}</strong>.
        </p>

        <div className="pha-kpis">
          {tiles.map((tile) => (
            <button
              key={tile.id}
              type="button"
              className={`pha-kpi${tile.urgent ? " pha-kpi--urgent" : ""}`}
              onClick={tile.onClick}
            >
              <span className="pha-kpi__icon">
                <tile.icon />
              </span>
              <span className="pha-kpi__value">{tile.value}</span>
              <p className="pha-kpi__label">{tile.label}</p>
              <p className="pha-kpi__note">{tile.note}</p>
            </button>
          ))}
        </div>
      </section>

      <section className="pha-section">
        <div className="pha-two-col">
          <div className="pha-panel">
            <p className="pha-panel__title">What are students coming in with?</p>
            <p className="pha-muted">
              {loading ? "…" : `${concernTagged} session${concernTagged === 1 ? "" : "s"} tagged`} · aggregated and
              de-identified.
            </p>
            {!loading && concernRows.length === 0 ? (
              <p className="pha-muted">No concern categories tagged yet for your college's sessions.</p>
            ) : (
              <ul className="pha-severity">
                {concernRows.map((row) => (
                  <li key={row.category} className="pha-severity__row">
                    <span>{row.label}</span>
                    <span className="pha-severity__bar">
                      <span className="pha-severity__fill" style={{ width: `${row.pct}%` }} />
                    </span>
                    <strong>{row.pct}%</strong>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="pha-panel">
            <p className="pha-panel__title">Upcoming Programs</p>
            {!loading && upcomingEvents.length === 0 ? (
              <p className="pha-muted">No programs scheduled in the next 30 days.</p>
            ) : (
              <div className="bento-list">
                {upcomingEvents.slice(0, 5).map((e) => (
                  <div key={e.id} className="bento-list-item">
                    <span className="bento-list-item__title">{e.title}</span>
                    <span>{formatDateTimeDMY(e.eventDate)}</span>
                  </div>
                ))}
              </div>
            )}
            {sees("events") && (
              <button type="button" className="pha-panel__link" onClick={() => onSelectSection("events")}>
                View all Events &amp; Programs →
              </button>
            )}
          </div>
        </div>
      </section>

      {showSessions && (
        <Modal title="Sessions Held" onClose={() => setShowSessions(false)}>
          {sessionsByStaff.length === 0 ? (
            <p>No sessions held yet by your college's counsellor/head this period.</p>
          ) : (
            <div className="bento-list">
              {sessionsByStaff.map((row) => (
                <div key={row.uid} className="bento-list-item">
                  <span className="bento-list-item__title">{row.name}</span>
                  <span>{row.count} session{row.count === 1 ? "" : "s"}</span>
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}

      {showGroupSessions && (
        <Modal title="Group Sessions" onClose={() => setShowGroupSessions(false)}>
          {groupSessionEvents.length === 0 ? (
            <p>No group sessions run by your college's counsellor/head this period.</p>
          ) : (
            <div className="bento-list">
              {groupSessionEvents.map((e) => (
                <div key={e.id} className="bento-list-item">
                  <span className="bento-list-item__title">{e.title}</span>
                  <span>{formatDateTimeDMY(e.eventDate)}</span>
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}

      {showAttendance && (
        <Modal title="Today's Check-in / Check-out" onClose={() => setShowAttendance(false)}>
          {staffUids.length === 0 ? (
            <p>No counsellor/head assigned to your college yet.</p>
          ) : (
            <div className="bento-list">
              {staffUids.map((uid) => {
                const record = attendanceByUid.get(uid);
                return (
                  <div key={uid} className="bento-list-item">
                    <span className="bento-list-item__title">{staffNames.get(uid) ?? uid}</span>
                    <span>
                      {!record?.checkInAt
                        ? "Not checked in yet"
                        : !record.checkOutAt
                          ? `Checked in ${formatIstTime(record.checkInAt)}`
                          : `${formatIstTime(record.checkInAt)} – ${formatIstTime(record.checkOutAt)}`}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}

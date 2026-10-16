import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../../services/firebase/config";
import { useAuth } from "../../hooks/useAuth";
import { listEventsForCollege } from "../../services/firebase/events";
import { listSsiCollegeResultsForCollege } from "../../services/firebase/ssiCollegeResults";
import { subscribeToAdminSeriousCases } from "../../services/firebase/seriousCases";
import { listAllBookingsForStats } from "../../services/firebase/bookings";
import { listCounsellorMonthlyReportsForCollege } from "../../services/firebase/counsellorMonthlyReports";
import { listAttendanceForCampusOnDate, istDateKey, formatIstTime } from "../../services/firebase/attendance";
import type { EventProgram } from "../../types/event";
import type { SsiCollegeResult } from "../../services/firebase/ssiCollegeResults";
import type { SeriousCase } from "../../types/seriousCase";
import type { Booking, ConcernCategory } from "../../types/booking";
import { CONCERN_CATEGORY_LABELS } from "../../types/booking";
import type { CounsellorMonthlyReport } from "../../services/firebase/counsellorMonthlyReports";
import type { AttendanceRecord } from "../../types/attendance";
import { TrendingUpIcon, ClockIcon, FileTextIcon, UsersIcon, DownloadIcon } from "../../components/common/icons";
import { Modal } from "../../components/common/Modal";
import { formatDateTimeDMY } from "../../utils/formatDate";
import "./PrincipalHomeOverview.css";

interface PrincipalHomeOverviewProps {
  onSelectSection: (sectionId: string) => void;
}

// Same icon markup as the sidebar's own section icons (AdminDashboard.tsx),
// reused here so each card visually matches the tab it jumps to.
const SECTION_ICONS: Record<string, ReactNode> = {
  events: (
    <svg viewBox="0 0 24 24">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  ),
  analytics: (
    <svg viewBox="0 0 24 24">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  ),
  "ssi-analytics": (
    <svg viewBox="0 0 24 24">
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  ),
  "serious-cases": (
    <svg viewBox="0 0 24 24">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  "counsellor-worksheet": (
    <svg viewBox="0 0 24 24">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  ),
};

const DAY_MS = 24 * 60 * 60 * 1000;
const REPORT_MONTH_LABEL = (m: number, y: number) => new Date(y, m - 1, 1).toLocaleString("en-US", { month: "long", year: "numeric" });

function isHeldSession(b: Booking): boolean {
  return b.status === "completed" && b.outcome !== "missed";
}

/** The Home overview for a college-restricted Principal/Vice-Principal — a
    clean set of shortcut cards summarizing their own granted sections
    (Events, Analytics, SSI Analytics, Counsellor Worksheet, and Serious
    Cases when granted), plus a fixed set of always-visible "at a glance"
    cards about their own college's counsellor(s)/head specifically —
    sessions held, group sessions run, what students are coming in with,
    monthly report submissions, and today's check-in/out — so they can see
    what needs attention at a glance and jump straight to it, instead of
    the campus-wide Consolidated Reports widget other admins get
    (irrelevant to a single-college role). */
export function PrincipalHomeOverview({ onSelectSection }: PrincipalHomeOverviewProps) {
  const { profile } = useAuth();
  const [events, setEvents] = useState<EventProgram[]>([]);
  const [ssiResults, setSsiResults] = useState<SsiCollegeResult[]>([]);
  const [counsellorCount, setCounsellorCount] = useState<number | null>(null);
  const [seriousCases, setSeriousCases] = useState<SeriousCase[]>([]);
  const [staffUids, setStaffUids] = useState<string[]>([]);
  const [staffNames, setStaffNames] = useState<Map<string, string>>(new Map());
  const [collegeBookings, setCollegeBookings] = useState<Booking[]>([]);
  const [monthlyReports, setMonthlyReports] = useState<CounsellorMonthlyReport[]>([]);
  const [attendanceToday, setAttendanceToday] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const [showSessions, setShowSessions] = useState(false);
  const [showGroupSessions, setShowGroupSessions] = useState(false);
  const [showConcerns, setShowConcerns] = useState(false);
  const [showReports, setShowReports] = useState(false);
  const [showAttendance, setShowAttendance] = useState(false);

  const collegeIds = profile?.adminAccess?.collegeIds ?? [];
  // A Principal/VP is always scoped to exactly one campus in practice (one
  // college, one campus) — the single value here is enough for every real
  // account. Firestore can only validate these list queries against the
  // Admin branch of the events/ssi_college_results read rules (which reads
  // resource.data.campusId) when the query itself filters on campusId too —
  // omitting it is what was throwing "Missing or insufficient permissions".
  const campusId = profile?.adminAccess?.campusIds?.[0];
  const grantedSections = profile?.adminAccess?.sections;
  const seesSeriousCases = !grantedSections || grantedSections.includes("serious-cases");

  useEffect(() => {
    if (!profile || collegeIds.length === 0) {
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    Promise.all([
      Promise.all(collegeIds.map((id) => listEventsForCollege(id, campusId))).then((lists) => lists.flat()),
      Promise.all(collegeIds.map((id) => listSsiCollegeResultsForCollege(id, campusId))).then((lists) => lists.flat()),
      Promise.all(
        collegeIds.map((id) =>
          getDocs(query(collection(db, "users"), where("role", "==", "counsellor"), where("collegeId", "==", id))),
        ),
      ),
      campusId
        ? getDocs(query(collection(db, "users"), where("role", "==", "head"), where("campusId", "==", campusId)))
        : Promise.resolve(null),
      Promise.all(collegeIds.map((id) => listCounsellorMonthlyReportsForCollege(id, campusId))).then((lists) =>
        lists.flat(),
      ),
    ])
      .then(([eventList, ssiList, counsellorSnaps, headSnap, reportList]) => {
        if (!active) return;
        setEvents(eventList);
        setSsiResults(ssiList);
        const counsellorDocs = counsellorSnaps.flatMap((s) => s.docs);
        const headDocs = headSnap?.docs ?? [];
        const allStaffDocs = [...counsellorDocs, ...headDocs];
        setCounsellorCount(counsellorDocs.length);
        const uids = allStaffDocs.map((d) => d.id);
        setStaffUids(uids);
        setStaffNames(
          new Map(allStaffDocs.map((d) => [d.id, (d.data().displayName as string) || (d.data().email as string)])),
        );
        setMonthlyReports(reportList);

        // Bookings and today's attendance both need the resolved staff uid
        // list, so they're fetched in a second wave rather than the Promise.all
        // above (which can't see uids until this first wave resolves).
        const todayKey = istDateKey(Date.now());
        Promise.all([
          campusId ? listAllBookingsForStats(campusId, uids) : Promise.resolve([]),
          campusId ? listAttendanceForCampusOnDate(campusId, todayKey) : Promise.resolve([]),
        ]).then(([allCampusBookings, attendance]) => {
          if (!active) return;
          setCollegeBookings(allCampusBookings.filter((b) => uids.includes(b.counsellorId)));
          setAttendanceToday(attendance.filter((r) => uids.includes(r.uid)));
          setLoading(false);
        });
      })
      .catch((err) => {
        console.error("Failed to load Principal home overview", err);
        if (active) setLoading(false);
      });
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

  const now = Date.now();
  const nowDate = new Date();
  const upcomingEvents = events.filter((e) => e.eventDate >= now && e.eventDate <= now + 30 * DAY_MS);
  const severeSsi = ssiResults.filter((r) => r.severity === "severe").length;
  const openCases = seriousCases.filter((c) => c.status === "open").length;

  // ── Sessions held by this college's own counsellor(s)/head ─────────────
  const heldSessions = collegeBookings.filter(isHeldSession);
  const sessionsByStaff = staffUids
    .map((uid) => ({ uid, name: staffNames.get(uid) ?? uid, count: heldSessions.filter((b) => b.counsellorId === uid).length }))
    .filter((row) => row.count > 0)
    .sort((a, b) => b.count - a.count);

  // ── Group sessions (Events & Programs, category "group-session") run by
  //    this college's own staff ────────────────────────────────────────
  const groupSessionEvents = events.filter(
    (e) => e.category === "group-session" && e.organizerIds.some((id) => staffUids.includes(id)),
  );

  // ── What students are coming in with (student-chosen at booking time),
  //    scoped to bookings handled by this college's own staff ───────────
  const concernCounts = new Map<ConcernCategory, number>();
  let concernTagged = 0;
  for (const b of collegeBookings) {
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
    .sort((a, b) => b.count - a.count);

  // ── Monthly reports this month ──────────────────────────────────────
  const reportsThisMonth = monthlyReports.filter((r) => r.month === nowDate.getMonth() + 1 && r.year === nowDate.getFullYear());
  const pendingReports = reportsThisMonth.filter((r) => r.status === "pending").length;

  // ── Today's check-in/check-out ──────────────────────────────────────
  const attendanceByUid = new Map(attendanceToday.map((r) => [r.uid, r]));
  const checkedInCount = staffUids.filter((uid) => attendanceByUid.get(uid)?.checkInAt).length;

  if (!collegeIds.length) return null;

  const cards: {
    id: string;
    label: string;
    value: string;
    hint: string;
    urgent?: boolean;
  }[] = [
    {
      id: "events",
      label: "Events & Programs",
      value: loading ? "…" : String(upcomingEvents.length),
      hint: "upcoming in 30 days",
    },
    {
      id: "analytics",
      label: "Analytics",
      value: loading || counsellorCount === null ? "…" : String(counsellorCount),
      hint: "counsellors at your college",
    },
    {
      id: "ssi-analytics",
      label: "SSI Analytics",
      value: loading ? "…" : String(severeSsi),
      hint: "severe check-ins",
      urgent: severeSsi > 0,
    },
    {
      id: "counsellor-worksheet",
      label: "Counsellor Worksheet",
      value: "→",
      hint: "view monthly worksheets",
    },
  ];

  if (seesSeriousCases) {
    cards.splice(3, 0, {
      id: "serious-cases",
      label: "Serious Cases",
      value: loading ? "…" : String(openCases),
      hint: "awaiting your action",
      urgent: openCases > 0,
    });
  }

  // Only show a card for a section this Principal/VP was actually granted —
  // a card is a shortcut into that tab, so it shouldn't offer one the Super
  // Admin didn't check for them in the first place.
  const visibleCards = grantedSections ? cards.filter((c) => grantedSections.includes(c.id as (typeof grantedSections)[number])) : cards;

  if (visibleCards.length === 0 && collegeBookings.length === 0) return null;

  return (
    <div className="pha-overview">
      <div className="pha-header">
        <h3 className="pha-header__title">
          <TrendingUpIcon />
          <span>Your College at a Glance</span>
        </h3>
        <p className="pha-header__sub">Tap any card to open that section.</p>
      </div>

      <div className="pha-grid">
        {visibleCards.map((card) => (
          <button
            key={card.id}
            type="button"
            className={`pha-card${card.urgent ? " pha-card--urgent" : ""}`}
            onClick={() => onSelectSection(card.id)}
          >
            <span className="pha-card__icon">{SECTION_ICONS[card.id]}</span>
            <span className="pha-card__body">
              <span className="pha-card__value">{card.value}</span>
              <span className="pha-card__label">{card.label}</span>
              <span className="pha-card__hint">{card.hint}</span>
            </span>
          </button>
        ))}

        <button type="button" className="pha-card" onClick={() => setShowSessions(true)}>
          <span className="pha-card__icon"><UsersIcon /></span>
          <span className="pha-card__body">
            <span className="pha-card__value">{loading ? "…" : String(heldSessions.length)}</span>
            <span className="pha-card__label">Sessions Held</span>
            <span className="pha-card__hint">by your college counsellor/head</span>
          </span>
        </button>

        <button type="button" className="pha-card" onClick={() => setShowGroupSessions(true)}>
          <span className="pha-card__icon">{SECTION_ICONS.events}</span>
          <span className="pha-card__body">
            <span className="pha-card__value">{loading ? "…" : String(groupSessionEvents.length)}</span>
            <span className="pha-card__label">Group Sessions</span>
            <span className="pha-card__hint">run by your college counsellor/head</span>
          </span>
        </button>

        <button type="button" className="pha-card" onClick={() => setShowConcerns(true)}>
          <span className="pha-card__icon">{SECTION_ICONS["ssi-analytics"]}</span>
          <span className="pha-card__body">
            <span className="pha-card__value">{loading ? "…" : String(concernRows[0]?.pct ?? 0)}%</span>
            <span className="pha-card__label">Top Student Concern</span>
            <span className="pha-card__hint">{concernRows[0]?.label ?? "What students are coming in with"}</span>
          </span>
        </button>

        <button
          type="button"
          className={`pha-card${pendingReports > 0 ? " pha-card--urgent" : ""}`}
          onClick={() => setShowReports(true)}
        >
          <span className="pha-card__icon"><FileTextIcon /></span>
          <span className="pha-card__body">
            <span className="pha-card__value">{loading ? "…" : String(reportsThisMonth.length)}</span>
            <span className="pha-card__label">Monthly Reports</span>
            <span className="pha-card__hint">{loading ? "this month" : `${pendingReports} awaiting verification`}</span>
          </span>
        </button>

        <button type="button" className="pha-card" onClick={() => setShowAttendance(true)}>
          <span className="pha-card__icon"><ClockIcon /></span>
          <span className="pha-card__body">
            <span className="pha-card__value">{loading ? "…" : `${checkedInCount}/${staffUids.length}`}</span>
            <span className="pha-card__label">Checked In Today</span>
            <span className="pha-card__hint">your college counsellor/head</span>
          </span>
        </button>
      </div>

      {showSessions && (
        <Modal title="Sessions Held" onClose={() => setShowSessions(false)}>
          {sessionsByStaff.length === 0 ? (
            <p>No sessions held yet by your college's counsellor/head.</p>
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
            <p>No group sessions run by your college's counsellor/head yet.</p>
          ) : (
            <div className="bento-list">
              {groupSessionEvents
                .sort((a, b) => b.eventDate - a.eventDate)
                .map((e) => (
                  <div key={e.id} className="bento-list-item">
                    <span className="bento-list-item__title">{e.title}</span>
                    <span>{formatDateTimeDMY(e.eventDate)}</span>
                  </div>
                ))}
            </div>
          )}
        </Modal>
      )}

      {showConcerns && (
        <Modal title="What are students coming in with?" onClose={() => setShowConcerns(false)}>
          <p className="pha-modal__sub">{concernTagged} session{concernTagged === 1 ? "" : "s"} tagged · aggregated and de-identified.</p>
          {concernRows.length === 0 ? (
            <p>No concern categories tagged yet for your college's sessions.</p>
          ) : (
            <div className="bento-list">
              {concernRows.map((row) => (
                <div key={row.category} className="bento-list-item">
                  <span className="bento-list-item__title">{row.label}</span>
                  <span>{row.pct}% ({row.count})</span>
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}

      {showReports && (
        <Modal title="Monthly Reports" onClose={() => setShowReports(false)}>
          {monthlyReports.length === 0 ? (
            <p>No monthly reports submitted yet for your college.</p>
          ) : (
            <div className="bento-list">
              {monthlyReports.map((r) => (
                <a
                  key={r.id}
                  className="bento-list-item pha-modal__report-row"
                  href={r.downloadURL}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <span className="bento-list-item__title">
                    {r.title} — {r.uploadedBy}
                    <span className="pha-modal__report-meta"> ({REPORT_MONTH_LABEL(r.month, r.year)})</span>
                  </span>
                  <span className={`pha-modal__status pha-modal__status--${r.status}`}>
                    {r.status === "verified" ? "Verified" : "Pending"}
                    <DownloadIcon />
                  </span>
                </a>
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

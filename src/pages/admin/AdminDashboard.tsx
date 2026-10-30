import { useCallback, useState } from "react";
import { AppShell } from "../../components/layout/AppShell";
import { ProfileSection } from "../../components/layout/ProfileSection";
import { useAuth } from "../../hooks/useAuth";
import { CampusManagementSection } from "../super-admin/CampusManagementSection";
import { LoginsManagementSection } from "../super-admin/LoginsManagementSection";
import { AnalyticsSection } from "./analytics/AnalyticsSection";
import { SsiAnalyticsSection } from "./analytics/SsiAnalyticsSection";
import { SeriousCasesSection } from "./SeriousCasesSection";
import { EventsOverviewSection } from "./EventsOverviewSection";
import { MonthlyReportsViewSection } from "./MonthlyReportsViewSection";
import { CollegeMonthlyReportsSection } from "./CollegeMonthlyReportsSection";
import { CounsellorWorksheetSection } from "./CounsellorWorksheetSection";
import { AdminHomeActivityOverview } from "./AdminHomeActivityOverview";
import { PrincipalHomeOverview } from "./PrincipalHomeOverview";
import { ManagementHomeOverview } from "./ManagementHomeOverview";
import { CampusRankingsSection } from "../user/CampusRankingsSection";
import { PrincipalLeaveApprovalSection } from "../../components/leaves/PrincipalLeaveApprovalSection";
import { AttendanceManagementSection } from "../../components/attendance/AttendanceManagementSection";
import { TrophyIcon } from "../../components/common/icons";
import "../../styles/bento-grid.css";
import "./AdminDashboard.css";

const SECTIONS = [
  {
    id: "overview",
    label: "Home",
    icon: (
      <svg viewBox="0 0 24 24"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9.5z" /><path d="M9 21V12h6v9" /></svg>
    ),
  },
  {
    id: "campuses",
    label: "Campuses",
    icon: (
      <svg viewBox="0 0 24 24"><path d="M3 21h18" /><path d="M5 21V7l8-4v18" /><path d="M19 21V11l-6-4" /><path d="M9 9h1" /><path d="M9 13h1" /><path d="M9 17h1" /></svg>
    ),
  },
  {
    id: "logins",
    label: "Logins",
    icon: (
      <svg viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
    ),
  },
  {
    id: "events",
    label: "Events & Programs",
    icon: (
      <svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
    ),
  },
  {
    id: "analytics",
    label: "Analytics",
    icon: (
      <svg viewBox="0 0 24 24"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>
    ),
  },
  {
    id: "ssi-analytics",
    label: "SSI Analytics",
    icon: (
      <svg viewBox="0 0 24 24"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>
    ),
  },
  {
    id: "serious-cases",
    label: "Serious Cases",
    variant: "urgent" as const,
    icon: (
      <svg viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
    ),
  },
  {
    id: "counsellor-worksheet",
    label: "Counsellor Worksheet",
    icon: (
      <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></svg>
    ),
  },
  {
    id: "monthly-reports",
    label: "Consolidated Reports",
    icon: (
      <svg viewBox="0 0 24 24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>
    ),
  },
  {
    id: "staff-monthly-reports",
    label: "Monthly Reports",
    icon: (
      <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="8" y1="13" x2="16" y2="13" /><line x1="8" y1="17" x2="16" y2="17" /></svg>
    ),
  },
  {
    id: "attendance",
    label: "Attendance",
    icon: (
      <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
    ),
  },
  {
    id: "leave-approvals",
    label: "Leave Approvals",
    icon: (
      <svg viewBox="0 0 24 24"><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>
    ),
  },
  {
    id: "campus-rankings",
    label: "Campus Rankings",
    icon: <TrophyIcon />,
  },
];

const TITLES: Record<string, string> = {
  profile: "Profile",
  campuses: "Campuses",
  logins: "Logins",
  events: "Events & Programs",
  analytics: "Analytics",
  "ssi-analytics": "SSI Analytics",
  "serious-cases": "Serious Cases",
  "counsellor-worksheet": "Counsellor Worksheet",
  "monthly-reports": "Consolidated Reports",
  "staff-monthly-reports": "Monthly Reports",
  "leave-approvals": "Leave Approvals",
  "campus-rankings": "Campus Rankings",
  attendance: "Attendance",
};

export function AdminDashboard() {
  const { profile } = useAuth();
  const [activeSection, setActiveSection] = useState("overview");
  const [selectedSeriousCaseId, setSelectedSeriousCaseId] = useState<string | null>(null);
  const clearSelectedSeriousCase = useCallback(() => setSelectedSeriousCaseId(null), []);

  // A missing adminAccess means a legacy/global admin — every section stays
  // visible, same as before per-admin scoping existed. "overview" (Home) is
  // always available regardless, same as it always was. Campus Management is
  // hard-excluded for a campus-restricted admin no matter what — a
  // restricted admin can never create/edit/delete a campus or college, so
  // this isn't just the usual "sections" checklist, it's enforced here
  // unconditionally (also matches firestore.rules' isGlobalCampusManager()).
  const isCampusRestricted = profile?.role === "admin" && profile.adminAccess?.scope === "campuses";
  const isPrincipalOrVp =
    profile?.role === "admin" &&
    profile.adminAccess?.scope === "campuses" &&
    (profile.adminAccess.collegeIds?.length ?? 0) > 0 &&
    (profile.adminAccess?.designation === "principal" || profile.adminAccess?.designation === "vice-principal");
  const isAdministration =
    profile?.role === "admin" && profile.adminAccess?.designation === "administration";
  const hasAdministrationAssignment =
    isAdministration &&
    profile.adminAccess?.scope === "campuses" &&
    (profile.adminAccess.campusIds?.length ?? 0) > 0 &&
    (profile.adminAccess.collegeIds?.length ?? 0) > 0;
  const isConsolidatedReportRecipient =
    profile?.role === "admin" &&
    (profile.adminAccess?.designation === "management" ||
      profile.adminAccess?.designation === "administration" ||
      (!profile.adminAccess?.designation &&
        (!profile.adminAccess || profile.adminAccess.scope === "global")));
  const allowedSections = profile?.adminAccess?.sections;
  // Assigned Principal/VP accounts also always get the section because they
  // are the only roles allowed to review and resolve.
  const seesSeriousCasesRegardless =
    !profile?.adminAccess ||
    profile.adminAccess.scope === "global" ||
    profile.adminAccess.designation === "management" ||
    profile.adminAccess.designation === "administration" ||
    isPrincipalOrVp;
  // Management/Administration recipients and legacy global admins can review
  // the campus-wide report, even when other dashboard data is college-scoped.
  const isCollegeScoped =
    profile?.role === "admin" &&
    (hasAdministrationAssignment ||
      (!isConsolidatedReportRecipient &&
        ((profile.adminAccess?.collegeIds?.length ?? 0) > 0 ||
          profile.adminAccess?.designation === "principal" ||
          profile.adminAccess?.designation === "vice-principal")));
  const isManagementAdmin =
    profile?.role === "admin" &&
    (!profile.adminAccess?.designation || profile.adminAccess.designation === "management");
  // Face Registrations / Camera Locations follow the same hierarchy as the
  // "Counsellor & Head Attendance" section below: Management (and legacy
  // global) admins keep whole-campus authority, while an assigned
  // Principal/VP or Administration admin is scoped to their own college —
  // same "all the authorities a Head has, but only for their college" rule.
  // firestore.rules enforces the actual scope via adminCanAccessCollege();
  // this only controls whether the tab is offered at all.
  const canManageAttendance = isManagementAdmin || isPrincipalOrVp || hasAdministrationAssignment;
  const visibleSections = (
    allowedSections
      ? SECTIONS.filter(
          (s) =>
            s.id === "overview" ||
            s.id === "campus-rankings" ||
            (s.id === "monthly-reports" && isConsolidatedReportRecipient) ||
            (s.id === "staff-monthly-reports" && isPrincipalOrVp) ||
            allowedSections.includes(s.id as (typeof allowedSections)[number]) ||
            (s.id === "serious-cases" && seesSeriousCasesRegardless) ||
            (s.id === "leave-approvals" && isPrincipalOrVp) ||
            (s.id === "attendance" && canManageAttendance),
          )
      : SECTIONS
  ).filter(
    (s) =>
      !(isCampusRestricted && s.id === "campuses") &&
      !(isCollegeScoped && !isAdministration && s.id === "monthly-reports") &&
      !(s.id === "staff-monthly-reports" && !isPrincipalOrVp) &&
      !(s.id === "leave-approvals" && !isPrincipalOrVp) &&
      !(s.id === "attendance" && !canManageAttendance),
  );
  const effectiveActiveSection = visibleSections.some((section) => section.id === activeSection)
    ? activeSection
    : "overview";

  const handleManagementSectionSelect = (sectionId: string, seriousCaseId?: string) => {
    if (!visibleSections.some((section) => section.id === sectionId)) {
      return;
    }
    if (sectionId === "serious-cases") {
      setSelectedSeriousCaseId(seriousCaseId ?? null);
    }
    setActiveSection(sectionId);
  };
  const handleSectionSelect = (sectionId: string) => {
    if (visibleSections.some((section) => section.id === sectionId)) {
    setActiveSection(sectionId);
    }
  };

  return (
    <AppShell
      title={effectiveActiveSection === "overview" ? "" : (TITLES[effectiveActiveSection] ?? "")}
      sections={visibleSections}
      activeSection={effectiveActiveSection}
      onSelectSection={handleSectionSelect}
      onNotificationClick={(notification) => {
        if (
          notification.type === "serious_case_created" ||
          notification.type === "serious_case_escalated"
        ) {
          handleManagementSectionSelect("serious-cases", notification.bookingId);
        } else if (notification.type === "monthly_report_uploaded") {
          if (isPrincipalOrVp) {
            setActiveSection("staff-monthly-reports");
          } else if (visibleSections.some((section) => section.id === "monthly-reports")) {
            setActiveSection("monthly-reports");
          } else {
            setActiveSection("overview");
          }
        }
      }}
    >
      {isAdministration && !hasAdministrationAssignment ? (
        <div role="alert" className="bento-grid">
          <p>Your Administration account has no assigned campus and college. Ask a Super Admin to assign them before using the dashboard.</p>
        </div>
      ) : effectiveActiveSection === "profile" ? (
        <ProfileSection />
      ) : effectiveActiveSection === "campuses" && !isCampusRestricted ? (
        <CampusManagementSection />
      ) : effectiveActiveSection === "logins" ? (
        <LoginsManagementSection />
      ) : effectiveActiveSection === "events" ? (
        <EventsOverviewSection />
      ) : effectiveActiveSection === "analytics" ? (
        <AnalyticsSection />
      ) : effectiveActiveSection === "ssi-analytics" ? (
        <SsiAnalyticsSection />
      ) : effectiveActiveSection === "serious-cases" ? (
        <SeriousCasesSection
          initialCaseId={selectedSeriousCaseId}
          onInitialCaseOpened={clearSelectedSeriousCase}
        />
      ) : effectiveActiveSection === "counsellor-worksheet" ? (
        <CounsellorWorksheetSection />
      ) : effectiveActiveSection === "staff-monthly-reports" && isPrincipalOrVp ? (
        <CollegeMonthlyReportsSection />
      ) : effectiveActiveSection === "monthly-reports" && (!isCollegeScoped || isAdministration) ? (
        <MonthlyReportsViewSection readOnly={isAdministration} />
      ) : effectiveActiveSection === "leave-approvals" && isPrincipalOrVp ? (
        <PrincipalLeaveApprovalSection />
      ) : effectiveActiveSection === "attendance" && canManageAttendance ? (
        <AttendanceManagementSection />
      ) : effectiveActiveSection === "campus-rankings" ? (
        <CampusRankingsSection />
      ) : (
        <div className="bento-grid">
          {!isCollegeScoped && (
            <h2 className="admin-dashboard__welcome">
              Welcome, {profile?.displayName || profile?.email || "Administrator"}
            </h2>
          )}

          {isCollegeScoped ? (
            <PrincipalHomeOverview onSelectSection={handleManagementSectionSelect} />
          ) : profile?.adminAccess?.designation === "management" || !profile?.adminAccess?.designation ? (
            <ManagementHomeOverview onSelectSection={handleManagementSectionSelect} />
          ) : (
            <AdminHomeActivityOverview onSelectSection={setActiveSection} />
          )}
        </div>
      )}
    </AppShell>
  );
}

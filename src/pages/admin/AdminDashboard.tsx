import { useState } from "react";
import { AppShell } from "../../components/layout/AppShell";
import { ProfileSection } from "../../components/layout/ProfileSection";
import { useAuth } from "../../hooks/useAuth";
import { CampusManagementSection } from "../super-admin/CampusManagementSection";
import { LoginsManagementSection } from "../super-admin/LoginsManagementSection";
import { AnalyticsSection } from "./analytics/AnalyticsSection";
import { SsiAnalyticsSection } from "./analytics/SsiAnalyticsSection";
import { EventsOverviewSection } from "./EventsOverviewSection";
import { MonthlyReportsViewSection } from "./MonthlyReportsViewSection";
import { CounsellorWorksheetSection } from "./CounsellorWorksheetSection";
import { AdminHomeActivityOverview } from "./AdminHomeActivityOverview";
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
];

const TITLES: Record<string, string> = {
  profile: "Profile",
  campuses: "Campuses",
  logins: "Logins",
  events: "Events & Programs",
  analytics: "Analytics",
  "ssi-analytics": "SSI Analytics",
  "counsellor-worksheet": "Counsellor Worksheet",
  "monthly-reports": "Consolidated Reports",
};

export function AdminDashboard() {
  const { profile } = useAuth();
  const [activeSection, setActiveSection] = useState("overview");

  // A missing adminAccess means a legacy/global admin — every section stays
  // visible, same as before per-admin scoping existed. "overview" (Home) is
  // always available regardless, same as it always was. Campus Management is
  // hard-excluded for a campus-restricted admin no matter what — a
  // restricted admin can never create/edit/delete a campus or college, so
  // this isn't just the usual "sections" checklist, it's enforced here
  // unconditionally (also matches firestore.rules' isGlobalCampusManager()).
  const isCampusRestricted = profile?.role === "admin" && profile.adminAccess?.scope === "campuses";
  const allowedSections = profile?.adminAccess?.sections;
  const visibleSections = (
    allowedSections
      ? SECTIONS.filter((s) => s.id === "overview" || allowedSections.includes(s.id as (typeof allowedSections)[number]))
      : SECTIONS
  ).filter((s) => !(isCampusRestricted && s.id === "campuses"));

  return (
    <AppShell
      title={activeSection === "overview" ? "" : (TITLES[activeSection] ?? "")}
      sections={visibleSections}
      activeSection={activeSection}
      onSelectSection={setActiveSection}
    >
      {activeSection === "profile" ? (
        <ProfileSection />
      ) : activeSection === "campuses" && !isCampusRestricted ? (
        <CampusManagementSection />
      ) : activeSection === "logins" ? (
        <LoginsManagementSection />
      ) : activeSection === "events" ? (
        <EventsOverviewSection />
      ) : activeSection === "analytics" ? (
        <AnalyticsSection />
      ) : activeSection === "ssi-analytics" ? (
        <SsiAnalyticsSection />
      ) : activeSection === "counsellor-worksheet" ? (
        <CounsellorWorksheetSection />
      ) : activeSection === "monthly-reports" ? (
        <MonthlyReportsViewSection />
      ) : (
        <div className="bento-grid">
          <h2 className="admin-dashboard__welcome">
            Welcome, {profile?.displayName || profile?.email || "Administrator"}
          </h2>

          <AdminHomeActivityOverview onSelectSection={setActiveSection} />
        </div>
      )}
    </AppShell>
  );
}

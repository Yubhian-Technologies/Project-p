import { useState } from "react";
import { AppShell } from "../../components/layout/AppShell";
import { ProfileSection } from "../../components/layout/ProfileSection";
import { BentoCard } from "../../components/common/BentoCard";
import { useAuth } from "../../hooks/useAuth";
import { CampusManagementSection } from "../super-admin/CampusManagementSection";
import { LoginsManagementSection } from "../super-admin/LoginsManagementSection";
import { AnalyticsSection } from "./analytics/AnalyticsSection";
import { EventsOverviewSection } from "./EventsOverviewSection";
import { MonthlyReportsViewSection } from "./MonthlyReportsViewSection";
import { CounsellorRatingsSection } from "./CounsellorRatingsSection";
import { AdminHomeActivityOverview } from "./AdminHomeActivityOverview";
import "../../styles/bento-grid.css";

const SECTIONS = [
  { id: "overview", label: "Home" },
  { id: "campuses", label: "Campuses" },
  { id: "logins", label: "Logins" },
  { id: "events", label: "Events & Programs" },
  { id: "analytics", label: "Analytics" },
  { id: "counsellor-ratings", label: "Counsellor Ratings" },
  { id: "monthly-reports", label: "Monthly Reports" },
];

const TITLES: Record<string, string> = {
  profile: "Profile",
  campuses: "Campuses",
  logins: "Logins",
  events: "Events & Programs",
  analytics: "Analytics",
  "counsellor-ratings": "Counsellor Ratings",
  "monthly-reports": "Monthly Reports",
};

export function AdminDashboard() {
  const { profile } = useAuth();
  const [activeSection, setActiveSection] = useState("overview");

  return (
    <AppShell
      title={TITLES[activeSection] ?? "Admin Dashboard"}
      sections={SECTIONS}
      activeSection={activeSection}
      onSelectSection={setActiveSection}
    >
      {activeSection === "profile" ? (
        <ProfileSection />
      ) : activeSection === "campuses" ? (
        <CampusManagementSection />
      ) : activeSection === "logins" ? (
        <LoginsManagementSection />
      ) : activeSection === "events" ? (
        <EventsOverviewSection />
      ) : activeSection === "analytics" ? (
        <AnalyticsSection />
      ) : activeSection === "counsellor-ratings" ? (
        <CounsellorRatingsSection />
      ) : activeSection === "monthly-reports" ? (
        <MonthlyReportsViewSection />
      ) : (
        <div className="bento-grid">
          <BentoCard
            span={12}
            variant="hero"
            title={`Welcome, ${profile?.displayName || profile?.email || "Administrator"}`}
            subtitle="Vishnu Wellness Center Platform Administration"
          >
            <div style={{ marginTop: "16px", fontSize: "14px", lineHeight: "1.6" }}>
              Overseeing platform user accounts, counsellor access permissions, and platform administration.
            </div>
          </BentoCard>

          <AdminHomeActivityOverview onSelectSection={setActiveSection} />
        </div>
      )}
    </AppShell>
  );
}

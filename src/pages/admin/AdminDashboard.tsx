import { useState } from "react";
import { AppShell } from "../../components/layout/AppShell";
import { ProfileSection } from "../../components/layout/ProfileSection";
import { BentoCard } from "../../components/common/BentoCard";
import { useAuth } from "../../hooks/useAuth";
import { CampusManagementSection } from "../super-admin/CampusManagementSection";
import { AnalyticsSection } from "./analytics/AnalyticsSection";
import { EventsOverviewSection } from "./EventsOverviewSection";
import "../../styles/bento-grid.css";

const SECTIONS = [
  { id: "overview", label: "Home" },
  { id: "campuses", label: "Campuses" },
  { id: "events", label: "Events & Programs" },
  { id: "analytics", label: "Analytics" },
];

const TITLES: Record<string, string> = {
  profile: "Profile",
  campuses: "Campuses",
  events: "Events & Programs",
  analytics: "Analytics",
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
      ) : activeSection === "events" ? (
        <EventsOverviewSection />
      ) : activeSection === "analytics" ? (
        <AnalyticsSection />
      ) : (
        <div className="bento-grid">
          <BentoCard
            span={12}
            variant="hero"
            title={`Welcome, ${profile?.displayName || profile?.email || "Administrator"}`}
            subtitle="Vishnu Wellness Platform Administration"
          >
            <div style={{ marginTop: "16px", fontSize: "14px", lineHeight: "1.6" }}>
              Overseeing platform user accounts, counsellor access permissions, and platform administration.
            </div>
          </BentoCard>
        </div>
      )}
    </AppShell>
  );
}

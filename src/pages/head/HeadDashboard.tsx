import { useState } from "react";
import { AppShell } from "../../components/layout/AppShell";
import { ProfileSection } from "../../components/layout/ProfileSection";
import { BentoCard } from "../../components/common/BentoCard";
import { useAuth } from "../../hooks/useAuth";
import { BookingRequestsSection } from "../counsellor/BookingRequestsSection";
import { TeamManagementSection } from "./TeamManagementSection";
import { DailyQuoteCard } from "../../components/common/DailyQuoteCard";
import "../../styles/bento-grid.css";

const SECTIONS = [
  { id: "overview", label: "Home" },
  { id: "requests", label: "Requests" },
  { id: "team-management", label: "Team Management" },
];

export function HeadDashboard() {
  const { profile } = useAuth();
  const [activeSection, setActiveSection] = useState("overview");

  const titleBySection: Record<string, string> = {
    profile: "Profile",
    requests: "Booking Requests",
    "team-management": "Team Management",
  };
  const title = titleBySection[activeSection] ?? "Head Dashboard";

  return (
    <AppShell title={title} sections={SECTIONS} activeSection={activeSection} onSelectSection={setActiveSection}>
      {activeSection === "profile" && <ProfileSection />}
      {activeSection === "requests" && <BookingRequestsSection />}
      {activeSection === "team-management" && <TeamManagementSection />}
      {activeSection === "overview" && (
        <div className="bento-grid">
          <BentoCard
            span={12}
            variant="hero"
            title={`Welcome, ${profile?.displayName || profile?.email || "Department Head"}`}
            subtitle="Counselling Department Leadership & Team Oversight"
            action={{
              label: "View Team Management →",
              variant: "secondary",
              onClick: () => setActiveSection("team-management"),
            }}
          >
            <div style={{ marginTop: "16px", fontSize: "14px", lineHeight: "1.6" }}>
              Monitor team workload, review cancellations, and oversee booking requests across your department.
            </div>
          </BentoCard>
          <DailyQuoteCard />
        </div>
      )}
    </AppShell>
  );
}

import { useState } from "react";
import { AppShell } from "../../components/layout/AppShell";
import { ProfileSection } from "../../components/layout/ProfileSection";
import { BentoCard } from "../../components/common/BentoCard";
import { Button } from "../../components/common/Button";
import { useAuth } from "../../hooks/useAuth";
import { BookingRequestsSection } from "../counsellor/BookingRequestsSection";
import { TeamManagementSection } from "./TeamManagementSection";
import { EventsProgramsSection } from "./EventsProgramsSection";
import { DailyQuoteCard } from "../../components/common/DailyQuoteCard";
import "../../styles/bento-grid.css";

const SECTIONS = [
  { id: "overview", label: "Home" },
  { id: "requests", label: "Requests" },
  { id: "team-management", label: "Team Management" },
  { id: "events", label: "Events & Programs" },
];

export function HeadDashboard() {
  const { profile } = useAuth();
  const [activeSection, setActiveSection] = useState("overview");
  const [showImport, setShowImport] = useState(false);

  const titleBySection: Record<string, string> = {
    profile: "Profile",
    requests: "Booking Requests",
    "team-management": "Team Management",
    events: "Events & Programs",
  };
  const title = titleBySection[activeSection] ?? "Head Dashboard";

  return (
    <AppShell
      title={title}
      headerAction={
        activeSection === "requests" ? (
          <Button type="button" variant="outlined" onClick={() => setShowImport(true)}>
            Import Sessions
          </Button>
        ) : undefined
      }
      sections={SECTIONS}
      activeSection={activeSection}
      onSelectSection={setActiveSection}
    >
      {activeSection === "profile" && <ProfileSection />}
      {activeSection === "requests" && (
        <BookingRequestsSection importOpen={showImport} onImportClose={() => setShowImport(false)} />
      )}
      {activeSection === "team-management" && <TeamManagementSection />}
      {activeSection === "events" && <EventsProgramsSection />}
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

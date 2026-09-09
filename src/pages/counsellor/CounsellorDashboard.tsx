import { useState } from "react";
import { AppShell } from "../../components/layout/AppShell";
import { ProfileSection } from "../../components/layout/ProfileSection";
import { BentoCard } from "../../components/common/BentoCard";
import { Button } from "../../components/common/Button";
import { useAuth } from "../../hooks/useAuth";
import { BookingRequestsSection } from "./BookingRequestsSection";
import { EventsProgramsSection } from "./EventsProgramsSection";
import { DailyQuoteCard } from "../../components/common/DailyQuoteCard";
import "../../styles/bento-grid.css";

const SECTIONS = [
  { id: "overview", label: "Home" },
  { id: "requests", label: "Requests" },
  { id: "events", label: "Events & Programs" },
];

export function CounsellorDashboard() {
  const { profile } = useAuth();
  const [activeSection, setActiveSection] = useState("overview");
  const [showImport, setShowImport] = useState(false);

  const title =
    activeSection === "profile"
      ? "Profile"
      : activeSection === "requests"
        ? "Booking Requests"
        : activeSection === "events"
          ? "Events & Programs"
          : "Counsellor Dashboard";

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
      {activeSection === "events" && <EventsProgramsSection />}
      {activeSection === "overview" && (
        <div className="bento-grid">
          <BentoCard
            span={12}
            variant="hero"
            title={`Welcome, ${profile?.displayName || profile?.email || "Counsellor"}`}
            subtitle="Certified Psychologist & Counsellor Workspace"
            action={{
              label: "Review Booking Requests →",
              variant: "secondary",
              onClick: () => setActiveSection("requests"),
            }}
          >
            <div style={{ marginTop: "16px", fontSize: "14px", lineHeight: "1.6" }}>
              Review incoming session requests, update your availability, and manage your upcoming sessions.
            </div>
          </BentoCard>
          <DailyQuoteCard />
        </div>
      )}
    </AppShell>
  );
}
